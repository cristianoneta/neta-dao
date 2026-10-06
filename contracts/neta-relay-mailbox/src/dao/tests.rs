use super::*;
use cosmwasm_std::testing::{
    mock_dependencies, mock_env, mock_info, MockApi, MockQuerier, MockStorage,
};
use cosmwasm_std::{from_json, ContractResult, OwnedDeps, SystemResult, WasmQuery};
use std::sync::{Arc, Mutex};

type DepsOwned = OwnedDeps<MockStorage, MockApi, MockQuerier>;
const NAME: &str = "operations.dao.neta";
#[derive(Default)]
struct Chain {
    members: Vec<String>,
    named: Vec<String>,
    stale_name: bool,
    unavailable: bool,
}
fn env() -> Env {
    let mut e = mock_env();
    e.block.chain_id = "uni-7".into();
    e
}
fn call(deps: &mut DepsOwned, who: &str, msg: Execute) -> Result<Response, Error> {
    crate::execute(
        deps.as_mut(),
        env(),
        mock_info(who, &[]),
        ExecuteMsg::Dao(msg),
    )
}
fn setup() -> (DepsOwned, Arc<Mutex<Chain>>) {
    let mut deps = mock_dependencies();
    crate::instantiate(
        deps.as_mut(),
        env(),
        mock_info("registrar", &[]),
        InstantiateMsg {},
    )
    .unwrap();
    let state = Arc::new(Mutex::new(Chain {
        members: vec!["bob".into(), "carol".into()],
        named: vec!["alice".into(), "bob".into(), "carol".into()],
        ..Default::default()
    }));
    let shared = state.clone();
    deps.querier.update_wasm(move |q| {
        let s = shared.lock().unwrap();
        let WasmQuery::Smart { contract_addr, msg } = q else {
            panic!("unexpected query")
        };
        if s.unavailable {
            return SystemResult::Ok(ContractResult::Err("unavailable".into()));
        }
        let result = if contract_addr == "registry" {
            match from_json::<NameQueryTest>(msg).unwrap() {
                NameQueryTest::NameOf { address } => to_json_binary(&NameOfTest {
                    name: s
                        .named
                        .contains(&address)
                        .then(|| format!("{address}.neta")),
                    address,
                })
                .unwrap(),
                NameQueryTest::Identity { name } => to_json_binary(&IdentityTest {
                    owner: if s.stale_name {
                        "mallory".into()
                    } else {
                        name.trim_end_matches(".neta").into()
                    },
                    name,
                    expires_at: env().block.time.seconds() + 1000,
                })
                .unwrap(),
            }
        } else if contract_addr == "group" {
            match from_json::<GroupQueryTest>(msg).unwrap() {
                GroupQueryTest::Member { addr } => to_json_binary(&MemberResultTest {
                    weight: s.members.contains(&addr).then_some(1),
                })
                .unwrap(),
                GroupQueryTest::ListMembers { start_after, limit } => {
                    to_json_binary(&MembersResultTest {
                        members: s
                            .members
                            .iter()
                            .filter(|a| start_after.as_ref().map_or(true, |v| *a > v))
                            .take(limit as usize)
                            .map(|a| MemberTest {
                                addr: a.clone(),
                                weight: 1,
                            })
                            .collect(),
                    })
                    .unwrap()
                }
            }
        } else {
            panic!("unexpected contract")
        };
        SystemResult::Ok(ContractResult::Ok(result))
    });
    for who in ["alice", "bob", "carol", "dave"] {
        crate::execute(
            deps.as_mut(),
            env(),
            mock_info(who, &[]),
            ExecuteMsg::Register {
                device_id: format!("{who}-device"),
                protocol_version: 1,
                fingerprint: "ab".repeat(32),
                prekeys: (1..=4)
                    .map(|id| Prekey {
                        id,
                        bundle: Binary::from(vec![7; 64]),
                    })
                    .collect(),
            },
        )
        .unwrap();
    }
    call(
        &mut deps,
        "registrar",
        Execute::BindRegistry {
            address: "registry".into(),
        },
    )
    .unwrap();
    call(
        &mut deps,
        "registrar",
        Execute::RegisterDao {
            name: NAME.into(),
            authority: "dao-core".into(),
            group: "group".into(),
        },
    )
    .unwrap();
    (deps, state)
}
#[derive(Deserialize)]
#[serde(rename_all = "snake_case")]
enum NameQueryTest {
    NameOf { address: String },
    Identity { name: String },
}
#[derive(Serialize)]
struct NameOfTest {
    address: String,
    name: Option<String>,
}
#[derive(Serialize)]
struct IdentityTest {
    name: String,
    owner: String,
    expires_at: u64,
}
#[derive(Deserialize)]
#[serde(rename_all = "snake_case")]
enum GroupQueryTest {
    Member {
        addr: String,
    },
    ListMembers {
        start_after: Option<String>,
        limit: u32,
    },
}
#[derive(Serialize)]
struct MemberResultTest {
    weight: Option<u64>,
}
#[derive(Serialize)]
struct MemberTest {
    addr: String,
    weight: u64,
}
#[derive(Serialize)]
struct MembersResultTest {
    members: Vec<MemberTest>,
}
fn configure(selection: Readers, enabled: bool, revision: u64) -> Execute {
    Execute::Configure {
        name: NAME.into(),
        expected_revision: revision,
        enabled,
        readers: selection,
        managers: vec!["bob".into()],
    }
}
fn selected() -> Readers {
    Readers::Selected(vec![Addr::unchecked("bob"), Addr::unchecked("carol")])
}
fn enable(deps: &mut DepsOwned) {
    call(deps, "dao-core", configure(selected(), true, 1)).unwrap();
}
fn packet(who: &str) -> Delivery {
    Delivery {
        recipient: Addr::unchecked(who),
        generation: 1,
        fingerprint: "ab".repeat(32),
        prekey_id: Some(1),
        ciphertext: Binary::from(vec![42; 80]),
    }
}
fn send(id: u8, deliveries: Vec<Delivery>) -> Execute {
    Execute::Send {
        name: NAME.into(),
        expected_revision: 2,
        sender_generation: 1,
        message_id: format!("{id:064x}"),
        reply_to: None,
        expected_thread_revision: None,
        deliveries,
    }
}
fn inboxes(deps: &DepsOwned, address: &str) -> MailboxPage {
    from_json(
        query(
            deps.as_ref(),
            Query::Mailboxes {
                address: address.into(),
                after: None,
                limit: None,
            },
        )
        .unwrap(),
    )
    .unwrap()
}

#[test]
fn disabled_by_default_and_only_dao_can_opt_in() {
    let (mut d, _) = setup();
    assert!(!DAOS.load(&d.storage, NAME).unwrap().enabled);
    assert!(inboxes(&d, "bob").items.is_empty());
    assert!(call(&mut d, "registrar", configure(selected(), true, 1)).is_err());
    assert!(call(&mut d, "bob", configure(selected(), true, 1)).is_err());
    assert!(call(
        &mut d,
        "alice",
        send(1, vec![packet("bob"), packet("carol")])
    )
    .is_err());
    enable(&mut d);
    assert_eq!(inboxes(&d, "bob").items.len(), 1);
    assert!(inboxes(&d, "alice").items.is_empty());
}
#[test]
fn dao_names_are_curated_reserved_and_immutable() {
    let (mut d, _) = setup();
    for name in [NAME, "other.dao.neta", "fake.neta", "Bad.dao.neta"] {
        assert!(call(
            &mut d,
            "alice",
            Execute::RegisterDao {
                name: name.into(),
                authority: "alice".into(),
                group: "group".into()
            }
        )
        .is_err());
    }
    assert!(call(
        &mut d,
        "registrar",
        Execute::RegisterDao {
            name: NAME.into(),
            authority: "other-dao".into(),
            group: "group".into()
        }
    )
    .is_err());
    assert!(call(
        &mut d,
        "registrar",
        Execute::BindRegistry {
            address: "other-registry".into()
        }
    )
    .is_err());
    assert_eq!(
        DAOS.load(&d.storage, NAME).unwrap().authority,
        Addr::unchecked("dao-core")
    );
}
#[test]
fn shared_record_and_atomic_prekey_consumption() {
    let (mut d, _) = setup();
    enable(&mut d);
    call(
        &mut d,
        "alice",
        send(1, vec![packet("bob"), packet("carol")]),
    )
    .unwrap();
    let records: Vec<Record> = from_json(
        query(
            d.as_ref(),
            Query::Inbox {
                name: NAME.into(),
                after: None,
                limit: None,
            },
        )
        .unwrap(),
    )
    .unwrap();
    assert_eq!(records.len(), 1);
    assert_eq!(records[0].deliveries.len(), 2);
    assert_eq!(
        INBOX
            .prefix(&Addr::unchecked("bob"))
            .range(&d.storage, None, None, Order::Ascending)
            .count(),
        0
    );
    assert_eq!(
        DEVICES
            .load(&d.storage, &Addr::unchecked("bob"))
            .unwrap()
            .prekeys
            .len(),
        3
    );
    assert!(call(
        &mut d,
        "alice",
        send(1, vec![packet("bob"), packet("carol")])
    )
    .is_err());
}
#[test]
fn departure_rejects_old_roster_and_removes_access_without_policy_edit() {
    let (mut d, s) = setup();
    enable(&mut d);
    s.lock().unwrap().members.retain(|a| a != "carol");
    assert!(inboxes(&d, "carol").items.is_empty());
    assert!(call(
        &mut d,
        "alice",
        send(1, vec![packet("bob"), packet("carol")])
    )
    .is_err());
    assert_eq!(
        DEVICES
            .load(&d.storage, &Addr::unchecked("bob"))
            .unwrap()
            .prekeys
            .len(),
        4
    );
    call(&mut d, "alice", send(2, vec![packet("bob")])).unwrap();
    assert!(call(
        &mut d,
        "carol",
        Execute::Assign {
            name: NAME.into(),
            correspondent: "alice".into(),
            expected_revision: 1,
            take: true
        }
    )
    .is_err());
}
#[test]
fn new_all_member_requires_new_roster_and_gets_no_historical_envelope() {
    let (mut d, s) = setup();
    call(&mut d, "dao-core", configure(Readers::AllMembers, true, 1)).unwrap();
    call(
        &mut d,
        "alice",
        send(1, vec![packet("bob"), packet("carol")]),
    )
    .unwrap();
    s.lock().unwrap().members.push("dave".into());
    assert_eq!(inboxes(&d, "dave").items.len(), 1);
    let records: Vec<Record> = from_json(
        query(
            d.as_ref(),
            Query::Inbox {
                name: NAME.into(),
                after: None,
                limit: None,
            },
        )
        .unwrap(),
    )
    .unwrap();
    assert!(records[0]
        .deliveries
        .iter()
        .all(|r| r.recipient != Addr::unchecked("dave")));
    assert!(call(
        &mut d,
        "alice",
        send(2, vec![packet("bob"), packet("carol")])
    )
    .is_err());
}
#[test]
fn unnamed_and_transferred_name_senders_are_rejected() {
    let (mut d, s) = setup();
    enable(&mut d);
    s.lock().unwrap().named.retain(|a| a != "alice");
    assert!(call(
        &mut d,
        "alice",
        send(1, vec![packet("bob"), packet("carol")])
    )
    .is_err());
    s.lock().unwrap().named.push("alice".into());
    s.lock().unwrap().stale_name = true;
    assert!(call(
        &mut d,
        "alice",
        send(1, vec![packet("bob"), packet("carol")])
    )
    .is_err());
}
#[test]
fn block_is_account_bound_and_revokes_pending_preparation() {
    let (mut d, _) = setup();
    enable(&mut d);
    let block = Execute::SetBlock {
        name: NAME.into(),
        address: "alice".into(),
        blocked: true,
        expected_revision: 2,
    };
    assert!(call(&mut d, "carol", block.clone()).is_err());
    call(&mut d, "bob", block).unwrap();
    assert!(call(
        &mut d,
        "alice",
        send(1, vec![packet("bob"), packet("carol")])
    )
    .is_err());
    let mut msg = send(2, vec![packet("bob"), packet("carol")]);
    if let Execute::Send {
        expected_revision, ..
    } = &mut msg
    {
        *expected_revision = 3;
    }
    assert_eq!(call(&mut d, "alice", msg), Err(Error::Blocked));
}
#[test]
fn wrong_device_missing_duplicate_or_extra_envelopes_fail_before_write() {
    let (mut d, _) = setup();
    enable(&mut d);
    let mut changed = packet("carol");
    changed.generation = 2;
    for packets in [
        vec![packet("bob")],
        vec![packet("bob"), packet("bob")],
        vec![packet("bob"), packet("dave")],
        vec![packet("bob"), changed],
    ] {
        assert!(call(&mut d, "alice", send(1, packets)).is_err());
        assert_eq!(NEXT_SEQUENCE.load(&d.storage).unwrap(), 0);
        assert_eq!(
            DEVICES
                .load(&d.storage, &Addr::unchecked("bob"))
                .unwrap()
                .prekeys
                .len(),
            4
        );
    }
}
#[test]
fn assignment_is_shared_and_optimistically_locked_and_reply_marks_answered() {
    let (mut d, _) = setup();
    enable(&mut d);
    call(
        &mut d,
        "alice",
        send(1, vec![packet("bob"), packet("carol")]),
    )
    .unwrap();
    let take = Execute::Assign {
        name: NAME.into(),
        correspondent: "alice".into(),
        expected_revision: 1,
        take: true,
    };
    call(&mut d, "bob", take.clone()).unwrap();
    assert!(call(&mut d, "carol", take).is_err());
    let mut back = packet("alice");
    back.prekey_id = None;
    call(
        &mut d,
        "bob",
        Execute::Send {
            name: NAME.into(),
            expected_revision: 2,
            sender_generation: 1,
            message_id: format!("{:064x}", 2),
            reply_to: Some("alice".into()),
            expected_thread_revision: Some(2),
            deliveries: vec![
                back,
                Delivery {
                    prekey_id: Some(2),
                    ..packet("carol")
                },
            ],
        },
    )
    .unwrap();
    let thread = THREADS
        .load(&d.storage, (NAME, &Addr::unchecked("alice")))
        .unwrap();
    assert_eq!(thread.status, Status::Answered);
    assert_eq!(thread.assignee, Some(Addr::unchecked("bob")));
    assert!(
        call(
            &mut d,
            "carol",
            Execute::Send {
                name: NAME.into(),
                expected_revision: 2,
                sender_generation: 1,
                message_id: format!("{:064x}", 3),
                reply_to: Some("alice".into()),
                expected_thread_revision: Some(2),
                deliveries: vec![],
            }
        )
        .is_err(),
        "a second reply prepared against the old conversation must fail"
    );
}
#[test]
fn departed_manager_cannot_block_and_disabled_dao_has_no_access() {
    let (mut d, s) = setup();
    enable(&mut d);
    s.lock().unwrap().members.retain(|a| a != "bob");
    assert!(call(
        &mut d,
        "bob",
        Execute::SetBlock {
            name: NAME.into(),
            address: "alice".into(),
            blocked: true,
            expected_revision: 2
        }
    )
    .is_err());
    call(&mut d, "dao-core", configure(selected(), false, 2)).unwrap();
    assert!(inboxes(&d, "carol").items.is_empty());
}
#[test]
fn membership_errors_and_large_groups_fail_closed() {
    let (mut d, s) = setup();
    enable(&mut d);
    s.lock().unwrap().unavailable = true;
    assert!(query(
        d.as_ref(),
        Query::Mailboxes {
            address: "bob".into(),
            after: None,
            limit: None
        }
    )
    .is_err());
    s.lock().unwrap().unavailable = false;
    s.lock().unwrap().members = (0..40).map(|i| format!("member{i:03}")).collect();
    assert!(call(&mut d, "dao-core", configure(Readers::AllMembers, true, 2)).is_err());
}
#[test]
fn mainnet_is_rejected_before_any_dao_action() {
    let (mut d, _) = setup();
    let mut e = env();
    e.block.chain_id = "juno-1".into();
    assert_eq!(
        crate::execute(
            d.as_mut(),
            e,
            mock_info("dao-core", &[]),
            ExecuteMsg::Dao(configure(selected(), true, 1))
        ),
        Err(Error::Network)
    );
}
