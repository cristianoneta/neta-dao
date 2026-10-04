pub mod msg;
mod proof;

use cosmwasm_std::{
    entry_point, to_json_binary, Addr, Binary, Deps, DepsMut, Env, MessageInfo, Response, StdError,
    StdResult,
};
use cw_storage_plus::{Item, Map};
use msg::*;

const REGISTRY: Item<Addr> = Item::new("registry");
const PROFILES: Map<&str, Profile> = Map::new("profiles");
const BINDINGS: Map<(&str, &str), String> = Map::new("bindings");
const MAX_PROOF_AGE: u64 = 600;

fn fail(message: &str) -> StdError {
    StdError::generic_err(message)
}

fn valid_name(name: &str) -> StdResult<()> {
    let label = name
        .strip_suffix(".neta")
        .ok_or_else(|| fail("expected .neta name"))?;
    if !(3..=32).contains(&label.len())
        || !label
            .bytes()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == b'-')
        || label.starts_with('-')
        || label.ends_with('-')
        || label.contains("--")
        || matches!(
            label,
            "dao" | "admin" | "neta" | "relay" | "support" | "treasury" | "governance"
        )
    {
        return Err(fail("invalid personal name"));
    }
    Ok(())
}

fn identity(deps: Deps, name: &str) -> StdResult<Identity> {
    valid_name(name)?;
    let result: Identity = deps.querier.query_wasm_smart(
        REGISTRY.load(deps.storage)?,
        &RegistryQuery::Identity { name: name.into() },
    )?;
    if result.name != name || result.generation == 0 || result.ownership_revision == 0 {
        return Err(fail("invalid registry identity"));
    }
    deps.api.addr_validate(&result.owner)?;
    Ok(result)
}

fn same_identity(a: &Identity, b: &Identity) -> bool {
    a.name == b.name
        && a.owner == b.owner
        && a.generation == b.generation
        && a.ownership_revision == b.ownership_revision
}

fn load_current(deps: Deps, env: &Env, name: &str) -> StdResult<ProfileResponse> {
    let current = identity(deps, name)?;
    if env.block.time.seconds() >= current.expires_at {
        return Ok(ProfileResponse {
            active: false,
            profile: None,
        });
    }
    let mut stored = PROFILES.may_load(deps.storage, name)?;
    let reset_revision = stored.as_ref().map_or(Ok(0), |p| {
        p.revision
            .checked_add(1)
            .ok_or_else(|| fail("revision overflow"))
    })?;
    if stored
        .as_ref()
        .is_some_and(|p| !same_identity(&p.identity, &current))
    {
        stored = None;
    }
    let mut profile = stored.unwrap_or(Profile {
        identity: current.clone(),
        revision: reset_revision,
        contacts: Contacts::default(),
        validators: None,
        updated_at: 0,
    });
    profile.identity = current;
    let mut lost_binding = false;
    if let Some(pair) = &profile.validators {
        // A name that expired may have lost its exclusive operator slots.
        // Renewal alone must not resurrect a link now held by another name.
        for op in [&pair.mainnet, &pair.testnet] {
            if BINDINGS
                .may_load(deps.storage, (&op.chain_id, &op.address))?
                .as_deref()
                != Some(name)
            {
                lost_binding = true;
                break;
            }
        }
    }
    if lost_binding {
        profile.validators = None;
    }
    Ok(ProfileResponse {
        active: true,
        profile: Some(profile),
    })
}

fn current(deps: Deps, env: &Env, name: &str, revision: u64) -> StdResult<Profile> {
    let p = load_current(deps, env, name)?
        .profile
        .ok_or_else(|| fail("name expired"))?;
    if p.revision != revision {
        return Err(fail("profile changed; refresh and review"));
    }
    Ok(p)
}

fn owner(profile: &Profile, sender: &Addr) -> StdResult<()> {
    if profile.identity.owner != sender.as_str() {
        return Err(fail("name owner required"));
    }
    Ok(())
}

fn contacts_valid(c: &Contacts) -> StdResult<()> {
    for (value, max) in [
        (&c.description, 500),
        (&c.discord, 64),
        (&c.telegram, 32),
        (&c.twitter, 15),
        (&c.email, 254),
        (&c.website, 512),
    ] {
        if value.len() > max || value.chars().any(|c| c.is_control()) {
            return Err(fail(
                "contact field too long or contains control characters",
            ));
        }
    }
    for value in [&c.telegram, &c.twitter] {
        if !value
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || c == b'_')
        {
            return Err(fail("use a username without @ for Telegram and X"));
        }
    }
    if !c
        .discord
        .bytes()
        .all(|c| c.is_ascii_alphanumeric() || b"._#".contains(&c))
    {
        return Err(fail("invalid Discord username"));
    }
    if !c.email.is_empty() {
        let parts: Vec<_> = c.email.split('@').collect();
        if parts.len() != 2
            || parts[0].is_empty()
            || !parts[1].contains('.')
            || !c.email.is_ascii()
            || c.email
                .bytes()
                .any(|c| c.is_ascii_whitespace() || b"<>\"'\\?&#".contains(&c))
        {
            return Err(fail("invalid public email address"));
        }
    }
    if !c.website.is_empty() {
        let rest = c
            .website
            .strip_prefix("https://")
            .ok_or_else(|| fail("website must use HTTPS"))?;
        let host = rest.split(['/', '?', '#']).next().unwrap_or_default();
        if host.is_empty()
            || !host.contains('.')
            || host.contains('@')
            || !c.website.is_ascii()
            || c.website
                .bytes()
                .any(|c| c.is_ascii_whitespace() || b"<>\"'\\".contains(&c))
        {
            return Err(fail("invalid public website"));
        }
    }
    Ok(())
}

fn pair_valid(pair: &Pair) -> StdResult<()> {
    if pair.mainnet.chain_id != "juno-1" || pair.testnet.chain_id != "uni-7" {
        return Err(fail("first adapter supports Juno mainnet and UNI-7 only"));
    }
    proof::account(&pair.mainnet)?;
    proof::account(&pair.testnet)?;
    Ok(())
}

fn challenge(
    deps: Deps,
    env: &Env,
    profile: &Profile,
    pair: &Pair,
    expires_at: u64,
    revoke: bool,
) -> StdResult<String> {
    pair_valid(pair)?;
    let now = env.block.time.seconds();
    if expires_at <= now
        || expires_at > now.saturating_add(MAX_PROOF_AGE)
        || expires_at > profile.identity.expires_at
    {
        return Err(fail(
            "proof must expire within ten minutes and before name expiry",
        ));
    }
    Ok(format!(
        "NETA validator profile v1\nPurpose: {}\nRegistry chain: {}\nProfile contract: {}\nName registry: {}\nName: {}\nOwner: {}\nGeneration: {}\nOwnership revision: {}\nProfile revision: {}\nMainnet chain: {}\nMainnet operator: {}\nTestnet chain: {}\nTestnet operator: {}\nExpires at (Unix seconds): {}",
        if revoke { "revoke-validator-link" } else { "link-validators" }, env.block.chain_id,
        env.contract.address, REGISTRY.load(deps.storage)?, profile.identity.name, profile.identity.owner,
        profile.identity.generation, profile.identity.ownership_revision, profile.revision,
        pair.mainnet.chain_id, pair.mainnet.address, pair.testnet.chain_id, pair.testnet.address, expires_at
    ))
}

fn pair_contains(pair: &Pair, op: &Operator) -> bool {
    &pair.mainnet == op || &pair.testnet == op
}

fn binding(deps: Deps, env: &Env, op: &Operator) -> StdResult<Option<Profile>> {
    proof::account(op)?;
    let Some(name) = BINDINGS.may_load(deps.storage, (&op.chain_id, &op.address))? else {
        return Ok(None);
    };
    let result = load_current(deps, env, &name)?;
    Ok(result.profile.filter(|p| {
        p.validators
            .as_ref()
            .is_some_and(|pair| pair_contains(pair, op))
    }))
}

fn remove_indexes(storage: &mut dyn cosmwasm_std::Storage, profile: &Profile) -> StdResult<()> {
    if let Some(pair) = &profile.validators {
        for op in [&pair.mainnet, &pair.testnet] {
            let key = (op.chain_id.as_str(), op.address.as_str());
            // Never remove another name's replacement after expiry/reassignment.
            if BINDINGS.may_load(storage, key)?.as_deref() == Some(&profile.identity.name) {
                BINDINGS.remove(storage, key);
            }
        }
    }
    Ok(())
}

#[entry_point]
pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    msg: InstantiateMsg,
) -> StdResult<Response> {
    if !info.funds.is_empty() {
        return Err(fail("funds not accepted"));
    }
    let registry = deps.api.addr_validate(&msg.registry)?;
    REGISTRY.save(deps.storage, &registry)?;
    cw2::set_contract_version(
        deps.storage,
        "crates.io:neta-validator-profiles",
        env!("CARGO_PKG_VERSION"),
    )?;
    Ok(Response::new()
        .add_attribute("action", "instantiate_profiles")
        .add_attribute("registry", registry))
}

#[entry_point]
pub fn execute(deps: DepsMut, env: Env, info: MessageInfo, msg: ExecuteMsg) -> StdResult<Response> {
    if !info.funds.is_empty() {
        return Err(fail("funds not accepted"));
    }
    let (name, revision) = match &msg {
        ExecuteMsg::UpdateContacts {
            name,
            expected_revision,
            ..
        }
        | ExecuteMsg::LinkValidators {
            name,
            expected_revision,
            ..
        }
        | ExecuteMsg::UnlinkValidators {
            name,
            expected_revision,
        }
        | ExecuteMsg::RevokeByOperator {
            name,
            expected_revision,
            ..
        } => (name.clone(), *expected_revision),
    };
    let mut profile = current(deps.as_ref(), &env, &name, revision)?;
    let action = match msg {
        ExecuteMsg::UpdateContacts { contacts, .. } => {
            owner(&profile, &info.sender)?;
            contacts_valid(&contacts)?;
            profile.contacts = contacts;
            "update_contacts"
        }
        ExecuteMsg::LinkValidators {
            pair,
            expires_at,
            mainnet_proof,
            testnet_proof,
            ..
        } => {
            owner(&profile, &info.sender)?;
            let text = challenge(deps.as_ref(), &env, &profile, &pair, expires_at, false)?;
            proof::verify(deps.api, &pair.mainnet, &text, &mainnet_proof)?;
            proof::verify(deps.api, &pair.testnet, &text, &testnet_proof)?;
            for op in [&pair.mainnet, &pair.testnet] {
                if binding(deps.as_ref(), &env, op)?.is_some_and(|p| p.identity.name != name) {
                    return Err(fail("operator already linked to another active name"));
                }
            }
            if let Some(old) = PROFILES.may_load(deps.storage, &name)? {
                remove_indexes(deps.storage, &old)?;
            }
            for op in [&pair.mainnet, &pair.testnet] {
                BINDINGS.save(deps.storage, (&op.chain_id, &op.address), &name)?;
            }
            profile.validators = Some(pair);
            "link_validators"
        }
        ExecuteMsg::UnlinkValidators { .. } => {
            owner(&profile, &info.sender)?;
            remove_indexes(deps.storage, &profile)?;
            profile.validators = None;
            "unlink_validators"
        }
        ExecuteMsg::RevokeByOperator {
            expires_at,
            operator,
            proof,
            ..
        } => {
            let pair = profile
                .validators
                .as_ref()
                .ok_or_else(|| fail("no linked validators"))?;
            if !pair_contains(pair, &operator) {
                return Err(fail("operator is not linked"));
            }
            let text = challenge(deps.as_ref(), &env, &profile, pair, expires_at, true)?;
            proof::verify(deps.api, &operator, &text, &proof)?;
            remove_indexes(deps.storage, &profile)?;
            profile.validators = None;
            "revoke_validator_link"
        }
    };
    profile.revision = revision
        .checked_add(1)
        .ok_or_else(|| fail("revision overflow"))?;
    profile.updated_at = env.block.time.seconds();
    PROFILES.save(deps.storage, &name, &profile)?;
    Ok(Response::new()
        .add_attribute("action", action)
        .add_attribute("name", name)
        .add_attribute("revision", profile.revision.to_string()))
}

#[entry_point]
pub fn query(deps: Deps, env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::Config {} => to_json_binary(&InstantiateMsg {
            registry: REGISTRY.load(deps.storage)?.into(),
        }),
        QueryMsg::Profile { name } => to_json_binary(&load_current(deps, &env, &name)?),
        QueryMsg::OperatorBinding { operator } => to_json_binary(&binding(deps, &env, &operator)?),
        QueryMsg::Challenge {
            name,
            expected_revision,
            pair,
            expires_at,
            revoke,
        } => {
            let profile = current(deps, &env, &name, expected_revision)?;
            if revoke && profile.validators.as_ref() != Some(&pair) {
                return Err(fail("revocation pair mismatch"));
            }
            to_json_binary(&ChallengeResponse {
                text: challenge(deps, &env, &profile, &pair, expires_at, revoke)?,
                mainnet_signer: proof::account(&pair.mainnet)?,
                testnet_signer: proof::account(&pair.testnet)?,
            })
        }
    }
}

#[cfg(test)]
mod tests;
