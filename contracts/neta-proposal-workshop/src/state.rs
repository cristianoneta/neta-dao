use cosmwasm_schema::cw_serde;
use cosmwasm_std::{Addr, Uint128};
use cw_storage_plus::{Item, Map};

pub const COMMENT_COOLDOWN_SECONDS: u64 = 30;

#[cw_serde]
pub struct Config {
    pub owner: Addr,
    pub dao_voting_contract: Addr,
    pub stake_contract: Addr,
    pub minimum_comment_stake: Uint128,
    pub paused: bool,
    pub comment_cooldown_seconds: u64,
}

#[cw_serde]
pub struct Proposal {
    pub id: u64,
    pub author: Addr,
    pub latest_version: u32,
    pub finalized_version: Option<u32>,
    pub finalized_hash: Option<String>,
    pub dao_proposal_id: Option<u64>,
    pub created_height: u64,
    pub created_time: u64,
}

#[cw_serde]
pub struct Revision {
    pub proposal_id: u64,
    pub version: u32,
    pub author: Addr,
    pub title: String,
    pub summary: String,
    pub body: String,
    pub actions_json: String,
    pub change_log: String,
    pub created_height: u64,
    pub created_time: u64,
}

#[cw_serde]
pub struct Moderation {
    pub hidden: bool,
    pub reason: Option<String>,
    pub updated_by: Addr,
    pub updated_height: u64,
    pub updated_time: u64,
}

#[cw_serde]
pub struct Comment {
    pub id: u64,
    pub proposal_id: u64,
    pub version: u32,
    pub parent_id: Option<u64>,
    pub title: Option<String>,
    pub body: String,
    pub author: Addr,
    pub verified_stake: Uint128,
    pub status: String,
    pub decision_reason: Option<String>,
    pub moderation: Option<Moderation>,
    pub created_height: u64,
    pub created_time: u64,
}

#[cw_serde]
pub struct BlockRecord { pub blocked: bool, pub reason: Option<String> }

pub const CONFIG: Item<Config> = Item::new("config");
pub const NEXT_PROPOSAL_ID: Item<u64> = Item::new("next_proposal_id");
pub const PROPOSALS: Map<u64, Proposal> = Map::new("proposals");
pub const REVISIONS: Map<(u64, u32), Revision> = Map::new("revisions");
pub const NEXT_COMMENT_ID: Map<u64, u64> = Map::new("next_comment_id");
pub const COMMENTS: Map<(u64, u64), Comment> = Map::new("comments");
pub const LAST_COMMENT_TIME: Map<&Addr, u64> = Map::new("last_comment_time");
pub const MODERATORS: Map<&Addr, bool> = Map::new("moderators");
pub const BLOCKS: Map<&Addr, BlockRecord> = Map::new("blocks");

