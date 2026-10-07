//! Adversarial regression evidence for the exact v0.4 personal-mainnet candidate.
//! MockStorage checks pre-write rejection, not Cosmos transaction rollback/gas.
use super::*;
use cosmwasm_std::{ContractResult, Storage, SystemResult, WasmQuery};

type Dependencies = OwnedDeps<
    cosmwasm_std::testing::MockStorage,
    cosmwasm_std::testing::MockApi,
    cosmwasm_std::testing::MockQuerier,
>;

#[derive(Clone, Copy)]
enum RegistryCase {
    Active,
    Missing,
    Expired,
    Transferred,
    WrongAddress,
    WrongName,
    Unavailable,
}

#[derive(Deserialize)]
#[serde(rename_all = "snake_case")]
enum RegistryQuery {
    NameOf { address: String },
    Identity { name: String },
}

fn main_env() -> Env {
    let mut e = env();
    e.block.chain_id = "juno-1".into();
    e
}

fn main_register(who: &str, previous: u64) -> ExecuteMsg {
    ExecuteMsg::Register {
        expected_previous_generation: Some(previous),
        device_id: format!("{who}-device"),
        protocol_version: 1,
        fingerprint: "ab".repeat(32),
        prekeys: vec![prekey(1), prekey(2)],
    }
}

fn registry(deps: &mut Dependencies, case: RegistryCase) {
    deps.querier.update_wasm(move |q| {
        let WasmQuery::Smart { contract_addr, msg } = q else {
            panic!("unexpected external query");
        };
        assert_eq!(contract_addr, policy::REGISTRY);
        if matches!(case, RegistryCase::Unavailable) {
            return SystemResult::Ok(ContractResult::Err("unavailable".into()));
        }
        let json = match from_json::<RegistryQuery>(msg).unwrap() {
            RegistryQuery::NameOf { address } => {
                let name = if matches!(case, RegistryCase::Missing) {
                    "null".into()
                } else {
                    format!("\"{address}\"")
                };
                let address = if matches!(case, RegistryCase::WrongAddress) {
                    "mallory".into()
                } else {
                    address
                };
                format!("{{\"address\":\"{address}\",\"name\":{name}}}")
            }
            RegistryQuery::Identity { name } => {
                let owner = if matches!(case, RegistryCase::Transferred) {
                    "mallory"
                } else {
                    &name
                };
                let identity = if matches!(case, RegistryCase::WrongName) {
                    "another-name"
                } else {
                    &name
                };
                let expiry = main_env().block.time.seconds()
                    + if matches!(case, RegistryCase::Expired) {
                        0
                    } else {
                        100_000
                    };
                format!("{{\"name\":\"{identity}\",\"owner\":\"{owner}\",\"expires_at\":{expiry}}}")
            }
        };
        SystemResult::Ok(ContractResult::Ok(Binary::from(json.into_bytes())))
    });
}

fn fixture() -> Dependencies {
    let mut deps = mock_dependencies();
    instantiate(
        deps.as_mut(),
        main_env(),
        mock_info(policy::OWNER, &[]),
        InstantiateMsg { mainnet: true },
    )
    .unwrap();
    registry(&mut deps, RegistryCase::Active);
    for who in ["alice", "bob", "mallory"] {
        execute(
            deps.as_mut(),
            main_env(),
            mock_info(who, &[]),
            main_register(who, 0),
        )
        .unwrap();
    }
    deps
}

fn grant(deps: &mut Dependencies, sender_generation: u64) {
    execute(
        deps.as_mut(),
        main_env(),
        mock_info("bob", &[]),
        ExecuteMsg::AllowSender {
            address: "alice".into(),
            recipient_generation: 1,
            sender_generation,
            allowed: true,
        },
    )
    .unwrap();
}

fn packet(id: u8, generation: u64, initial: bool) -> ExecuteMsg {
    if initial {
        ExecuteMsg::SendInitial {
            sender_generation: Some(generation),
            recipient: "bob".into(),
            recipient_generation: 1,
            prekey_id: 1,
            message_id: message_id(id),
            ciphertext: ciphertext(),
        }
    } else {
        ExecuteMsg::Send {
            sender_generation: Some(generation),
            recipient: "bob".into(),
            recipient_generation: 1,
            message_id: message_id(id),
            ciphertext: ciphertext(),
        }
    }
}

fn state(deps: &Dependencies) -> Vec<(Vec<u8>, Vec<u8>)> {
    deps.storage.range(None, None, Order::Ascending).collect()
}

fn rejected_unchanged(deps: &mut Dependencies, who: &str, msg: ExecuteMsg) {
    let before = state(deps);
    assert!(execute(deps.as_mut(), main_env(), mock_info(who, &[]), msg).is_err());
    assert_eq!(state(deps), before);
}

#[test]
fn every_dao_write_route_is_closed_on_mainnet_even_to_owner() {
    let mut deps = fixture();
    for json in [
        r#"{"dao":{"bind_registry":{"address":"other"}}}"#,
        r#"{"dao":{"register_dao":{"name":"neta.dao.neta","authority":"alice","group":"group"}}}"#,
        r#"{"dao":{"configure":{"name":"neta.dao.neta","expected_revision":1,"enabled":true,"readers":{"selected":[]},"managers":[]}}}"#,
        r#"{"dao":{"set_block":{"name":"neta.dao.neta","address":"alice","blocked":false,"expected_revision":1}}}"#,
        r#"{"dao":{"assign":{"name":"neta.dao.neta","correspondent":"alice","expected_revision":1,"take":true}}}"#,
        r#"{"dao":{"send":{"name":"neta.dao.neta","expected_revision":1,"sender_generation":1,"message_id":"x","reply_to":null,"expected_thread_revision":null,"deliveries":[]}}}"#,
    ] {
        for who in [policy::OWNER, "mallory"] {
            let msg: ExecuteMsg = from_json(json.as_bytes()).unwrap();
            let before = state(&deps);
            let error = execute(deps.as_mut(), main_env(), mock_info(who, &[]), msg)
                .unwrap_err()
                .to_string();
            assert!(error.contains("DAO mailboxes not enabled"));
            assert_eq!(state(&deps), before);
        }
    }
}

#[test]
fn copied_device_labels_do_not_take_over_another_wallet_or_its_consent() {
    let mut deps = fixture();
    let bob = DEVICES
        .load(&deps.storage, &Addr::unchecked("bob"))
        .unwrap();
    execute(
        deps.as_mut(),
        main_env(),
        mock_info("mallory", &[]),
        main_register("bob", 1),
    )
    .unwrap();
    assert_eq!(
        DEVICES
            .load(&deps.storage, &Addr::unchecked("bob"))
            .unwrap(),
        bob
    );
    // Mallory's permission is scoped to Mallory's inbox; it cannot grant Bob's.
    execute(
        deps.as_mut(),
        main_env(),
        mock_info("mallory", &[]),
        ExecuteMsg::AllowSender {
            address: "alice".into(),
            recipient_generation: 2,
            sender_generation: 1,
            allowed: true,
        },
    )
    .unwrap();
    for initial in [true, false] {
        rejected_unchanged(&mut deps, "alice", packet(1, 1, initial));
    }
}

#[test]
fn every_nns_failure_rejects_initial_and_followup_without_state_changes() {
    for case in [
        RegistryCase::Missing,
        RegistryCase::Expired,
        RegistryCase::Transferred,
        RegistryCase::WrongAddress,
        RegistryCase::WrongName,
        RegistryCase::Unavailable,
    ] {
        let mut deps = fixture();
        grant(&mut deps, 1);
        registry(&mut deps, case);
        for initial in [true, false] {
            rejected_unchanged(&mut deps, "alice", packet(1, 1, initial));
        }
    }
}

#[test]
fn permissions_and_blocklists_are_checked_for_followups_too() {
    let mut deps = fixture();
    grant(&mut deps, 1);
    for blocked in [true, false] {
        execute(
            deps.as_mut(),
            main_env(),
            mock_info("bob", &[]),
            ExecuteMsg::SetBlock {
                address: "alice".into(),
                blocked,
            },
        )
        .unwrap();
        if !blocked {
            execute(
                deps.as_mut(),
                main_env(),
                mock_info("bob", &[]),
                ExecuteMsg::AllowSender {
                    address: "alice".into(),
                    recipient_generation: 1,
                    sender_generation: 1,
                    allowed: false,
                },
            )
            .unwrap();
        }
        for initial in [true, false] {
            rejected_unchanged(&mut deps, "alice", packet(1, 1, initial));
        }
    }
}

#[test]
fn rotation_cannot_reset_cooldown_or_reuse_sender_message_ids() {
    let mut deps = fixture();
    grant(&mut deps, 1);
    execute(
        deps.as_mut(),
        main_env(),
        mock_info("alice", &[]),
        packet(1, 1, true),
    )
    .unwrap();
    execute(
        deps.as_mut(),
        main_env(),
        mock_info("alice", &[]),
        main_register("alice", 1),
    )
    .unwrap();
    grant(&mut deps, 2);
    let mut e = main_env();
    e.block.time = e.block.time.plus_seconds(9);
    let before = state(&deps);
    assert_eq!(
        execute(
            deps.as_mut(),
            e,
            mock_info("alice", &[]),
            packet(2, 2, false)
        ),
        Err(Error::Cooldown)
    );
    assert_eq!(state(&deps), before);
    let mut e = main_env();
    e.block.time = e.block.time.plus_seconds(10);
    assert_eq!(
        execute(
            deps.as_mut(),
            e.clone(),
            mock_info("alice", &[]),
            packet(1, 2, false)
        ),
        Err(Error::Duplicate)
    );
    assert_eq!(state(&deps), before);
    execute(
        deps.as_mut(),
        e,
        mock_info("alice", &[]),
        packet(2, 2, false),
    )
    .unwrap();
}

#[test]
fn exhausted_counters_fail_closed_without_prekey_consumption() {
    let mut deps = fixture();
    grant(&mut deps, 1);
    NEXT_SEQUENCE.save(&mut deps.storage, &u64::MAX).unwrap();
    rejected_unchanged(&mut deps, "alice", packet(1, 1, true));
    DEVICES
        .update(
            &mut deps.storage,
            &Addr::unchecked("alice"),
            |d| -> StdResult<_> {
                let mut d = d.unwrap();
                d.generation = u64::MAX;
                Ok(d)
            },
        )
        .unwrap();
    rejected_unchanged(&mut deps, "alice", main_register("alice", u64::MAX));
    rejected_unchanged(&mut deps, "alice", ExecuteMsg::Revoke {});
}

#[test]
fn all_personal_routes_reject_attached_funds_before_changing_state() {
    let mut deps = fixture();
    for msg in [
        main_register("alice", 1),
        ExecuteMsg::Revoke {},
        ExecuteMsg::AddPrekeys {
            generation: 1,
            prekeys: vec![prekey(3)],
        },
        ExecuteMsg::SetBlock {
            address: "bob".into(),
            blocked: true,
        },
        ExecuteMsg::AllowSender {
            address: "bob".into(),
            recipient_generation: 1,
            sender_generation: 1,
            allowed: true,
        },
        packet(1, 1, true),
        packet(1, 1, false),
    ] {
        let before = state(&deps);
        assert_eq!(
            execute(
                deps.as_mut(),
                main_env(),
                mock_info("alice", &[Coin::new(1, "ujuno")]),
                msg
            ),
            Err(Error::Funds)
        );
        assert_eq!(state(&deps), before);
    }
}

#[test]
fn pagination_bounds_hold_as_ciphertext_history_grows() {
    let mut deps = fixture();
    grant(&mut deps, 1);
    for id in 1..=55 {
        let mut e = main_env();
        e.block.time = e.block.time.plus_seconds(u64::from(id) * 10);
        execute(
            deps.as_mut(),
            e,
            mock_info("alice", &[]),
            packet(id, 1, id == 1),
        )
        .unwrap();
    }
    for (after, limit, expected, first) in [
        (None, None, 20, 1),
        (None, Some(u32::MAX), 50, 1),
        (Some(50), Some(u32::MAX), 5, 51),
        (Some(u64::MAX), Some(50), 0, 0),
        (None, Some(0), 0, 0),
    ] {
        let page: InboxResponse = from_json(
            query(
                deps.as_ref(),
                main_env(),
                QueryMsg::Inbox {
                    address: "bob".into(),
                    after,
                    limit,
                },
            )
            .unwrap(),
        )
        .unwrap();
        assert_eq!(page.messages.len(), expected);
        if expected > 0 {
            assert_eq!(page.messages[0].sequence, first);
        }
    }
}

#[test]
fn malformed_payloads_and_oversized_prekey_batches_leave_no_partial_state() {
    let mut deps = fixture();
    grant(&mut deps, 1);
    for prekeys in [
        vec![],
        vec![prekey(3), prekey(3)],
        (3..20).map(prekey).collect(),
        vec![Prekey {
            id: 3,
            bundle: Binary::from(vec![0; 31]),
        }],
        vec![Prekey {
            id: 3,
            bundle: Binary::from(vec![0; 1025]),
        }],
        vec![prekey(1), prekey(3)],
    ] {
        rejected_unchanged(
            &mut deps,
            "alice",
            ExecuteMsg::AddPrekeys {
                generation: 1,
                prekeys,
            },
        );
    }
    for size in [0, 15, 4097] {
        rejected_unchanged(
            &mut deps,
            "alice",
            ExecuteMsg::SendInitial {
                sender_generation: Some(1),
                recipient: "bob".into(),
                recipient_generation: 1,
                prekey_id: 1,
                message_id: message_id(1),
                ciphertext: Binary::from(vec![0; size]),
            },
        );
    }
    for sender_generation in [None, Some(0), Some(2)] {
        rejected_unchanged(
            &mut deps,
            "alice",
            ExecuteMsg::Send {
                sender_generation,
                recipient: "bob".into(),
                recipient_generation: 1,
                message_id: message_id(1),
                ciphertext: ciphertext(),
            },
        );
    }
    for id in ["a".repeat(63), "A".repeat(64), "g".repeat(64)] {
        rejected_unchanged(
            &mut deps,
            "alice",
            ExecuteMsg::Send {
                sender_generation: Some(1),
                recipient: "bob".into(),
                recipient_generation: 1,
                message_id: id,
                ciphertext: ciphertext(),
            },
        );
    }
}

#[test]
fn nns_eligibility_gates_sending_not_registration_or_historical_storage() {
    let mut deps = fixture();
    registry(&mut deps, RegistryCase::Missing);
    // This records an explicit capacity boundary, not proof of paid registration.
    for previous in 1..=10 {
        execute(
            deps.as_mut(),
            main_env(),
            mock_info("alice", &[]),
            main_register("alice", previous),
        )
        .unwrap();
    }
    assert_eq!(
        IDENTITIES
            .prefix(&Addr::unchecked("alice"))
            .range(&deps.storage, None, None, Order::Ascending)
            .count(),
        11
    );
    grant(&mut deps, 11);
    rejected_unchanged(&mut deps, "alice", packet(1, 11, false));
}
