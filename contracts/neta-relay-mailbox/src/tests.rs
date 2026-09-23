use super::*;
use cosmwasm_std::testing::{mock_dependencies, mock_env, mock_info};
use cosmwasm_std::{from_json, Coin, OwnedDeps};

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

fn prekey(id: u16) -> Prekey { Prekey { id, bundle: Binary::from(vec![7; 64]) } }
fn message_id(id: u8) -> String { format!("{id:064x}") }
fn ciphertext() -> Binary { Binary::from(vec![42; 80]) }
fn register(id: &str, prekeys: Vec<Prekey>) -> ExecuteMsg {
    ExecuteMsg::Register { device_id: id.into(), protocol_version: 1, fingerprint: "ab".repeat(32), prekeys }
}

fn setup() -> OwnedDeps<cosmwasm_std::testing::MockStorage, cosmwasm_std::testing::MockApi, cosmwasm_std::testing::MockQuerier> {
    let mut deps = mock_dependencies();
    instantiate(deps.as_mut(), env(), mock_info("creator", &[]), InstantiateMsg {}).unwrap();
    execute(deps.as_mut(), env(), mock_info("alice", &[]), register("alice-device", vec![prekey(1)])).unwrap();
    execute(deps.as_mut(), env(), mock_info("bob", &[]), register("bob-device", vec![prekey(1), prekey(2)])).unwrap();
    deps
}

fn send_initial(id: u8, key: u16, generation: u64) -> ExecuteMsg {
    ExecuteMsg::SendInitial {
        recipient: "bob".into(), recipient_generation: generation, prekey_id: key,
        message_id: message_id(id), ciphertext: ciphertext(),
    }
}

#[test]
fn initial_message_consumes_prekey_once_and_deduplicates_id() {
    let mut deps = setup();
    execute(deps.as_mut(), env(), mock_info("alice", &[]), send_initial(1, 1, 1)).unwrap();
    assert_eq!(execute(deps.as_mut(), env(), mock_info("alice", &[]), send_initial(2, 1, 1)), Err(Error::PrekeySpent));
    assert_eq!(execute(deps.as_mut(), env(), mock_info("alice", &[]), send_initial(1, 2, 1)), Err(Error::Duplicate));
    let device: Option<Device> = from_json(query(deps.as_ref(), env(), QueryMsg::Device { address: "bob".into() }).unwrap()).unwrap();
    assert_eq!(device.unwrap().prekeys, vec![prekey(2)]);
    let sent: Option<u64> = from_json(query(deps.as_ref(), env(), QueryMsg::Sent { sender: "alice".into(), message_id: message_id(1) }).unwrap()).unwrap();
    assert_eq!(sent, Some(1));
    let inbox: InboxResponse = from_json(query(deps.as_ref(), env(), QueryMsg::Inbox { address: "bob".into(), after: None, limit: None }).unwrap()).unwrap();
    assert_eq!(inbox.messages.len(), 1);
    assert_eq!(inbox.messages[0].ciphertext, ciphertext());
}

#[test]
fn device_rotation_rejects_stale_sends_and_revocation() {
    let mut deps = setup();
    execute(deps.as_mut(), env(), mock_info("bob", &[]), register("bob-replacement", vec![prekey(1)])).unwrap();
    assert_eq!(execute(deps.as_mut(), env(), mock_info("alice", &[]), send_initial(1, 1, 1)), Err(Error::DeviceChanged));
    execute(deps.as_mut(), env(), mock_info("alice", &[]), send_initial(1, 1, 2)).unwrap();
    execute(deps.as_mut(), env(), mock_info("bob", &[]), ExecuteMsg::Revoke {}).unwrap();
    let followup = ExecuteMsg::Send { recipient: "bob".into(), recipient_generation: 2, message_id: message_id(2), ciphertext: ciphertext() };
    assert_eq!(execute(deps.as_mut(), env(), mock_info("alice", &[]), followup), Err(Error::DeviceChanged));
}

#[test]
fn consumed_ids_cannot_be_republished_and_blocks_work() {
    let mut deps = setup();
    execute(deps.as_mut(), env(), mock_info("alice", &[]), send_initial(1, 2, 1)).unwrap();
    let republish = ExecuteMsg::AddPrekeys { generation: 1, prekeys: vec![prekey(2)] };
    assert_eq!(execute(deps.as_mut(), env(), mock_info("bob", &[]), republish), Err(Error::Prekey));
    execute(deps.as_mut(), env(), mock_info("bob", &[]), ExecuteMsg::SetBlock { address: "alice".into(), blocked: true }).unwrap();
    assert_eq!(execute(deps.as_mut(), env(), mock_info("alice", &[]), send_initial(2, 1, 1)), Err(Error::Blocked));
    execute(deps.as_mut(), env(), mock_info("bob", &[]), ExecuteMsg::SetBlock { address: "alice".into(), blocked: false }).unwrap();
    assert_eq!(execute(deps.as_mut(), env(), mock_info("alice", &[]), send_initial(2, 1, 1)), Err(Error::Cooldown));
    execute(deps.as_mut(), later(10), mock_info("alice", &[]), send_initial(2, 1, 1)).unwrap();
    let page: InboxResponse = from_json(query(deps.as_ref(), env(), QueryMsg::Inbox { address: "bob".into(), after: Some(1), limit: Some(1) }).unwrap()).unwrap();
    assert_eq!(page.messages[0].sequence, 2);
}

#[test]
fn rejects_funds_and_wrong_network() {
    let mut deps = setup();
    let mut mainnet = env();
    mainnet.block.chain_id = "juno-1".into();
    assert_eq!(execute(deps.as_mut(), mainnet, mock_info("alice", &[]), send_initial(1, 1, 1)), Err(Error::Network));
    assert_eq!(execute(deps.as_mut(), env(), mock_info("alice", &[Coin::new(1, "ujunox")]), send_initial(1, 1, 1)), Err(Error::Funds));
}
