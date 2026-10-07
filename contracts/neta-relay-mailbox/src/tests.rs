use super::*;
use cosmwasm_std::testing::{mock_dependencies, mock_env, mock_info};
use cosmwasm_std::{from_json, Coin, OwnedDeps};

#[path = "security_tests.rs"]
mod security;

fn env() -> Env {
    let mut env = mock_env();
    env.block.chain_id = "uni-7".into();
    env
}
fn later(seconds: u64) -> Env {
    let mut env = env();
    env.block.time = env.block.time.plus_seconds(seconds);
    env
}

fn prekey(id: u16) -> Prekey {
    Prekey {
        id,
        bundle: Binary::from(vec![7; 64]),
    }
}
fn message_id(id: u8) -> String {
    format!("{id:064x}")
}
fn ciphertext() -> Binary {
    Binary::from(vec![42; 80])
}
fn register(id: &str, prekeys: Vec<Prekey>) -> ExecuteMsg {
    ExecuteMsg::Register {
        expected_previous_generation: None,
        device_id: id.into(),
        protocol_version: 1,
        fingerprint: "ab".repeat(32),
        prekeys,
    }
}

fn setup() -> OwnedDeps<
    cosmwasm_std::testing::MockStorage,
    cosmwasm_std::testing::MockApi,
    cosmwasm_std::testing::MockQuerier,
> {
    let mut deps = mock_dependencies();
    instantiate(
        deps.as_mut(),
        env(),
        mock_info("creator", &[]),
        InstantiateMsg::default(),
    )
    .unwrap();
    execute(
        deps.as_mut(),
        env(),
        mock_info("alice", &[]),
        register("alice-device", vec![prekey(1)]),
    )
    .unwrap();
    execute(
        deps.as_mut(),
        env(),
        mock_info("bob", &[]),
        register("bob-device", vec![prekey(1), prekey(2)]),
    )
    .unwrap();
    execute(
        deps.as_mut(),
        env(),
        mock_info("bob", &[]),
        ExecuteMsg::AllowSender {
            address: "alice".into(),
            recipient_generation: 1,
            sender_generation: 1,
            allowed: true,
        },
    )
    .unwrap();
    deps
}

fn send_initial(id: u8, key: u16, generation: u64) -> ExecuteMsg {
    ExecuteMsg::SendInitial {
        sender_generation: None,
        recipient: "bob".into(),
        recipient_generation: generation,
        prekey_id: key,
        message_id: message_id(id),
        ciphertext: ciphertext(),
    }
}

#[test]
fn initial_message_consumes_prekey_once_and_deduplicates_id() {
    let mut deps = setup();
    execute(
        deps.as_mut(),
        env(),
        mock_info("alice", &[]),
        send_initial(1, 1, 1),
    )
    .unwrap();
    assert_eq!(
        execute(
            deps.as_mut(),
            env(),
            mock_info("alice", &[]),
            send_initial(2, 1, 1)
        ),
        Err(Error::InitialUsed)
    );
    assert_eq!(
        execute(
            deps.as_mut(),
            env(),
            mock_info("alice", &[]),
            send_initial(1, 2, 1)
        ),
        Err(Error::Duplicate)
    );
    let device: Option<Device> = from_json(
        query(
            deps.as_ref(),
            env(),
            QueryMsg::Device {
                address: "bob".into(),
            },
        )
        .unwrap(),
    )
    .unwrap();
    assert_eq!(device.unwrap().prekeys, vec![prekey(2)]);
    let sent: Option<u64> = from_json(
        query(
            deps.as_ref(),
            env(),
            QueryMsg::Sent {
                sender: "alice".into(),
                message_id: message_id(1),
            },
        )
        .unwrap(),
    )
    .unwrap();
    assert_eq!(sent, Some(1));
    let inbox: InboxResponse = from_json(
        query(
            deps.as_ref(),
            env(),
            QueryMsg::Inbox {
                address: "bob".into(),
                after: None,
                limit: None,
            },
        )
        .unwrap(),
    )
    .unwrap();
    assert_eq!(inbox.messages.len(), 1);
    assert_eq!(inbox.messages[0].ciphertext, ciphertext());
}

#[test]
fn device_rotation_rejects_stale_sends_and_revocation() {
    let mut deps = setup();
    execute(
        deps.as_mut(),
        env(),
        mock_info("bob", &[]),
        register("bob-replacement", vec![prekey(1)]),
    )
    .unwrap();
    assert_eq!(
        execute(
            deps.as_mut(),
            env(),
            mock_info("alice", &[]),
            send_initial(1, 1, 1)
        ),
        Err(Error::DeviceChanged)
    );
    assert_eq!(
        execute(
            deps.as_mut(),
            env(),
            mock_info("alice", &[]),
            send_initial(1, 1, 2)
        ),
        Err(Error::Consent)
    );
    execute(
        deps.as_mut(),
        env(),
        mock_info("bob", &[]),
        ExecuteMsg::AllowSender {
            address: "alice".into(),
            recipient_generation: 2,
            sender_generation: 1,
            allowed: true,
        },
    )
    .unwrap();
    execute(
        deps.as_mut(),
        env(),
        mock_info("alice", &[]),
        send_initial(1, 1, 2),
    )
    .unwrap();
    execute(
        deps.as_mut(),
        env(),
        mock_info("bob", &[]),
        ExecuteMsg::Revoke {},
    )
    .unwrap();
    let followup = ExecuteMsg::Send {
        sender_generation: None,
        recipient: "bob".into(),
        recipient_generation: 2,
        message_id: message_id(2),
        ciphertext: ciphertext(),
    };
    assert_eq!(
        execute(deps.as_mut(), env(), mock_info("alice", &[]), followup),
        Err(Error::DeviceChanged)
    );
}

#[test]
fn consumed_ids_cannot_be_republished_and_blocks_work() {
    let mut deps = setup();
    execute(
        deps.as_mut(),
        env(),
        mock_info("alice", &[]),
        send_initial(1, 2, 1),
    )
    .unwrap();
    let republish = ExecuteMsg::AddPrekeys {
        generation: 1,
        prekeys: vec![prekey(2)],
    };
    assert_eq!(
        execute(deps.as_mut(), env(), mock_info("bob", &[]), republish),
        Err(Error::Prekey)
    );
    execute(
        deps.as_mut(),
        env(),
        mock_info("bob", &[]),
        ExecuteMsg::SetBlock {
            address: "alice".into(),
            blocked: true,
        },
    )
    .unwrap();
    assert_eq!(
        execute(
            deps.as_mut(),
            env(),
            mock_info("alice", &[]),
            send_initial(2, 1, 1)
        ),
        Err(Error::Blocked)
    );
    execute(
        deps.as_mut(),
        env(),
        mock_info("bob", &[]),
        ExecuteMsg::SetBlock {
            address: "alice".into(),
            blocked: false,
        },
    )
    .unwrap();
    assert_eq!(
        execute(
            deps.as_mut(),
            env(),
            mock_info("alice", &[]),
            ExecuteMsg::Send {
                sender_generation: None,
                recipient: "bob".into(),
                recipient_generation: 1,
                message_id: message_id(2),
                ciphertext: ciphertext()
            }
        ),
        Err(Error::Cooldown)
    );
    execute(
        deps.as_mut(),
        later(10),
        mock_info("alice", &[]),
        ExecuteMsg::Send {
            sender_generation: None,
            recipient: "bob".into(),
            recipient_generation: 1,
            message_id: message_id(2),
            ciphertext: ciphertext(),
        },
    )
    .unwrap();
    let page: InboxResponse = from_json(
        query(
            deps.as_ref(),
            env(),
            QueryMsg::Inbox {
                address: "bob".into(),
                after: Some(1),
                limit: Some(1),
            },
        )
        .unwrap(),
    )
    .unwrap();
    assert_eq!(page.messages[0].sequence, 2);
}

#[test]
fn rejects_funds_and_wrong_network() {
    let mut deps = setup();
    let mut mainnet = env();
    mainnet.block.chain_id = "juno-1".into();
    assert_eq!(
        execute(
            deps.as_mut(),
            mainnet,
            mock_info("alice", &[]),
            send_initial(1, 1, 1)
        ),
        Err(Error::Network)
    );
    assert_eq!(
        execute(
            deps.as_mut(),
            env(),
            mock_info("alice", &[Coin::new(1, "ujunox")]),
            send_initial(1, 1, 1)
        ),
        Err(Error::Funds)
    );
}

#[test]
fn rotating_accounts_cannot_exhaust_prekeys_without_recipient_consent() {
    let mut deps = setup();
    for index in 0..20 {
        let sender = format!("attacker{index}");
        execute(
            deps.as_mut(),
            env(),
            mock_info(&sender, &[]),
            register("attacker", vec![prekey(1)]),
        )
        .unwrap();
        assert_eq!(
            execute(
                deps.as_mut(),
                env(),
                mock_info(&sender, &[]),
                send_initial(1, 1, 1)
            ),
            Err(Error::Consent)
        );
    }
    let bob = DEVICES
        .load(&deps.storage, &Addr::unchecked("bob"))
        .unwrap();
    assert_eq!(bob.prekeys.len(), 2);
    assert_eq!(NEXT_SEQUENCE.load(&deps.storage).unwrap(), 0);
}

#[test]
fn recipient_consent_cannot_be_granted_by_sender_and_rotation_invalidates_it() {
    let mut deps = setup();
    execute(
        deps.as_mut(),
        env(),
        mock_info("bob", &[]),
        ExecuteMsg::AllowSender {
            address: "alice".into(),
            recipient_generation: 1,
            sender_generation: 1,
            allowed: false,
        },
    )
    .unwrap();
    // Alice granting Bob access changes Alice's own recipient policy only.
    execute(
        deps.as_mut(),
        env(),
        mock_info("alice", &[]),
        ExecuteMsg::AllowSender {
            address: "bob".into(),
            recipient_generation: 1,
            sender_generation: 1,
            allowed: true,
        },
    )
    .unwrap();
    assert_eq!(
        execute(
            deps.as_mut(),
            env(),
            mock_info("alice", &[]),
            send_initial(1, 1, 1)
        ),
        Err(Error::Consent)
    );
    execute(
        deps.as_mut(),
        env(),
        mock_info("bob", &[]),
        ExecuteMsg::AllowSender {
            address: "alice".into(),
            recipient_generation: 1,
            sender_generation: 1,
            allowed: true,
        },
    )
    .unwrap();
    execute(
        deps.as_mut(),
        env(),
        mock_info("alice", &[]),
        register("alice-new", vec![prekey(1)]),
    )
    .unwrap();
    assert_eq!(
        execute(
            deps.as_mut(),
            env(),
            mock_info("alice", &[]),
            send_initial(1, 1, 1)
        ),
        Err(Error::Consent)
    );
    let identity: Option<DeviceIdentity> = from_json(
        query(
            deps.as_ref(),
            env(),
            QueryMsg::HistoricalDevice {
                address: "alice".into(),
                generation: 1,
            },
        )
        .unwrap(),
    )
    .unwrap();
    assert_eq!(identity.unwrap().device_id, "alice-device");
}

#[test]
fn mainnet_requires_explicit_mode_owner_and_keeps_dao_closed() {
    let mut deps = mock_dependencies();
    let mut main = env();
    main.block.chain_id = "juno-1".into();
    assert!(instantiate(
        deps.as_mut(),
        main.clone(),
        mock_info(policy::OWNER, &[]),
        InstantiateMsg::default()
    )
    .is_err());
    assert!(instantiate(
        deps.as_mut(),
        main.clone(),
        mock_info("other", &[]),
        InstantiateMsg { mainnet: true }
    )
    .is_err());
    instantiate(
        deps.as_mut(),
        main.clone(),
        mock_info(policy::OWNER, &[]),
        InstantiateMsg { mainnet: true },
    )
    .unwrap();
    let config: policy::Config =
        from_json(query(deps.as_ref(), main.clone(), QueryMsg::Config {}).unwrap()).unwrap();
    assert_eq!(config.chain_id, "juno-1");
    assert_eq!(config.nns_registry.as_deref(), Some(policy::REGISTRY));
    assert!(execute(
        deps.as_mut(),
        main.clone(),
        mock_info(policy::OWNER, &[]),
        ExecuteMsg::Dao(dao::Execute::BindRegistry {
            address: "otherregistry".into()
        })
    )
    .is_err());
    assert!(query(deps.as_ref(), env(), QueryMsg::Config {}).is_err());
}

#[test]
fn mainnet_requires_current_active_name_but_never_queries_stake() {
    use cosmwasm_std::{ContractResult, SystemResult, WasmQuery};
    let mut main = env();
    main.block.chain_id = "juno-1".into();
    for (active, transferred, missing, unavailable, pass) in [
        (false, false, false, false, false),
        (true, true, false, false, false),
        (true, false, true, false, false),
        (true, false, false, true, false),
        (true, false, false, false, true),
    ] {
        let mut deps = mock_dependencies();
        instantiate(
            deps.as_mut(),
            main.clone(),
            mock_info(policy::OWNER, &[]),
            InstantiateMsg { mainnet: true },
        )
        .unwrap();
        let expires = if active {
            main.block.time.seconds() + 1000
        } else {
            main.block.time.seconds()
        };
        deps.querier.update_wasm(move |query| {
            if let WasmQuery::Smart { contract_addr, msg } = query {
                assert_eq!(
                    contract_addr,
                    policy::REGISTRY,
                    "No staking query is authorized"
                );
                if unavailable {
                    return SystemResult::Ok(ContractResult::Err("registry unavailable".into()));
                }
                let raw = String::from_utf8(msg.to_vec()).unwrap();
                let response = if raw.contains("name_of") {
                    if missing {
                        "{\"address\":\"alice\",\"name\":null}".into()
                    } else {
                        "{\"address\":\"alice\",\"name\":\"alice\"}".into()
                    }
                } else {
                    let owner = if transferred {
                        "different-owner"
                    } else {
                        "alice"
                    };
                    format!("{{\"name\":\"alice\",\"owner\":\"{owner}\",\"expires_at\":{expires}}}")
                };
                SystemResult::Ok(ContractResult::Ok(Binary::from(response.into_bytes())))
            } else {
                SystemResult::Ok(ContractResult::Err("unexpected query".into()))
            }
        });
        for who in ["alice", "bob"] {
            execute(
                deps.as_mut(),
                main.clone(),
                mock_info(who, &[]),
                match register(who, vec![prekey(1)]) {
                    ExecuteMsg::Register {
                        device_id,
                        protocol_version,
                        fingerprint,
                        prekeys,
                        ..
                    } => ExecuteMsg::Register {
                        expected_previous_generation: Some(0),
                        device_id,
                        protocol_version,
                        fingerprint,
                        prekeys,
                    },
                    _ => unreachable!(),
                },
            )
            .unwrap();
        }
        execute(
            deps.as_mut(),
            main.clone(),
            mock_info("bob", &[]),
            ExecuteMsg::AllowSender {
                address: "alice".into(),
                recipient_generation: 1,
                sender_generation: 1,
                allowed: true,
            },
        )
        .unwrap();
        if pass {
            assert_eq!(
                execute(
                    deps.as_mut(),
                    main.clone(),
                    mock_info("alice", &[]),
                    send_initial(9, 1, 1)
                ),
                Err(Error::DeviceChanged)
            );
        }
        let result = execute(
            deps.as_mut(),
            main.clone(),
            mock_info("alice", &[]),
            match send_initial(1, 1, 1) {
                ExecuteMsg::SendInitial {
                    recipient,
                    recipient_generation,
                    prekey_id,
                    message_id,
                    ciphertext,
                    ..
                } => ExecuteMsg::SendInitial {
                    sender_generation: Some(1),
                    recipient,
                    recipient_generation,
                    prekey_id,
                    message_id,
                    ciphertext,
                },
                _ => unreachable!(),
            },
        );
        assert_eq!(result.is_ok(), pass, "{result:?}");
        assert_eq!(
            DEVICES
                .load(&deps.storage, &Addr::unchecked("bob"))
                .unwrap()
                .prekeys
                .len(),
            if pass { 0 } else { 1 }
        );
    }
}

#[test]
fn reviewed_generations_fence_stale_transactions_without_consuming_prekeys() {
    let mut deps = setup();
    let alice = Addr::unchecked("alice");
    let bob = Addr::unchecked("bob");
    let stale_register = ExecuteMsg::Register {
        expected_previous_generation: Some(0),
        device_id: "stale".into(),
        protocol_version: 1,
        fingerprint: "cd".repeat(32),
        prekeys: vec![prekey(8)],
    };
    assert_eq!(
        execute(
            deps.as_mut(),
            env(),
            mock_info("alice", &[]),
            stale_register
        ),
        Err(Error::DeviceChanged)
    );
    assert_eq!(DEVICES.load(&deps.storage, &alice).unwrap().generation, 1);
    let before = DEVICES.load(&deps.storage, &bob).unwrap();
    for initial in [true, false] {
        let msg = if initial {
            ExecuteMsg::SendInitial {
                sender_generation: Some(2),
                recipient: "bob".into(),
                recipient_generation: 1,
                prekey_id: 1,
                message_id: message_id(55),
                ciphertext: ciphertext(),
            }
        } else {
            ExecuteMsg::Send {
                sender_generation: Some(2),
                recipient: "bob".into(),
                recipient_generation: 1,
                message_id: message_id(55),
                ciphertext: ciphertext(),
            }
        };
        assert_eq!(
            execute(deps.as_mut(), env(), mock_info("alice", &[]), msg),
            Err(Error::DeviceChanged)
        );
        assert_eq!(DEVICES.load(&deps.storage, &bob).unwrap(), before);
        assert!(!SENT_IDS.has(&deps.storage, (&alice, &message_id(55))));
        assert_eq!(NEXT_SEQUENCE.load(&deps.storage).unwrap(), 0);
    }
}

#[test]
fn mainnet_register_requires_explicit_previous_generation() {
    let mut deps = mock_dependencies();
    let mut main = env();
    main.block.chain_id = "juno-1".into();
    instantiate(
        deps.as_mut(),
        main.clone(),
        mock_info(policy::OWNER, &[]),
        InstantiateMsg { mainnet: true },
    )
    .unwrap();
    assert_eq!(
        execute(
            deps.as_mut(),
            main,
            mock_info("alice", &[]),
            register("alice", vec![prekey(1)])
        ),
        Err(Error::DeviceChanged)
    );
    assert!(!DEVICES.has(&deps.storage, &Addr::unchecked("alice")));
}
