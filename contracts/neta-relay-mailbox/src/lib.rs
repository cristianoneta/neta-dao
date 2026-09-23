use cosmwasm_std::{
    entry_point, to_json_binary, Addr, Binary, Deps, DepsMut, Env, MessageInfo, Order, Response,
    StdError, StdResult,
};
use cw_storage_plus::{Bound, Item, Map};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use thiserror::Error;

const CONTRACT: &str = "neta-relay-mailbox";
const CHAIN: &str = "uni-7";
const MAX_PREKEYS: usize = 16;
const MAX_BUNDLE: usize = 1024;
const MAX_CIPHERTEXT: usize = 4096;
const MAX_PAGE: u32 = 50;

const DEVICES: Map<&Addr, Device> = Map::new("devices");
const INBOX: Map<(&Addr, u64), Message> = Map::new("inbox");
const SENT_IDS: Map<(&Addr, &str), u64> = Map::new("sent_ids");
const BLOCKED: Map<(&Addr, &Addr), bool> = Map::new("blocked");
const NEXT_SEQUENCE: Item<u64> = Item::new("next_sequence");

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct InstantiateMsg {}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Prekey {
    pub id: u16,
    pub bundle: Binary,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Device {
    pub generation: u64,
    pub device_id: String,
    pub protocol_version: u16,
    pub fingerprint: String,
    pub active: bool,
    pub prekeys: Vec<Prekey>,
    pub max_prekey_id: u16,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum MessageKind {
    Initial { prekey_id: u16 },
    Followup,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Message {
    pub sequence: u64,
    pub message_id: String,
    pub sender: Addr,
    pub sender_generation: u64,
    pub recipient: Addr,
    pub recipient_generation: u64,
    pub kind: MessageKind,
    pub ciphertext: Binary,
    pub block_height: u64,
    pub timestamp: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ExecuteMsg {
    Register {
        device_id: String,
        protocol_version: u16,
        fingerprint: String,
        prekeys: Vec<Prekey>,
    },
    Revoke {},
    AddPrekeys {
        generation: u64,
        prekeys: Vec<Prekey>,
    },
    SendInitial {
        recipient: String,
        recipient_generation: u64,
        prekey_id: u16,
        message_id: String,
        ciphertext: Binary,
    },
    Send {
        recipient: String,
        recipient_generation: u64,
        message_id: String,
        ciphertext: Binary,
    },
    SetBlock { address: String, blocked: bool },
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum QueryMsg {
    Device { address: String },
    Inbox { address: String, after: Option<u64>, limit: Option<u32> },
    Sent { sender: String, message_id: String },
    Blocked { recipient: String, sender: String },
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct InboxResponse {
    pub messages: Vec<Message>,
}

#[derive(Error, Debug, PartialEq)]
pub enum Error {
    #[error("{0}")]
    Std(#[from] StdError),
    #[error("UNI-7 only")]
    Network,
    #[error("funds are not accepted")]
    Funds,
    #[error("invalid device registration")]
    Device,
    #[error("invalid prekey bundle")]
    Prekey,
    #[error("device not active or generation changed")]
    DeviceChanged,
    #[error("recipient blocked sender")]
    Blocked,
    #[error("invalid message ID or ciphertext")]
    Message,
    #[error("message ID already used")]
    Duplicate,
    #[error("prekey already consumed or unavailable")]
    PrekeySpent,
    #[error("sequence exhausted")]
    Sequence,
}

fn no_funds(info: &MessageInfo) -> Result<(), Error> {
    if info.funds.is_empty() { Ok(()) } else { Err(Error::Funds) }
}

fn network(env: &Env) -> Result<(), Error> {
    if env.block.chain_id == CHAIN { Ok(()) } else { Err(Error::Network) }
}

fn hex_id(value: &str, len: usize) -> bool {
    value.len() == len && value.bytes().all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())
}

fn validate_prekeys(prekeys: &[Prekey], required: bool) -> Result<(), Error> {
    if prekeys.len() > MAX_PREKEYS || (required && prekeys.is_empty()) {
        return Err(Error::Prekey);
    }
    let mut seen = std::collections::BTreeSet::new();
    for prekey in prekeys {
        if !seen.insert(prekey.id) || !(32..=MAX_BUNDLE).contains(&prekey.bundle.len()) {
            return Err(Error::Prekey);
        }
    }
    Ok(())
}

#[entry_point]
pub fn instantiate(deps: DepsMut, env: Env, info: MessageInfo, _msg: InstantiateMsg) -> Result<Response, Error> {
    network(&env)?;
    no_funds(&info)?;
    NEXT_SEQUENCE.save(deps.storage, &0)?;
    cw2::set_contract_version(deps.storage, CONTRACT, env!("CARGO_PKG_VERSION"))?;
    Ok(Response::new().add_attribute("action", "instantiate"))
}

#[entry_point]
pub fn execute(deps: DepsMut, env: Env, info: MessageInfo, msg: ExecuteMsg) -> Result<Response, Error> {
    network(&env)?;
    no_funds(&info)?;
    match msg {
        ExecuteMsg::Register { device_id, protocol_version, fingerprint, prekeys } => {
            if !(1..=64).contains(&device_id.len()) || !device_id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
                || protocol_version != 1 || !hex_id(&fingerprint, 64) {
                return Err(Error::Device);
            }
            validate_prekeys(&prekeys, true)?;
            let max_prekey_id = prekeys.iter().map(|p| p.id).max().ok_or(Error::Prekey)?;
            let generation = match DEVICES.may_load(deps.storage, &info.sender)? {
                Some(old) => old.generation.checked_add(1).ok_or(Error::Sequence)?,
                None => 1,
            };
            DEVICES.save(deps.storage, &info.sender, &Device {
                generation, device_id, protocol_version, fingerprint, active: true, prekeys, max_prekey_id,
            })?;
            Ok(Response::new().add_attribute("action", "register").add_attribute("generation", generation.to_string()))
        }
        ExecuteMsg::Revoke {} => {
            let mut device = DEVICES.load(deps.storage, &info.sender)?;
            device.generation = device.generation.checked_add(1).ok_or(Error::Sequence)?;
            device.active = false;
            device.prekeys.clear();
            DEVICES.save(deps.storage, &info.sender, &device)?;
            Ok(Response::new().add_attribute("action", "revoke"))
        }
        ExecuteMsg::AddPrekeys { generation, prekeys } => {
            validate_prekeys(&prekeys, true)?;
            let mut device = DEVICES.load(deps.storage, &info.sender)?;
            if !device.active || device.generation != generation { return Err(Error::DeviceChanged); }
            if device.prekeys.len() + prekeys.len() > MAX_PREKEYS || prekeys.iter().any(|p| p.id <= device.max_prekey_id) {
                return Err(Error::Prekey);
            }
            device.max_prekey_id = prekeys.iter().map(|p| p.id).max().ok_or(Error::Prekey)?;
            device.prekeys.extend(prekeys);
            DEVICES.save(deps.storage, &info.sender, &device)?;
            Ok(Response::new().add_attribute("action", "add_prekeys"))
        }
        ExecuteMsg::SetBlock { address, blocked } => {
            let address = deps.api.addr_validate(&address)?;
            if blocked { BLOCKED.save(deps.storage, (&info.sender, &address), &true)?; }
            else { BLOCKED.remove(deps.storage, (&info.sender, &address)); }
            Ok(Response::new().add_attribute("action", "set_block"))
        }
        ExecuteMsg::SendInitial { recipient, recipient_generation, prekey_id, message_id, ciphertext } => {
            send(deps, env, info, recipient, recipient_generation, message_id, ciphertext, Some(prekey_id))
        }
        ExecuteMsg::Send { recipient, recipient_generation, message_id, ciphertext } => {
            send(deps, env, info, recipient, recipient_generation, message_id, ciphertext, None)
        }
    }
}

#[allow(clippy::too_many_arguments)]
fn send(deps: DepsMut, env: Env, info: MessageInfo, recipient: String, recipient_generation: u64,
    message_id: String, ciphertext: Binary, prekey_id: Option<u16>) -> Result<Response, Error> {
    if !hex_id(&message_id, 64) || !(16..=MAX_CIPHERTEXT).contains(&ciphertext.len()) { return Err(Error::Message); }
    if SENT_IDS.has(deps.storage, (&info.sender, &message_id)) { return Err(Error::Duplicate); }
    let recipient = deps.api.addr_validate(&recipient)?;
    if BLOCKED.has(deps.storage, (&recipient, &info.sender)) { return Err(Error::Blocked); }
    let sender_device = DEVICES.load(deps.storage, &info.sender)?;
    let mut receiver = DEVICES.load(deps.storage, &recipient)?;
    if !sender_device.active || !receiver.active || receiver.generation != recipient_generation { return Err(Error::DeviceChanged); }
    let kind = if let Some(id) = prekey_id {
        let index = receiver.prekeys.iter().position(|prekey| prekey.id == id).ok_or(Error::PrekeySpent)?;
        receiver.prekeys.remove(index);
        MessageKind::Initial { prekey_id: id }
    } else { MessageKind::Followup };
    let sequence = NEXT_SEQUENCE.load(deps.storage)?.checked_add(1).ok_or(Error::Sequence)?;
    let message = Message {
        sequence, message_id: message_id.clone(), sender: info.sender.clone(),
        sender_generation: sender_device.generation, recipient: recipient.clone(), recipient_generation,
        kind, ciphertext, block_height: env.block.height, timestamp: env.block.time.seconds(),
    };
    // CosmWasm rolls back all writes if any operation fails. A competing initial
    // send observes the consumed prekey and fails without storing a message.
    if prekey_id.is_some() { DEVICES.save(deps.storage, &recipient, &receiver)?; }
    INBOX.save(deps.storage, (&recipient, sequence), &message)?;
    SENT_IDS.save(deps.storage, (&info.sender, &message_id), &sequence)?;
    NEXT_SEQUENCE.save(deps.storage, &sequence)?;
    Ok(Response::new().add_attribute("action", "send").add_attribute("sequence", sequence.to_string()))
}

#[entry_point]
pub fn query(deps: Deps, env: Env, msg: QueryMsg) -> StdResult<Binary> {
    if env.block.chain_id != CHAIN { return Err(StdError::generic_err("UNI-7 only")); }
    match msg {
        QueryMsg::Device { address } => {
            let address = deps.api.addr_validate(&address)?;
            to_json_binary(&DEVICES.may_load(deps.storage, &address)?)
        }
        QueryMsg::Inbox { address, after, limit } => {
            let address = deps.api.addr_validate(&address)?;
            let limit = limit.unwrap_or(20).min(MAX_PAGE) as usize;
            let messages = INBOX.prefix(&address).range(deps.storage, after.map(Bound::exclusive), None, Order::Ascending)
                .take(limit).map(|row| row.map(|(_, message)| message)).collect::<StdResult<Vec<_>>>()?;
            to_json_binary(&InboxResponse { messages })
        }
        QueryMsg::Sent { sender, message_id } => {
            let sender = deps.api.addr_validate(&sender)?;
            let sequence = SENT_IDS.may_load(deps.storage, (&sender, &message_id))?;
            to_json_binary(&sequence)
        }
        QueryMsg::Blocked { recipient, sender } => {
            let recipient = deps.api.addr_validate(&recipient)?;
            let sender = deps.api.addr_validate(&sender)?;
            to_json_binary(&BLOCKED.has(deps.storage, (&recipient, &sender)))
        }
    }
}

#[cfg(test)]
mod tests;
