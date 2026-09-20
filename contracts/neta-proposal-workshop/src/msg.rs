use crate::state::{Proposal, Revision};
use cosmwasm_schema::{cw_serde, QueryResponses};
use cosmwasm_std::Uint128;

#[cw_serde]
pub struct InstantiateMsg {
    pub owner: String,
    pub dao_voting_contract: String,
    pub stake_contract: String,
    pub minimum_comment_stake: Uint128,
    /// When set, publishing, revising, commenting, and finalizing require both
    /// the configured NETA stake and native delegated stake. When omitted the
    /// original Operations DAO membership rules remain unchanged.
    pub community_gate: Option<CommunityGate>,
}

#[cw_serde]
pub struct MigrateMsg {}

#[cw_serde]
pub struct CommunityGate {
    pub native_denom: String,
    pub minimum_native_stake: Uint128,
    pub minimum_neta_stake: Uint128,
}

#[cw_serde]
pub struct ProposalContent {
    pub title: String,
    pub summary: String,
    pub body: String,
    pub actions_json: String,
}

#[cw_serde]
pub struct ProposalSummary {
    pub proposal: Proposal,
    pub latest_revision: Revision,
}

#[cw_serde]
pub enum ExecuteMsg {
    PublishProposal {
        content: ProposalContent,
    },
    AddRevision {
        proposal_id: u64,
        content: ProposalContent,
        change_log: String,
    },
    AddComment {
        proposal_id: u64,
        version: u32,
        parent_id: Option<u64>,
        title: Option<String>,
        body: String,
    },
    SetThreadDecision {
        proposal_id: u64,
        comment_id: u64,
        status: String,
        reason: String,
    },
    Finalize {
        proposal_id: u64,
        version: u32,
    },
    Withdraw {
        proposal_id: u64,
    },
    MarkSubmitted {
        proposal_id: u64,
        dao_proposal_id: u64,
    },
    SetCommentHidden {
        proposal_id: u64,
        comment_id: u64,
        hidden: bool,
        reason: Option<String>,
    },
    SetModerator {
        address: String,
        enabled: bool,
    },
    SetBlocked {
        address: String,
        blocked: bool,
        reason: Option<String>,
    },
    SetPaused {
        paused: bool,
    },
    ProposeOwner {
        address: String,
    },
    AcceptOwner {},
}

#[cw_serde]
#[derive(QueryResponses)]
pub enum QueryMsg {
    #[returns(crate::state::Config)]
    Config {},
    #[returns(Proposal)]
    Proposal { proposal_id: u64 },
    #[returns(Vec<Proposal>)]
    Proposals {
        start_after: Option<u64>,
        limit: Option<u32>,
    },
    #[returns(Vec<ProposalSummary>)]
    ProposalSummaries {
        start_after: Option<u64>,
        limit: Option<u32>,
    },
    #[returns(Vec<Revision>)]
    Revisions {
        proposal_id: u64,
        start_after: Option<u32>,
        limit: Option<u32>,
    },
    #[returns(Vec<crate::state::Comment>)]
    Comments {
        proposal_id: u64,
        start_after: Option<u64>,
        limit: Option<u32>,
    },
    #[returns(AccessResponse)]
    Access { address: String },
}

#[cw_serde]
pub struct VotingPowerQuery {
    pub voting_power_at_height: VotingPowerAtHeight,
}
#[cw_serde]
pub struct VotingPowerAtHeight {
    pub address: String,
    pub height: Option<u64>,
}
#[cw_serde]
pub struct VotingPowerResponse {
    pub power: Uint128,
    pub height: u64,
}

#[cw_serde]
pub struct StakedBalanceQuery {
    pub staked_balance_at_height: StakedBalanceAtHeight,
}
#[cw_serde]
pub struct StakedBalanceAtHeight {
    pub address: String,
    pub height: Option<u64>,
}
#[cw_serde]
pub struct StakedBalanceResponse {
    pub balance: Uint128,
    pub height: u64,
}

#[cw_serde]
pub struct AccessResponse {
    pub address: String,
    pub voting_power: Uint128,
    pub active_neta_stake: Uint128,
    pub active_native_stake: Uint128,
    pub can_publish: bool,
    pub can_comment: bool,
    pub blocked: bool,
    pub paused: bool,
    pub cooldown_remaining_seconds: u64,
}
