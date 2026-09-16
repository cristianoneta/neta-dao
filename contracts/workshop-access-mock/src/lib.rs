use cosmwasm_schema::{cw_serde, QueryResponses};
use cosmwasm_std::{entry_point, to_json_binary, Addr, Binary, Deps, DepsMut, Env, MessageInfo, Response, StdError, StdResult, Uint128};
use cw2::set_contract_version;
use cw_storage_plus::Map;

const NAME:&str="crates.io:workshop-access-mock";
const VERSION:&str=env!("CARGO_PKG_VERSION");
const CHAIN_ID:&str="uni-7";
const POWERS:Map<&Addr,Uint128>=Map::new("powers");
const STAKES:Map<&Addr,Uint128>=Map::new("stakes");

#[cw_serde]
pub struct Access { pub address:String, pub amount:Uint128 }
#[cw_serde]
pub struct InstantiateMsg { pub voting_power:Vec<Access>, pub active_stake:Vec<Access> }
#[cw_serde]
#[derive(QueryResponses)]
pub enum QueryMsg {
    #[returns(VotingPowerResponse)]
    VotingPowerAtHeight { address:String, height:Option<u64> },
    #[returns(StakedBalanceResponse)]
    StakedBalanceAtHeight { address:String, height:Option<u64> },
}
#[cw_serde]
pub struct VotingPowerResponse { pub power:Uint128, pub height:u64 }
#[cw_serde]
pub struct StakedBalanceResponse { pub balance:Uint128, pub height:u64 }

#[entry_point]
pub fn instantiate(deps:DepsMut,env:Env,info:MessageInfo,msg:InstantiateMsg)->StdResult<Response>{
    if env.block.chain_id!=CHAIN_ID{return Err(StdError::generic_err("workshop access mock is restricted to uni-7"))}
    if !info.funds.is_empty(){return Err(StdError::generic_err("funds are not accepted"))}
    set_contract_version(deps.storage,NAME,VERSION)?;
    for item in msg.voting_power {let address=deps.api.addr_validate(&item.address)?;POWERS.save(deps.storage,&address,&item.amount)?;}
    for item in msg.active_stake {let address=deps.api.addr_validate(&item.address)?;STAKES.save(deps.storage,&address,&item.amount)?;}
    Ok(Response::new().add_attribute("action","instantiate").add_attribute("chain_id",CHAIN_ID))
}

#[entry_point]
pub fn query(deps:Deps,env:Env,msg:QueryMsg)->StdResult<Binary>{match msg{
    QueryMsg::VotingPowerAtHeight{address,..}=>{let address=deps.api.addr_validate(&address)?;to_json_binary(&VotingPowerResponse{power:POWERS.may_load(deps.storage,&address)?.unwrap_or_default(),height:env.block.height})},
    QueryMsg::StakedBalanceAtHeight{address,..}=>{let address=deps.api.addr_validate(&address)?;to_json_binary(&StakedBalanceResponse{balance:STAKES.may_load(deps.storage,&address)?.unwrap_or_default(),height:env.block.height})},
}}
