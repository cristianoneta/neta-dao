use super::*;
use bech32::{ToBase32, Variant};
use cosmwasm_std::testing::{
    mock_dependencies, mock_env, mock_info, MockApi, MockQuerier, MockStorage,
};
use cosmwasm_std::{from_json, ContractResult, Empty, OwnedDeps, SystemResult, WasmQuery};
use k256::ecdsa::{signature::Signer, Signature, SigningKey};
use ripemd::Ripemd160;
use sha2::{Digest, Sha256};
use std::sync::{Arc, Mutex};

type TestDeps = OwnedDeps<MockStorage, MockApi, MockQuerier, Empty>;

#[derive(serde::Deserialize)]
struct FixtureDeployment {
    chain_id: String,
    contract: String,
    registry: String,
}
#[derive(serde::Deserialize)]
struct InteropFixture {
    now: u64,
    deployment: FixtureDeployment,
    profile: Profile,
    pair: Pair,
    expires_at: u64,
    text: String,
    proofs: Vec<Proof>,
}

#[test]
fn cosmjs_adr36_fixture_matches_rust_challenge_and_verification() {
    let fixture: InteropFixture =
        from_json(include_bytes!("../../../tests/fixtures/nns-adr36.json")).unwrap();
    let mut deps = mock_dependencies();
    let mut env = mock_env();
    env.block.chain_id = fixture.deployment.chain_id;
    env.block.time = cosmwasm_std::Timestamp::from_seconds(fixture.now);
    env.contract.address = Addr::unchecked(fixture.deployment.contract);
    REGISTRY
        .save(
            deps.as_mut().storage,
            &Addr::unchecked(fixture.deployment.registry),
        )
        .unwrap();
    let text = challenge(
        deps.as_ref(),
        &env,
        &fixture.profile,
        &fixture.pair,
        fixture.expires_at,
        false,
    )
    .unwrap();
    assert_eq!(text, fixture.text);
    proof::verify(&deps.api, &fixture.pair.mainnet, &text, &fixture.proofs[0]).unwrap();
    proof::verify(&deps.api, &fixture.pair.testnet, &text, &fixture.proofs[1]).unwrap();
}

fn identity_fixture(name: &str) -> Identity {
    Identity {
        name: name.into(),
        owner: "nameowner".into(),
        generation: 1,
        ownership_revision: 1,
        expires_at: mock_env().block.time.seconds() + 100_000,
    }
}

fn setup() -> (TestDeps, Env, Arc<Mutex<Vec<Identity>>>) {
    let mut deps = mock_dependencies();
    let mut env = mock_env();
    env.block.chain_id = "uni-7".into();
    let records = Arc::new(Mutex::new(vec![
        identity_fixture("alice.neta"),
        identity_fixture("other.neta"),
    ]));
    let query_records = records.clone();
    deps.querier.update_wasm(move |request| match request {
        WasmQuery::Smart { contract_addr, msg } if contract_addr == "registry" => {
            let RegistryQuery::Identity { name } = from_json(msg).unwrap();
            match query_records
                .lock()
                .unwrap()
                .iter()
                .find(|p| p.name == name)
            {
                Some(record) => {
                    SystemResult::Ok(ContractResult::Ok(to_json_binary(record).unwrap()))
                }
                None => SystemResult::Ok(ContractResult::Err("unknown name".into())),
            }
        }
        _ => panic!("unexpected registry query"),
    });
    instantiate(
        deps.as_mut(),
        env.clone(),
        mock_info("creator", &[]),
        InstantiateMsg {
            registry: "registry".into(),
        },
    )
    .unwrap();
    (deps, env, records)
}

fn key(n: u8) -> SigningKey {
    SigningKey::from_slice(&[n; 32]).unwrap()
}
fn operator(n: u8, chain: &str) -> Operator {
    let pk = key(n).verifying_key().to_encoded_point(true);
    let hash = Ripemd160::digest(Sha256::digest(pk.as_bytes()));
    Operator {
        chain_id: chain.into(),
        address: bech32::encode("junovaloper", hash.to_base32(), Variant::Bech32).unwrap(),
    }
}
fn pair() -> Pair {
    Pair {
        mainnet: operator(1, "juno-1"),
        testnet: operator(2, "uni-7"),
    }
}
fn sign(n: u8, op: &Operator, text: &str) -> Proof {
    let key = key(n);
    let sig: Signature = key.sign(&proof::sign_bytes(&proof::account(op).unwrap(), text));
    Proof {
        public_key: key.verifying_key().to_encoded_point(true).as_bytes().into(),
        signature: sig.to_bytes().to_vec().into(),
    }
}
fn link(deps: Deps, env: &Env, name: &str, revision: u64) -> ExecuteMsg {
    let pair = pair();
    let expires_at = env.block.time.seconds() + 300;
    let text = challenge(
        deps,
        env,
        &current(deps, env, name, revision).unwrap(),
        &pair,
        expires_at,
        false,
    )
    .unwrap();
    ExecuteMsg::LinkValidators {
        name: name.into(),
        expected_revision: revision,
        expires_at,
        mainnet_proof: sign(1, &pair.mainnet, &text),
        testnet_proof: sign(2, &pair.testnet, &text),
        pair,
    }
}
fn execute_owner(deps: &mut TestDeps, env: &Env, msg: ExecuteMsg) -> StdResult<Response> {
    execute(deps.as_mut(), env.clone(), mock_info("nameowner", &[]), msg)
}

#[test]
fn valid_two_key_link_and_replay_guard() {
    let (mut deps, env, _) = setup();
    let msg = link(deps.as_ref(), &env, "alice.neta", 0);
    execute_owner(&mut deps, &env, msg.clone()).unwrap();
    let result = binding(deps.as_ref(), &env, &pair().testnet)
        .unwrap()
        .unwrap();
    assert_eq!(result.identity.name, "alice.neta");
    assert_eq!(result.revision, 1);
    assert!(execute_owner(&mut deps, &env, msg).is_err());
}

#[test]
fn wrong_wallet_forgery_and_pair_tampering_fail() {
    let (mut deps, env, _) = setup();
    let valid = link(deps.as_ref(), &env, "alice.neta", 0);
    assert!(execute(
        deps.as_mut(),
        env.clone(),
        mock_info("attacker", &[]),
        valid.clone()
    )
    .is_err());
    let mut forged = valid.clone();
    if let ExecuteMsg::LinkValidators { testnet_proof, .. } = &mut forged {
        testnet_proof.signature = vec![0; 64].into();
    }
    assert!(execute_owner(&mut deps, &env, forged).is_err());
    let mut changed = valid;
    if let ExecuteMsg::LinkValidators { pair, .. } = &mut changed {
        pair.testnet = operator(3, "uni-7");
    }
    assert!(execute_owner(&mut deps, &env, changed).is_err());
    assert!(binding(deps.as_ref(), &env, &pair().mainnet)
        .unwrap()
        .is_none());
}

#[test]
fn proof_is_bound_to_chain_contract_registry_and_name() {
    for change in 0..4 {
        let (mut deps, mut env, _) = setup();
        let mut msg = link(deps.as_ref(), &env, "alice.neta", 0);
        match change {
            0 => env.block.chain_id = "juno-1".into(),
            1 => env.contract.address = Addr::unchecked("othercontract"),
            2 => {
                REGISTRY
                    .save(deps.as_mut().storage, &Addr::unchecked("anotherregistry"))
                    .unwrap();
                let i = identity_fixture("alice.neta");
                deps.querier.update_wasm(move |_| {
                    SystemResult::Ok(ContractResult::Ok(to_json_binary(&i).unwrap()))
                });
            }
            _ => {
                if let ExecuteMsg::LinkValidators { name, .. } = &mut msg {
                    *name = "other.neta".into();
                }
            }
        }
        assert!(execute_owner(&mut deps, &env, msg).is_err());
    }
}

#[test]
fn duplicate_testnet_or_mainnet_cannot_credit_two_names() {
    let (mut deps, env, _) = setup();
    let first = link(deps.as_ref(), &env, "alice.neta", 0);
    execute_owner(&mut deps, &env, first).unwrap();
    let other = link(deps.as_ref(), &env, "other.neta", 0);
    assert!(execute_owner(&mut deps, &env, other)
        .unwrap_err()
        .to_string()
        .contains("already linked"));
    assert_eq!(
        binding(deps.as_ref(), &env, &pair().testnet)
            .unwrap()
            .unwrap()
            .identity
            .name,
        "alice.neta"
    );
}

#[test]
fn expired_name_loses_eligibility_and_releases_binding() {
    let (mut deps, env, records) = setup();
    let first = link(deps.as_ref(), &env, "alice.neta", 0);
    execute_owner(&mut deps, &env, first).unwrap();
    records.lock().unwrap()[0].expires_at = env.block.time.seconds();
    assert!(
        !load_current(deps.as_ref(), &env, "alice.neta")
            .unwrap()
            .active
    );
    assert!(binding(deps.as_ref(), &env, &pair().testnet)
        .unwrap()
        .is_none());
    let other = link(deps.as_ref(), &env, "other.neta", 0);
    execute_owner(&mut deps, &env, other).unwrap();
    assert_eq!(
        binding(deps.as_ref(), &env, &pair().testnet)
            .unwrap()
            .unwrap()
            .identity
            .name,
        "other.neta"
    );
    records.lock().unwrap()[0].expires_at = env.block.time.seconds() + 1000;
    assert!(load_current(deps.as_ref(), &env, "alice.neta")
        .unwrap()
        .profile
        .unwrap()
        .validators
        .is_none());
}

#[test]
fn transfer_and_reregistration_clear_profile_and_invalidate_old_proofs() {
    for reassign in [false, true] {
        let (mut deps, env, records) = setup();
        let first = link(deps.as_ref(), &env, "alice.neta", 0);
        execute_owner(&mut deps, &env, first).unwrap();
        let stale = link(deps.as_ref(), &env, "alice.neta", 1);
        if reassign {
            records.lock().unwrap()[0].generation += 1;
        } else {
            records.lock().unwrap()[0].ownership_revision += 1;
        }
        let p = load_current(deps.as_ref(), &env, "alice.neta")
            .unwrap()
            .profile
            .unwrap();
        assert!(p.validators.is_none());
        assert_eq!(p.contacts, Contacts::default());
        assert!(p.revision > 1);
        assert!(execute_owner(&mut deps, &env, stale).is_err());
        assert!(binding(deps.as_ref(), &env, &pair().testnet)
            .unwrap()
            .is_none());
    }
}

#[test]
fn operator_can_revoke_without_name_owner_and_cannot_replay() {
    let (mut deps, env, _) = setup();
    let first = link(deps.as_ref(), &env, "alice.neta", 0);
    execute_owner(&mut deps, &env, first).unwrap();
    let p = current(deps.as_ref(), &env, "alice.neta", 1).unwrap();
    let expires_at = env.block.time.seconds() + 300;
    let text = challenge(deps.as_ref(), &env, &p, &pair(), expires_at, true).unwrap();
    let msg = ExecuteMsg::RevokeByOperator {
        name: "alice.neta".into(),
        expected_revision: 1,
        expires_at,
        operator: pair().testnet,
        proof: sign(2, &pair().testnet, &text),
    };
    execute(
        deps.as_mut(),
        env.clone(),
        mock_info("relaywallet", &[]),
        msg.clone(),
    )
    .unwrap();
    assert!(binding(deps.as_ref(), &env, &pair().testnet)
        .unwrap()
        .is_none());
    assert!(execute(deps.as_mut(), env, mock_info("relaywallet", &[]), msg).is_err());
}

#[test]
fn owner_unlink_releases_both_indexes() {
    let (mut deps, env, _) = setup();
    let first = link(deps.as_ref(), &env, "alice.neta", 0);
    execute_owner(&mut deps, &env, first).unwrap();
    execute_owner(
        &mut deps,
        &env,
        ExecuteMsg::UnlinkValidators {
            name: "alice.neta".into(),
            expected_revision: 1,
        },
    )
    .unwrap();
    for op in [&pair().mainnet, &pair().testnet] {
        assert!(binding(deps.as_ref(), &env, op).unwrap().is_none());
    }
}

#[test]
fn proof_expiry_and_supported_address_roles_are_enforced() {
    let (mut deps, mut env, _) = setup();
    let first = link(deps.as_ref(), &env, "alice.neta", 0);
    env.block.time = env.block.time.plus_seconds(300);
    assert!(execute_owner(&mut deps, &env, first).is_err());
    let mut op = pair().testnet;
    op.address = proof::account(&op).unwrap();
    assert!(proof::account(&op).is_err());
    op = pair().testnet;
    op.chain_id = "unknown".into();
    assert!(proof::account(&op).is_err());
}

#[test]
fn contacts_are_owner_only_versioned_and_reject_unsafe_values() {
    let (mut deps, env, _) = setup();
    let contacts = Contacts {
        description: "Validator operator".into(),
        discord: "operator.1".into(),
        telegram: "operator".into(),
        twitter: "operator".into(),
        email: "team@example.org".into(),
        website: "https://example.org".into(),
    };
    let msg = ExecuteMsg::UpdateContacts {
        name: "alice.neta".into(),
        expected_revision: 0,
        contacts: contacts.clone(),
    };
    assert!(execute(
        deps.as_mut(),
        env.clone(),
        mock_info("outsider", &[]),
        msg.clone()
    )
    .is_err());
    execute_owner(&mut deps, &env, msg.clone()).unwrap();
    assert!(execute_owner(&mut deps, &env, msg).is_err());
    for value in [
        "javascript:alert(1)",
        "https://user@example.org",
        "https://example.org\nattack",
    ] {
        let mut c = contacts.clone();
        c.website = value.into();
        assert!(contacts_valid(&c).is_err());
    }
    let mut c = contacts;
    c.email = "team@example.org?bcc=other".into();
    assert!(contacts_valid(&c).is_err());
}

#[test]
fn registry_failure_is_not_absence_or_permission_to_claim() {
    let (mut deps, env, _) = setup();
    let first = link(deps.as_ref(), &env, "alice.neta", 0);
    execute_owner(&mut deps, &env, first).unwrap();
    deps.querier
        .update_wasm(|_| SystemResult::Ok(ContractResult::Err("registry offline".into())));
    assert!(binding(deps.as_ref(), &env, &pair().testnet).is_err());
}
