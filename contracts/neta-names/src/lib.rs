use cosmwasm_std::{entry_point, from_json, to_json_binary, Addr, Binary, Deps, DepsMut, Env, MessageInfo, Response, StdError, StdResult, Uint128, WasmMsg};
use cw_storage_plus::{Item, Map};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use thiserror::Error;

const YEAR: u64 = 365 * 24 * 60 * 60;
const GRACE: u64 = 30 * 24 * 60 * 60;
const INITIAL_FEE: u128 = 5_000_000; // 5 NETA, six decimals
const NETA_DAO_TREASURY: &str = "juno1c5v6jkmre5xa9vf9aas6yxewc7aqmjy0rlkkyk4d88pnwuhclyhsrhhns6";
const NAMES: Map<&str, Record> = Map::new("names");
const REVERSE: Map<&Addr, String> = Map::new("reverse");
const COMMITMENTS: Map<(&Addr, &str), u64> = Map::new("commits");
const CONFIG: Item<Config> = Item::new("config");

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct InstantiateMsg { pub neta_token: String, pub dao_treasury: String, pub admin: String, pub renewal_fee: Uint128 }
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Config { pub token: Addr, pub treasury: Addr, pub admin: Addr, pub pending_admin: Option<Addr>, pub renewal_fee: Uint128 }
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Record { pub owner: Addr, pub expires_at: u64 }
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Cw20ReceiveMsg { pub sender: String, pub amount: Uint128, pub msg: Binary }
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ExecuteMsg {
    Commit { hash: String },
    Receive(Cw20ReceiveMsg),
    SetRenewalFee { amount: Uint128 },
    NominateAdmin { address: String },
    AcceptAdmin {},
}
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum HookMsg { Register { name: String, salt: String }, Renew { name: String } }
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum QueryMsg { Resolve { name: String }, NameOf { address: String }, Config {}, Commitment { address: String, hash: String } }
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct ResolveResponse { pub name: String, pub address: Option<String>, pub expires_at: Option<u64>, pub in_grace: bool }
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct NameOfResponse { pub address: String, pub name: Option<String> }
#[derive(Serialize)]
#[serde(rename_all = "snake_case")]
enum TokenExecute { Transfer { recipient: String, amount: Uint128 } }

#[derive(Error, Debug, PartialEq)]
pub enum Error {
    #[error("{0}")] Std(#[from] StdError),
    #[error("attached funds are not accepted")] Funds,
    #[error("unauthorized")] Unauthorized,
    #[error("invalid name: use 5-32 lowercase ASCII letters, digits or interior hyphens")] InvalidName,
    #[error("reserved name")] Reserved,
    #[error("name unavailable")] Taken,
    #[error("wallet already owns a name")] OnePerWallet,
    #[error("missing or immature commitment")] Commitment,
    #[error("fee mismatch")] Fee,
    #[error("name is outside its renewal period")] Expired,
    #[error("invalid hash")] Hash,
    #[error("treasury must be the NETA DAO address")] Treasury,
}
fn label(input: &str) -> Result<&str, Error> {
    let raw = input.strip_suffix(".neta").unwrap_or(input);
    let b = raw.as_bytes();
    if !(5..=32).contains(&b.len()) || b[0] == b'-' || b[b.len()-1] == b'-' || !b.iter().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || *c == b'-') { return Err(Error::InvalidName); }
    if ["admin", "neta", "relay", "support", "treasury", "governance"].contains(&raw) { return Err(Error::Reserved); }
    Ok(raw)
}
fn commitment(name: &str, sender: &Addr, salt: &str) -> String {
    let bytes = format!("neta-names-v1:{name}:{}:{salt}", sender);
    format!("{:x}", Sha256::digest(bytes.as_bytes()))
}
#[entry_point]
pub fn instantiate(deps: DepsMut, _env: Env, info: MessageInfo, msg: InstantiateMsg) -> Result<Response, Error> {
    if !info.funds.is_empty() { return Err(Error::Funds); }
    if msg.renewal_fee.is_zero() { return Err(Error::Fee); }
    if msg.dao_treasury != NETA_DAO_TREASURY { return Err(Error::Treasury); }
    let config = Config { token: deps.api.addr_validate(&msg.neta_token)?, treasury: deps.api.addr_validate(&msg.dao_treasury)?, admin: deps.api.addr_validate(&msg.admin)?, pending_admin: None, renewal_fee: msg.renewal_fee };
    CONFIG.save(deps.storage, &config)?;
    cw2::set_contract_version(deps.storage, "neta-names", env!("CARGO_PKG_VERSION"))?;
    Ok(Response::new().add_attribute("action", "instantiate"))
}
#[entry_point]
pub fn execute(deps: DepsMut, env: Env, info: MessageInfo, msg: ExecuteMsg) -> Result<Response, Error> {
    if !info.funds.is_empty() { return Err(Error::Funds); }
    match msg {
        ExecuteMsg::Commit { hash } => {
            if hash.len() != 64 || !hash.bytes().all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase()) { return Err(Error::Hash); }
            COMMITMENTS.save(deps.storage, (&info.sender, &hash), &env.block.height)?;
            Ok(Response::new().add_attribute("action", "commit"))
        }
        ExecuteMsg::Receive(receive) => {
            let config = CONFIG.load(deps.storage)?;
            if info.sender != config.token { return Err(Error::Unauthorized); }
            let sender = deps.api.addr_validate(&receive.sender)?;
            let hook: HookMsg = from_json(receive.msg)?;
            let (name, new_expiry) = match hook {
                HookMsg::Register { name, salt } => {
                    let name = label(&name)?.to_string();
                    if receive.amount.u128() != INITIAL_FEE { return Err(Error::Fee); }
                    if let Some(existing) = REVERSE.may_load(deps.storage, &sender)? {
                        if let Some(record) = NAMES.may_load(deps.storage, &existing)? {
                            if record.owner == sender && env.block.time.seconds() < record.expires_at.saturating_add(GRACE) { return Err(Error::OnePerWallet); }
                        }
                        REVERSE.remove(deps.storage, &sender);
                    }
                    if let Some(old) = NAMES.may_load(deps.storage, &name)? {
                        if env.block.time.seconds() < old.expires_at.saturating_add(GRACE) { return Err(Error::Taken); }
                        if REVERSE.may_load(deps.storage, &old.owner)?.as_deref() == Some(name.as_str()) { REVERSE.remove(deps.storage, &old.owner); }
                    }
                    let hash = commitment(&name, &sender, &salt);
                    let height = COMMITMENTS.may_load(deps.storage, (&sender, &hash))?.ok_or(Error::Commitment)?;
                    if env.block.height <= height || env.block.height > height.saturating_add(100) { return Err(Error::Commitment); }
                    COMMITMENTS.remove(deps.storage, (&sender, &hash));
                    let expires = env.block.time.seconds().saturating_add(YEAR);
                    NAMES.save(deps.storage, &name, &Record { owner: sender.clone(), expires_at: expires })?;
                    REVERSE.save(deps.storage, &sender, &name)?;
                    (name, expires)
                }
                HookMsg::Renew { name } => {
                    let name = label(&name)?.to_string();
                    if receive.amount != config.renewal_fee { return Err(Error::Fee); }
                    let mut record = NAMES.load(deps.storage, &name)?;
                    if record.owner != sender { return Err(Error::Unauthorized); }
                    if env.block.time.seconds() >= record.expires_at.saturating_add(GRACE) { return Err(Error::Expired); }
                    record.expires_at = record.expires_at.max(env.block.time.seconds()).saturating_add(YEAR);
                    NAMES.save(deps.storage, &name, &record)?;
                    (name, record.expires_at)
                }
            };
            let transfer = WasmMsg::Execute { contract_addr: config.token.to_string(), msg: to_json_binary(&TokenExecute::Transfer { recipient: config.treasury.to_string(), amount: receive.amount })?, funds: vec![] };
            Ok(Response::new().add_message(transfer).add_attribute("action", "name_payment").add_attribute("name", format!("{name}.neta")).add_attribute("expires_at", new_expiry.to_string()))
        }
        ExecuteMsg::SetRenewalFee { amount } => {
            let mut c = CONFIG.load(deps.storage)?;
            if c.admin != info.sender { return Err(Error::Unauthorized); }
            if amount.is_zero() { return Err(Error::Fee); }
            c.renewal_fee = amount;
            CONFIG.save(deps.storage, &c)?;
            Ok(Response::new().add_attribute("action", "set_renewal_fee").add_attribute("amount", amount))
        }
        ExecuteMsg::NominateAdmin { address } => {
            let mut c = CONFIG.load(deps.storage)?;
            if c.admin != info.sender { return Err(Error::Unauthorized); }
            c.pending_admin = Some(deps.api.addr_validate(&address)?);
            CONFIG.save(deps.storage, &c)?;
            Ok(Response::new().add_attribute("action", "nominate_admin"))
        }
        ExecuteMsg::AcceptAdmin {} => {
            let mut c = CONFIG.load(deps.storage)?;
            if c.pending_admin.as_ref() != Some(&info.sender) { return Err(Error::Unauthorized); }
            c.admin = info.sender;
            c.pending_admin = None;
            CONFIG.save(deps.storage, &c)?;
            Ok(Response::new().add_attribute("action", "accept_admin"))
        }
    }
}
#[entry_point]
pub fn query(deps: Deps, env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::Config {} => to_json_binary(&CONFIG.load(deps.storage)?),
        QueryMsg::Commitment { address, hash } => { let addr = deps.api.addr_validate(&address)?; to_json_binary(&COMMITMENTS.may_load(deps.storage, (&addr, &hash))?) }
        QueryMsg::Resolve { name } => {
            let name = label(&name).map_err(|e| StdError::generic_err(e.to_string()))?;
            let record = NAMES.may_load(deps.storage, name)?;
            let now = env.block.time.seconds();
            to_json_binary(&ResolveResponse { name: format!("{name}.neta"), address: record.as_ref().filter(|r| now < r.expires_at).map(|r| r.owner.to_string()), expires_at: record.as_ref().map(|r| r.expires_at), in_grace: record.as_ref().is_some_and(|r| now >= r.expires_at && now < r.expires_at.saturating_add(GRACE)) })
        }
        QueryMsg::NameOf { address } => {
            let addr = deps.api.addr_validate(&address)?;
            let name = REVERSE.may_load(deps.storage, &addr)?;
            let active = match name { Some(n) => NAMES.may_load(deps.storage, &n)?.filter(|r| r.owner == addr && env.block.time.seconds() < r.expires_at).map(|_| format!("{n}.neta")), None => None };
            to_json_binary(&NameOfResponse { address, name: active })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use cosmwasm_std::{coin, CosmosMsg, testing::{mock_dependencies, mock_env, mock_info}};

    fn init(deps: DepsMut) {
        instantiate(deps, mock_env(), mock_info("deployer", &[]), InstantiateMsg {
            neta_token: "neta-token".into(), dao_treasury: NETA_DAO_TREASURY.into(),
            admin: "admin-wallet".into(), renewal_fee: Uint128::new(2_000_000),
        }).unwrap();
    }
    fn pay(sender: &str, amount: u128, hook: HookMsg) -> ExecuteMsg {
        ExecuteMsg::Receive(Cw20ReceiveMsg { sender: sender.into(), amount: Uint128::new(amount), msg: to_json_binary(&hook).unwrap() })
    }
    #[test]
    fn commit_register_renew_and_expire() {
        let mut deps = mock_dependencies(); init(deps.as_mut());
        let mut env = mock_env();
        let owner = Addr::unchecked("alice-wallet");
        let hash = commitment("alice", &owner, "private-salt");
        execute(deps.as_mut(), env.clone(), mock_info("alice-wallet", &[]), ExecuteMsg::Commit { hash }).unwrap();
        assert_eq!(execute(deps.as_mut(), env.clone(), mock_info("neta-token", &[]), pay("alice-wallet", INITIAL_FEE, HookMsg::Register { name:"alice.neta".into(), salt:"private-salt".into() })).unwrap_err(), Error::Commitment);
        env.block.height += 1;
        let response = execute(deps.as_mut(), env.clone(), mock_info("neta-token", &[]), pay("alice-wallet", INITIAL_FEE, HookMsg::Register { name:"alice.neta".into(), salt:"private-salt".into() })).unwrap();
        assert_eq!(response.messages.len(), 1);
        if let CosmosMsg::Wasm(WasmMsg::Execute { contract_addr, msg, funds }) = &response.messages[0].msg {
            assert_eq!(contract_addr, "neta-token"); assert!(funds.is_empty());
            assert_eq!(msg, &to_json_binary(&TokenExecute::Transfer { recipient: NETA_DAO_TREASURY.into(), amount: Uint128::new(INITIAL_FEE) }).unwrap());
        } else { panic!("registration fee must transfer to the NETA DAO"); }
        let found: ResolveResponse = from_json(query(deps.as_ref(), env.clone(), QueryMsg::Resolve { name:"alice.neta".into() }).unwrap()).unwrap();
        assert_eq!(found.address.as_deref(), Some("alice-wallet"));
        assert_eq!(execute(deps.as_mut(), env.clone(), mock_info("neta-token", &[]), pay("alice-wallet", 1, HookMsg::Renew { name:"alice".into() })).unwrap_err(), Error::Fee);
        env.block.time = env.block.time.plus_seconds(YEAR + 1);
        let expired: ResolveResponse = from_json(query(deps.as_ref(), env.clone(), QueryMsg::Resolve { name:"alice".into() }).unwrap()).unwrap();
        assert!(expired.in_grace); assert_eq!(expired.address, None);
        let renewal = execute(deps.as_mut(), env.clone(), mock_info("neta-token", &[]), pay("alice-wallet", 2_000_000, HookMsg::Renew { name:"alice".into() })).unwrap();
        if let CosmosMsg::Wasm(WasmMsg::Execute { contract_addr, msg, funds }) = &renewal.messages[0].msg {
            assert_eq!(contract_addr, "neta-token"); assert!(funds.is_empty());
            assert_eq!(msg, &to_json_binary(&TokenExecute::Transfer { recipient: NETA_DAO_TREASURY.into(), amount: Uint128::new(2_000_000) }).unwrap());
        } else { panic!("renewal fee must transfer to the NETA DAO"); }
        let active: ResolveResponse = from_json(query(deps.as_ref(), env, QueryMsg::Resolve { name:"alice".into() }).unwrap()).unwrap();
        assert_eq!(active.address.as_deref(), Some("alice-wallet"));
    }
    #[test]
    fn wrong_token_and_price_authority_fail() {
        let mut deps = mock_dependencies(); init(deps.as_mut());
        let mut other = mock_dependencies();
        assert_eq!(instantiate(other.as_mut(), mock_env(), mock_info("deployer", &[]), InstantiateMsg { neta_token:"neta-token".into(), dao_treasury:"operations-dao".into(), admin:"admin-wallet".into(), renewal_fee:Uint128::new(INITIAL_FEE) }).unwrap_err(), Error::Treasury);
        assert_eq!(execute(deps.as_mut(), mock_env(), mock_info("attacker", &[]), pay("alice-wallet", INITIAL_FEE, HookMsg::Register { name:"alice".into(), salt:"secret".into() })).unwrap_err(), Error::Unauthorized);
        assert_eq!(execute(deps.as_mut(), mock_env(), mock_info("attacker", &[]), ExecuteMsg::SetRenewalFee { amount: Uint128::new(1) }).unwrap_err(), Error::Unauthorized);
        assert_eq!(execute(deps.as_mut(), mock_env(), mock_info("admin-wallet", &[coin(1,"ujuno")]), ExecuteMsg::SetRenewalFee { amount: Uint128::new(1) }).unwrap_err(), Error::Funds);
        execute(deps.as_mut(), mock_env(), mock_info("admin-wallet", &[]), ExecuteMsg::SetRenewalFee { amount: Uint128::new(3_000_000) }).unwrap();
        let config: Config = from_json(query(deps.as_ref(), mock_env(), QueryMsg::Config {}).unwrap()).unwrap();
        assert_eq!(config.renewal_fee, Uint128::new(3_000_000));
        assert_eq!(config.treasury, Addr::unchecked(NETA_DAO_TREASURY));
        for bad in ["AlIce", "a", "-alice", "alice-", "alice_juno", "admin", "alice.juno"] { assert!(label(bad).is_err()); }
    }
}
