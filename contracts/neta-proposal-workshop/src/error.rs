use cosmwasm_std::StdError;
use thiserror::Error;

#[derive(Error, Debug, PartialEq)]
pub enum ContractError {
    #[error("{0}")]
    Std(#[from] StdError),
    #[error("unauthorized")]
    Unauthorized,
    #[error("contract is paused")]
    Paused,
    #[error("address is blocked")]
    Blocked,
    #[error("comment cooldown has {remaining_seconds} seconds remaining")]
    Cooldown { remaining_seconds: u64 },
    #[error("more than the configured NETA stake is required")]
    CommentStakeNotMet,
    #[error("DAO membership query failed")]
    MembershipQueryFailed,
    #[error("NETA stake query failed")]
    StakeQueryFailed,
    #[error("at least the configured native and NETA stake are required")]
    CommunityStakeNotMet,
    #[error("proposal is finalized")]
    Finalized,
    #[error("proposal is not finalized")]
    NotFinalized,
    #[error("proposal is withdrawn")]
    Withdrawn,
    #[error("proposal was already submitted")]
    AlreadySubmitted,
    #[error("version is not the latest revision")]
    NotLatestVersion,
    #[error("comment parent does not belong to this proposal")]
    InvalidParent,
    #[error("invalid {field} length; expected {min}..={max} characters")]
    InvalidLength {
        field: String,
        min: usize,
        max: usize,
    },
    #[error("counter overflow")]
    CounterOverflow,
    #[error("funds are not accepted")]
    FundsNotAccepted,
    #[error("submission verification is not implemented; mainnet submission remains disabled")]
    SubmissionVerificationUnavailable,
    #[error("proposal actions must be a JSON array")]
    InvalidActions,
    #[error("no pending owner transfer for this address")]
    NoPendingOwner,
}
