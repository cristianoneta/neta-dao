pub mod msg;
pub mod policy;

use cosmwasm_std::{
    entry_point, from_json, to_json_binary, Binary, Deps, DepsMut, Env, MessageInfo, Response,
    StdResult, WasmMsg,
};
use cw_storage_plus::{Item, Map};
use msg::*;
use policy::*;
use serde::{Deserialize, Serialize};

const CONFIG: Item<Config> = Item::new("config");
const NAMES: Map<&str, Identity> = Map::new("names");
const REVERSE: Map<&str, String> = Map::new("reverse");
const COMMITS: Map<&str, Commitment> = Map::new("commits");
const NONCES: Map<(&str, &str), bool> = Map::new("quote_nonces");
const OFFERS: Map<&str, TransferOffer> = Map::new("offers");
const OFFER_IDS: Map<&str, u64> = Map::new("offer_ids");

#[derive(Serialize)]
#[serde(rename_all = "snake_case")]
enum TokenQuery {
    TokenInfo {},
}
#[derive(Deserialize)]
struct TokenInfo {
    decimals: u8,
}
#[derive(Serialize)]
#[serde(rename_all = "snake_case")]
enum TokenExecute {
    Transfer {
        recipient: String,
        amount: cosmwasm_std::Uint128,
    },
}

fn no_funds(info: &MessageInfo) -> StdResult<()> {
    if !info.funds.is_empty() {
        return Err(fail("native funds are not accepted"));
    }
    Ok(())
}
fn key_valid(key: &Binary) -> StdResult<()> {
    if key.len() != 32 || key.as_slice().iter().all(|b| *b == 0) {
        return Err(fail("expected Ed25519 quote public key"));
    }
    Ok(())
}
fn admin(config: &Config, sender: &str) -> StdResult<()> {
    if config.admin != sender {
        return Err(fail("registry governance required"));
    }
    Ok(())
}
fn active_name(deps: Deps, env: &Env, address: &str) -> StdResult<Option<String>> {
    let Some(n) = REVERSE.may_load(deps.storage, address)? else {
        return Ok(None);
    };
    let record = NAMES.may_load(deps.storage, &n)?;
    Ok(record
        .filter(|r| r.owner == address && env.block.time.seconds() < r.expires_at)
        .map(|r| r.name))
}
fn owner_slot(deps: Deps, env: &Env, owner: &str, wanted: &str) -> StdResult<()> {
    if active_name(deps, env, owner)?.is_some_and(|n| n != wanted) {
        return Err(fail("owner already has an active name"));
    }
    Ok(())
}
fn clear_reverse(
    storage: &mut dyn cosmwasm_std::Storage,
    owner: &str,
    wanted: &str,
) -> StdResult<()> {
    if REVERSE.may_load(storage, owner)?.as_deref() == Some(wanted) {
        REVERSE.remove(storage, owner);
    }
    Ok(())
}
fn active_offer(deps: Deps, env: &Env, n: &str) -> StdResult<Option<TransferOffer>> {
    let record = NAMES.may_load(deps.storage, n)?;
    let offer = OFFERS.may_load(deps.storage, n)?;
    Ok(offer.filter(|o| {
        record.as_ref().is_some_and(|r| {
            r.owner == o.owner
                && r.generation == o.generation
                && r.ownership_revision == o.ownership_revision
                && env.block.time.seconds() < r.expires_at
                && env.block.time.seconds() < o.expires_at
        })
    }))
}

#[entry_point]
pub fn instantiate(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: InstantiateMsg,
) -> StdResult<Response> {
    no_funds(&info)?;
    key_valid(&msg.quote_public_key)?;
    if msg.testnet_only {
        if env.block.chain_id != "uni-7" {
            return Err(fail("test registry is UNI-7 only"));
        }
    } else if env.block.chain_id != "juno-1"
        || msg.token != MAINNET_TOKEN
        || msg.treasury != MAINNET_TREASURY
        || msg.admin != MAINNET_TREASURY
    {
        return Err(fail(
            "mainnet requires the pinned NETA token and NETA DAO treasury/governance",
        ));
    }
    for address in [&msg.token, &msg.treasury, &msg.admin] {
        deps.api.addr_validate(address)?;
    }
    let token: TokenInfo = deps
        .querier
        .query_wasm_smart(&msg.token, &TokenQuery::TokenInfo {})?;
    if token.decimals != 6 {
        return Err(fail("registry requires a six-decimal CW20 token"));
    }
    CONFIG.save(
        deps.storage,
        &Config {
            chain_id: env.block.chain_id,
            token: msg.token,
            treasury: msg.treasury,
            admin: msg.admin,
            quote_public_key: msg.quote_public_key,
            signer_version: 1,
            tariff: Tariff {
                three_cents: 64_000,
                four_cents: 16_000,
                standard_cents: 500,
            },
            tariff_version: 1,
            purchases_paused: true,
            testnet_only: msg.testnet_only,
        },
    )?;
    cw2::set_contract_version(
        deps.storage,
        "crates.io:neta-names-v2",
        env!("CARGO_PKG_VERSION"),
    )?;
    Ok(Response::new()
        .add_attribute("action", "instantiate_names_v2")
        .add_attribute("purchases_paused", "true"))
}

fn verify_quote(
    deps: Deps,
    env: &Env,
    config: &Config,
    receive: &Cw20ReceiveMsg,
    offer: &SignedQuote,
    operation: Operation,
    snapshot: Option<&PriceSnapshot>,
) -> StdResult<()> {
    let q = &offer.quote;
    let now = env.block.time.seconds();
    if config.purchases_paused {
        return Err(fail("name purchases and renewals are paused"));
    }
    if q.operation != operation
        || q.payer != receive.sender
        || q.amount != receive.amount
        || q.name != name(&q.name)?
        || !hex64(&q.nonce)
        || !(1..=5).contains(&q.years)
        || q.generation == 0
        || q.ownership_revision == 0
    {
        return Err(fail("quote payment or operation mismatch"));
    }
    deps.api.addr_validate(&q.payer)?;
    deps.api.addr_validate(&q.owner)?;
    if q.tariff_version != config.tariff_version || q.signer_version != config.signer_version {
        return Err(fail(
            "quote authority or tariff changed; request a new quote",
        ));
    }
    if q.issued_at > now
        || q.expires_at <= now
        || q.expires_at <= q.issued_at
        || q.expires_at > add(q.issued_at, QUOTE_TTL)?
    {
        return Err(fail("quote expired or outside its validity window"));
    }
    if q.amount != amount(&config.tariff, &q.name, q.years, q.usd_per_neta_12)? {
        return Err(fail("quote tariff arithmetic mismatch"));
    }
    if NONCES
        .may_load(deps.storage, (&q.payer, &q.nonce))?
        .unwrap_or(false)
    {
        return Err(fail("quote already used"));
    }
    let preimage = if let Some(p) = snapshot {
        if p.signer_version != config.signer_version
            || p.usd_per_neta_12.is_zero()
            || p.usd_per_neta_12 != q.usd_per_neta_12
            || p.observed_at == 0
            || p.observed_at > now
            || p.expires_at <= now
            || p.expires_at <= p.observed_at
            || p.expires_at > add(p.observed_at, PRICE_SNAPSHOT_TTL)?
            || q.expires_at > p.expires_at
        {
            return Err(fail("invalid or expired price snapshot"));
        }
        price_snapshot_preimage(env, config, p)
    } else {
        quote_preimage(env, config, q)
    };
    if offer.signature.len() != 64
        || !deps
            .api
            .ed25519_verify(
                preimage.as_bytes(),
                offer.signature.as_slice(),
                config.quote_public_key.as_slice(),
            )
            .map_err(|_| fail("invalid quote signature"))?
    {
        return Err(fail("invalid quote signature"));
    }
    Ok(())
}

fn pay(deps: DepsMut, env: Env, info: MessageInfo, receive: Cw20ReceiveMsg) -> StdResult<Response> {
    let config = CONFIG.load(deps.storage)?;
    if info.sender.as_str() != config.token {
        return Err(fail("wrong payment token"));
    }
    let hook: HookMsg = from_json(&receive.msg)?;
    let (offer, salt, operation, snapshot) = match hook {
        HookMsg::Register { offer, salt } => (offer, Some(salt), Operation::Register, None),
        HookMsg::Renew { offer } => (offer, None, Operation::Renew, None),
        HookMsg::RegisterSnapshot { offer, salt } => (
            SignedQuote {
                quote: offer.quote,
                signature: offer.signature,
            },
            Some(salt),
            Operation::Register,
            Some(offer.snapshot),
        ),
        HookMsg::RenewSnapshot { offer } => (
            SignedQuote {
                quote: offer.quote,
                signature: offer.signature,
            },
            None,
            Operation::Renew,
            Some(offer.snapshot),
        ),
    };
    verify_quote(
        deps.as_ref(),
        &env,
        &config,
        &receive,
        &offer,
        operation.clone(),
        snapshot.as_ref(),
    )?;
    let q = &offer.quote;
    let now = env.block.time.seconds();
    let old = NAMES.may_load(deps.storage, &q.name)?;
    owner_slot(deps.as_ref(), &env, &q.owner, &q.name)?;
    let expires_at;
    match operation {
        Operation::Register => {
            if q.owner != q.payer || q.ownership_revision != 1 || q.expected_expires_at != 0 {
                return Err(fail(
                    "registration must be authorized and paid by its owner",
                ));
            }
            let next = old.as_ref().map_or(Ok(1), |r| increment(r.generation))?;
            if q.generation != next
                || old
                    .as_ref()
                    .is_some_and(|r| now < r.expires_at.saturating_add(GRACE))
            {
                return Err(fail("name unavailable or generation changed"));
            }
            let hash = commitment(
                &env,
                &q.owner,
                &q.name,
                salt.as_ref()
                    .ok_or_else(|| fail("missing commitment salt"))?,
            )?;
            let c = COMMITS
                .may_load(deps.storage, &q.owner)?
                .ok_or_else(|| fail("missing name commitment"))?;
            if c.hash != hash || env.block.height <= c.height || now >= c.expires_at {
                return Err(fail("commitment mismatch, immature or expired"));
            }
            expires_at = add(now, YEAR * q.years as u64)?;
            if let Some(r) = &old {
                clear_reverse(deps.storage, &r.owner, &q.name)?;
            }
            COMMITS.remove(deps.storage, &q.owner);
            OFFERS.remove(deps.storage, &q.name);
        }
        Operation::Renew => {
            let r = old.ok_or_else(|| fail("unknown name"))?;
            if q.owner != r.owner
                || q.generation != r.generation
                || q.ownership_revision != r.ownership_revision
                || q.expected_expires_at != r.expires_at
            {
                return Err(fail("name identity or expiry changed; request a new quote"));
            }
            if now >= add(r.expires_at, GRACE)? {
                return Err(fail("renewal grace period ended"));
            }
            expires_at = add(now.max(r.expires_at), YEAR * q.years as u64)?;
            if expires_at > add(now, 5 * YEAR)? {
                return Err(fail("renewal exceeds five years remaining"));
            }
        }
    }
    let record = Identity {
        name: q.name.clone(),
        owner: q.owner.clone(),
        generation: q.generation,
        ownership_revision: q.ownership_revision,
        expires_at,
    };
    NAMES.save(deps.storage, &q.name, &record)?;
    REVERSE.save(deps.storage, &q.owner, &q.name)?;
    NONCES.save(deps.storage, (&q.payer, &q.nonce), &true)?;
    // Ordinary submessage: any failed fee forwarding rolls back CW20 payment,
    // commitment consumption, nonce use and identity updates in the same tx.
    Ok(Response::new()
        .add_message(WasmMsg::Execute {
            contract_addr: config.token,
            funds: vec![],
            msg: to_json_binary(&TokenExecute::Transfer {
                recipient: config.treasury,
                amount: receive.amount,
            })?,
        })
        .add_attribute(
            "action",
            if operation == Operation::Register {
                "register_name"
            } else {
                "renew_name"
            },
        )
        .add_attribute("name", q.name.clone())
        .add_attribute("owner", q.owner.clone())
        .add_attribute("generation", q.generation.to_string())
        .add_attribute("ownership_revision", q.ownership_revision.to_string())
        .add_attribute("expires_at", expires_at.to_string())
        .add_attribute("amount", receive.amount))
}

#[entry_point]
pub fn execute(deps: DepsMut, env: Env, info: MessageInfo, msg: ExecuteMsg) -> StdResult<Response> {
    no_funds(&info)?;
    let config = CONFIG.load(deps.storage)?;
    if env.block.chain_id != config.chain_id {
        return Err(fail("registry chain changed"));
    }
    match msg {
        ExecuteMsg::Receive(receive) => pay(deps, env, info, receive),
        ExecuteMsg::Commit { hash } => {
            if !hex64(&hash) {
                return Err(fail("invalid commitment hash"));
            }
            if COMMITS
                .may_load(deps.storage, info.sender.as_str())?
                .is_some_and(|c| env.block.time.seconds() < c.expires_at)
            {
                return Err(fail(
                    "an unexpired commitment already exists; cancel it explicitly",
                ));
            }
            COMMITS.save(
                deps.storage,
                info.sender.as_str(),
                &Commitment {
                    hash,
                    height: env.block.height,
                    expires_at: add(env.block.time.seconds(), COMMIT_TTL)?,
                },
            )?;
            Ok(Response::new().add_attribute("action", "commit_name"))
        }
        ExecuteMsg::CancelCommit { hash } => {
            let c = COMMITS.load(deps.storage, info.sender.as_str())?;
            if c.hash != hash {
                return Err(fail("commitment changed"));
            }
            COMMITS.remove(deps.storage, info.sender.as_str());
            Ok(Response::new().add_attribute("action", "cancel_commitment"))
        }
        ExecuteMsg::OfferTransfer {
            name: input,
            recipient,
            expires_at,
            expected_generation,
            expected_ownership_revision,
        } => {
            let n = name(&input)?;
            let r = NAMES.load(deps.storage, &n)?;
            deps.api.addr_validate(&recipient)?;
            let now = env.block.time.seconds();
            if info.sender.as_str() != r.owner
                || expected_generation != r.generation
                || expected_ownership_revision != r.ownership_revision
            {
                return Err(fail("current name owner and identity required"));
            }
            if recipient == r.owner
                || now >= r.expires_at
                || expires_at <= now
                || expires_at > r.expires_at
                || expires_at > add(now, 7 * 86400)?
            {
                return Err(fail("invalid transfer recipient or expiry"));
            }
            let id = increment(OFFER_IDS.may_load(deps.storage, &n)?.unwrap_or(0))?;
            OFFERS.save(
                deps.storage,
                &n,
                &TransferOffer {
                    id,
                    owner: r.owner,
                    recipient: recipient.clone(),
                    generation: r.generation,
                    ownership_revision: r.ownership_revision,
                    expires_at,
                },
            )?;
            OFFER_IDS.save(deps.storage, &n, &id)?;
            Ok(Response::new()
                .add_attribute("action", "offer_name_transfer")
                .add_attribute("name", n)
                .add_attribute("recipient", recipient)
                .add_attribute("offer_id", id.to_string()))
        }
        ExecuteMsg::AcceptTransfer {
            name: input,
            offer_id,
        } => {
            let n = name(&input)?;
            let o = active_offer(deps.as_ref(), &env, &n)?
                .ok_or_else(|| fail("no active transfer offer"))?;
            if o.id != offer_id || info.sender.as_str() != o.recipient {
                return Err(fail("only the offered recipient may accept this offer"));
            }
            owner_slot(deps.as_ref(), &env, &o.recipient, &n)?;
            let mut r = NAMES.load(deps.storage, &n)?;
            clear_reverse(deps.storage, &r.owner, &n)?;
            r.owner = o.recipient;
            r.ownership_revision = increment(r.ownership_revision)?;
            NAMES.save(deps.storage, &n, &r)?;
            REVERSE.save(deps.storage, &r.owner, &n)?;
            OFFERS.remove(deps.storage, &n);
            Ok(Response::new()
                .add_attribute("action", "accept_name_transfer")
                .add_attribute("name", n)
                .add_attribute("owner", r.owner)
                .add_attribute("generation", r.generation.to_string())
                .add_attribute("ownership_revision", r.ownership_revision.to_string())
                .add_attribute("expires_at", r.expires_at.to_string()))
        }
        ExecuteMsg::CancelTransfer {
            name: input,
            offer_id,
        } => {
            let n = name(&input)?;
            let o = OFFERS.load(deps.storage, &n)?;
            let r = NAMES.load(deps.storage, &n)?;
            if info.sender.as_str() != r.owner
                || o.id != offer_id
                || o.owner != r.owner
                || o.generation != r.generation
                || o.ownership_revision != r.ownership_revision
            {
                return Err(fail("current owner and offer required"));
            }
            OFFERS.remove(deps.storage, &n);
            Ok(Response::new()
                .add_attribute("action", "cancel_name_transfer")
                .add_attribute("name", n))
        }
        ExecuteMsg::SetPurchasesPaused { paused } => {
            admin(&config, info.sender.as_str())?;
            CONFIG.update(deps.storage, |mut c| -> StdResult<_> {
                c.purchases_paused = paused;
                Ok(c)
            })?;
            Ok(Response::new()
                .add_attribute("action", "set_purchases_paused")
                .add_attribute("paused", paused.to_string()))
        }
        ExecuteMsg::RotateQuoteKey {
            public_key,
            expected_version,
        } => {
            admin(&config, info.sender.as_str())?;
            key_valid(&public_key)?;
            if expected_version != config.signer_version {
                return Err(fail("quote signer changed"));
            }
            CONFIG.update(deps.storage, |mut c| -> StdResult<_> {
                c.quote_public_key = public_key;
                c.signer_version = increment(c.signer_version)?;
                Ok(c)
            })?;
            Ok(Response::new().add_attribute("action", "rotate_quote_key"))
        }
        ExecuteMsg::SetTariff {
            tariff,
            expected_version,
        } => {
            admin(&config, info.sender.as_str())?;
            if expected_version != config.tariff_version
                || [tariff.three_cents, tariff.four_cents, tariff.standard_cents].contains(&0)
            {
                return Err(fail("invalid tariff or version changed"));
            }
            CONFIG.update(deps.storage, |mut c| -> StdResult<_> {
                c.tariff = tariff;
                c.tariff_version = increment(c.tariff_version)?;
                Ok(c)
            })?;
            Ok(Response::new().add_attribute("action", "set_tariff"))
        }
    }
}

#[entry_point]
pub fn query(deps: Deps, env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::Config {} => to_json_binary(&CONFIG.load(deps.storage)?),
        QueryMsg::Identity { name: input } => {
            to_json_binary(&NAMES.load(deps.storage, &name(&input)?)?)
        }
        QueryMsg::NameOf { address } => {
            deps.api.addr_validate(&address)?;
            to_json_binary(&NameOfResponse {
                name: active_name(deps, &env, &address)?,
                address,
            })
        }
        QueryMsg::Commitment { address } => {
            deps.api.addr_validate(&address)?;
            to_json_binary(&COMMITS.may_load(deps.storage, &address)?)
        }
        QueryMsg::TransferOffer { name: input } => {
            to_json_binary(&active_offer(deps, &env, &name(&input)?)?)
        }
        QueryMsg::QuotePreimage { quote } => {
            to_json_binary(&quote_preimage(&env, &CONFIG.load(deps.storage)?, &quote))
        }
        QueryMsg::PriceSnapshotPreimage { snapshot } => to_json_binary(&price_snapshot_preimage(
            &env,
            &CONFIG.load(deps.storage)?,
            &snapshot,
        )),
        QueryMsg::Resolve { name: input } => {
            let n = name(&input)?;
            let r = NAMES.may_load(deps.storage, &n)?;
            let now = env.block.time.seconds();
            let active = r.as_ref().is_some_and(|r| now < r.expires_at);
            let in_grace = r
                .as_ref()
                .is_some_and(|r| now >= r.expires_at && now < r.expires_at.saturating_add(GRACE));
            to_json_binary(&ResolveResponse {
                name: n,
                owner: r.as_ref().filter(|_| active).map(|r| r.owner.clone()),
                active,
                in_grace,
                available: !active && !in_grace,
                expires_at: r.as_ref().map(|r| r.expires_at),
                next_generation: r.as_ref().map_or(Ok(1), |r| increment(r.generation))?,
            })
        }
    }
}

#[cfg(test)]
mod tests;
