use crate::contract::{execute, instantiate, query};
use crate::error::ContractError;
use crate::msg::{
    AccessResponse, CommunityGate, ExecuteMsg, InstantiateMsg, ProposalContent, QueryMsg,
    StakedBalanceQuery, StakedBalanceResponse, VotingPowerQuery, VotingPowerResponse,
};
use crate::state::{Config, Proposal};
use cosmwasm_std::testing::{
    mock_dependencies, mock_env, mock_info, MockApi, MockQuerier, MockStorage,
};
use cosmwasm_std::{
    coin, coins, from_json, to_json_binary, Addr, ContractResult, Empty, FullDelegation, OwnedDeps,
    QuerierResult, SystemResult, Uint128, WasmQuery,
};

fn content(title: &str) -> ProposalContent {
    ProposalContent {
        title: title.into(),
        summary: "Summary".into(),
        body: "Body".into(),
        actions_json: "[]".into(),
    }
}

fn deps() -> OwnedDeps<MockStorage, MockApi, MockQuerier, Empty> {
    let mut deps = mock_dependencies();
    deps.querier.update_wasm(|query| -> QuerierResult {
        let WasmQuery::Smart { contract_addr, msg } = query else {
            panic!("unexpected wasm query")
        };
        if contract_addr == "voting" {
            let q: VotingPowerQuery = from_json(msg).unwrap();
            let power = if matches!(
                q.voting_power_at_height.address.as_str(),
                "owner" | "member"
            ) {
                1u128
            } else {
                0
            };
            SystemResult::Ok(ContractResult::Ok(
                to_json_binary(&VotingPowerResponse {
                    power: Uint128::new(power),
                    height: 123,
                })
                .unwrap(),
            ))
        } else if contract_addr == "staking" {
            let q: StakedBalanceQuery = from_json(msg).unwrap();
            let balance = match q.staked_balance_at_height.address.as_str() {
                "ten" => 10_000_000,
                "staker" => 10_000_001,
                "both" | "neta_only" => 1_000_000,
                _ => 0,
            };
            SystemResult::Ok(ContractResult::Ok(
                to_json_binary(&StakedBalanceResponse {
                    balance: Uint128::new(balance),
                    height: 123,
                })
                .unwrap(),
            ))
        } else {
            panic!("unexpected contract {contract_addr}")
        }
    });
    instantiate(
        deps.as_mut(),
        mock_env(),
        mock_info("owner", &[]),
        InstantiateMsg {
            owner: "owner".into(),
            dao_voting_contract: "voting".into(),
            stake_contract: "staking".into(),
            minimum_comment_stake: Uint128::new(10_000_000),
            community_gate: None,
        },
    )
    .unwrap();
    execute(
        deps.as_mut(),
        mock_env(),
        mock_info("owner", &[]),
        ExecuteMsg::SetPaused { paused: false },
    )
    .unwrap();
    deps
}

fn community_deps() -> OwnedDeps<MockStorage, MockApi, MockQuerier, Empty> {
    let mut deps = deps();
    deps.querier.update_staking(
        "ujuno",
        &[],
        &[
            FullDelegation {
                delegator: Addr::unchecked("both"),
                validator: "junovaloper1both".into(),
                amount: coin(1_000_000, "ujuno"),
                can_redelegate: coin(1_000_000, "ujuno"),
                accumulated_rewards: coins(0, "ujuno"),
            },
            FullDelegation {
                delegator: Addr::unchecked("juno_only"),
                validator: "junovaloper1juno".into(),
                amount: coin(1_000_000, "ujuno"),
                can_redelegate: coin(1_000_000, "ujuno"),
                accumulated_rewards: coins(0, "ujuno"),
            },
        ],
    );
    instantiate(
        deps.as_mut(),
        mock_env(),
        mock_info("owner", &[]),
        InstantiateMsg {
            owner: "owner".into(),
            dao_voting_contract: "voting".into(),
            stake_contract: "staking".into(),
            minimum_comment_stake: Uint128::zero(),
            community_gate: Some(CommunityGate {
                native_denom: "ujuno".into(),
                minimum_native_stake: Uint128::new(1_000_000),
                minimum_neta_stake: Uint128::new(1_000_000),
            }),
        },
    )
    .unwrap();
    execute(
        deps.as_mut(),
        mock_env(),
        mock_info("owner", &[]),
        ExecuteMsg::SetPaused { paused: false },
    )
    .unwrap();
    deps
}

#[test]
fn only_members_publish_and_revise() {
    let mut deps = deps();
    let err = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("outsider", &[]),
        ExecuteMsg::PublishProposal {
            content: content("No"),
        },
    )
    .unwrap_err();
    assert_eq!(err, ContractError::Unauthorized);
    execute(
        deps.as_mut(),
        mock_env(),
        mock_info("member", &[]),
        ExecuteMsg::PublishProposal {
            content: content("Version one"),
        },
    )
    .unwrap();
    let err = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("owner", &[]),
        ExecuteMsg::AddRevision {
            proposal_id: 1,
            content: content("Version two"),
            change_log: "Changed".into(),
        },
    )
    .unwrap_err();
    assert_eq!(err, ContractError::Unauthorized);
    execute(
        deps.as_mut(),
        mock_env(),
        mock_info("member", &[]),
        ExecuteMsg::AddRevision {
            proposal_id: 1,
            content: content("Version two"),
            change_log: "Changed".into(),
        },
    )
    .unwrap();
}

#[test]
fn comment_gate_is_strictly_more_than_ten_neta() {
    let mut deps = deps();
    execute(
        deps.as_mut(),
        mock_env(),
        mock_info("member", &[]),
        ExecuteMsg::PublishProposal {
            content: content("Proposal"),
        },
    )
    .unwrap();
    let mut msg = |who: &str| {
        execute(
            deps.as_mut(),
            mock_env(),
            mock_info(who, &[]),
            ExecuteMsg::AddComment {
                proposal_id: 1,
                version: 1,
                parent_id: None,
                title: Some("Thread".into()),
                body: "Comment".into(),
            },
        )
    };
    assert_eq!(msg("ten").unwrap_err(), ContractError::CommentStakeNotMet);
    msg("staker").unwrap();
    let access: AccessResponse = from_json(
        query(
            deps.as_ref(),
            mock_env(),
            QueryMsg::Access {
                address: "staker".into(),
            },
        )
        .unwrap(),
    )
    .unwrap();
    assert_eq!(access.active_neta_stake, Uint128::new(10_000_001));
    assert_eq!(access.cooldown_remaining_seconds, 30);
    assert!(!access.can_comment);
    assert!(!access.can_publish);
}

#[test]
fn juno_community_requires_one_juno_and_one_neta_staked() {
    let mut deps = community_deps();
    let publish = |who: &str| ExecuteMsg::PublishProposal {
        content: content(who),
    };
    assert_eq!(
        execute(
            deps.as_mut(),
            mock_env(),
            mock_info("neta_only", &[]),
            publish("neta_only")
        )
        .unwrap_err(),
        ContractError::CommunityStakeNotMet
    );
    assert_eq!(
        execute(
            deps.as_mut(),
            mock_env(),
            mock_info("juno_only", &[]),
            publish("juno_only")
        )
        .unwrap_err(),
        ContractError::CommunityStakeNotMet
    );
    execute(
        deps.as_mut(),
        mock_env(),
        mock_info("both", &[]),
        publish("both"),
    )
    .unwrap();
    let access: AccessResponse = from_json(
        query(
            deps.as_ref(),
            mock_env(),
            QueryMsg::Access {
                address: "both".into(),
            },
        )
        .unwrap(),
    )
    .unwrap();
    assert_eq!(access.active_neta_stake, Uint128::new(1_000_000));
    assert_eq!(access.active_native_stake, Uint128::new(1_000_000));
    assert!(access.can_publish);
    assert!(access.can_comment);
}

#[test]
fn only_latest_revision_can_be_finalized() {
    let mut deps = deps();
    execute(
        deps.as_mut(),
        mock_env(),
        mock_info("member", &[]),
        ExecuteMsg::PublishProposal {
            content: content("V1"),
        },
    )
    .unwrap();
    execute(
        deps.as_mut(),
        mock_env(),
        mock_info("member", &[]),
        ExecuteMsg::AddRevision {
            proposal_id: 1,
            content: content("V2"),
            change_log: "Changed".into(),
        },
    )
    .unwrap();
    let err = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("member", &[]),
        ExecuteMsg::Finalize {
            proposal_id: 1,
            version: 1,
        },
    )
    .unwrap_err();
    assert_eq!(err, ContractError::NotLatestVersion);
    execute(
        deps.as_mut(),
        mock_env(),
        mock_info("member", &[]),
        ExecuteMsg::Finalize {
            proposal_id: 1,
            version: 2,
        },
    )
    .unwrap();
    let err = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("member", &[]),
        ExecuteMsg::AddRevision {
            proposal_id: 1,
            content: content("V3"),
            change_log: "Too late".into(),
        },
    )
    .unwrap_err();
    assert_eq!(err, ContractError::Finalized);
}

#[test]
fn author_can_withdraw_before_submission_and_state_is_terminal() {
    let mut deps = deps();
    execute(
        deps.as_mut(),
        mock_env(),
        mock_info("member", &[]),
        ExecuteMsg::PublishProposal {
            content: content("Withdraw me"),
        },
    )
    .unwrap();
    assert_eq!(
        execute(
            deps.as_mut(),
            mock_env(),
            mock_info("owner", &[]),
            ExecuteMsg::Withdraw { proposal_id: 1 }
        )
        .unwrap_err(),
        ContractError::Unauthorized
    );
    execute(
        deps.as_mut(),
        mock_env(),
        mock_info("member", &[]),
        ExecuteMsg::Withdraw { proposal_id: 1 },
    )
    .unwrap();
    assert_eq!(
        execute(
            deps.as_mut(),
            mock_env(),
            mock_info("member", &[]),
            ExecuteMsg::AddRevision {
                proposal_id: 1,
                content: content("Too late"),
                change_log: "No".into()
            }
        )
        .unwrap_err(),
        ContractError::Withdrawn
    );
    assert_eq!(
        execute(
            deps.as_mut(),
            mock_env(),
            mock_info("member", &[]),
            ExecuteMsg::Finalize {
                proposal_id: 1,
                version: 1
            }
        )
        .unwrap_err(),
        ContractError::Withdrawn
    );
}

#[test]
fn finalization_computes_hash_and_closes_discussion() {
    let mut deps = deps();
    execute(
        deps.as_mut(),
        mock_env(),
        mock_info("member", &[]),
        ExecuteMsg::PublishProposal {
            content: content("Proposal"),
        },
    )
    .unwrap();
    execute(
        deps.as_mut(),
        mock_env(),
        mock_info("staker", &[]),
        ExecuteMsg::AddComment {
            proposal_id: 1,
            version: 1,
            parent_id: None,
            title: Some("Topic".into()),
            body: "Before finalization".into(),
        },
    )
    .unwrap();
    execute(
        deps.as_mut(),
        mock_env(),
        mock_info("member", &[]),
        ExecuteMsg::Finalize {
            proposal_id: 1,
            version: 1,
        },
    )
    .unwrap();
    let proposal: Proposal = from_json(
        query(
            deps.as_ref(),
            mock_env(),
            QueryMsg::Proposal { proposal_id: 1 },
        )
        .unwrap(),
    )
    .unwrap();
    let hash = proposal.finalized_hash.unwrap();
    assert_eq!(hash.len(), 64);
    assert!(hash.chars().all(|character| character.is_ascii_hexdigit()));
    let mut later = mock_env();
    later.block.time = later.block.time.plus_seconds(31);
    assert_eq!(
        execute(
            deps.as_mut(),
            later,
            mock_info("staker", &[]),
            ExecuteMsg::AddComment {
                proposal_id: 1,
                version: 1,
                parent_id: None,
                title: Some("Late".into()),
                body: "Too late".into()
            }
        )
        .unwrap_err(),
        ContractError::Finalized
    );
}

#[test]
fn unverified_submission_is_disabled() {
    let mut deps = deps();
    execute(
        deps.as_mut(),
        mock_env(),
        mock_info("member", &[]),
        ExecuteMsg::PublishProposal {
            content: content("Proposal"),
        },
    )
    .unwrap();
    execute(
        deps.as_mut(),
        mock_env(),
        mock_info("member", &[]),
        ExecuteMsg::Finalize {
            proposal_id: 1,
            version: 1,
        },
    )
    .unwrap();
    assert_eq!(
        execute(
            deps.as_mut(),
            mock_env(),
            mock_info("member", &[]),
            ExecuteMsg::MarkSubmitted {
                proposal_id: 1,
                dao_proposal_id: 42
            }
        )
        .unwrap_err(),
        ContractError::SubmissionVerificationUnavailable
    );
}

#[test]
fn owner_transfer_requires_acceptance() {
    let mut deps = deps();
    execute(
        deps.as_mut(),
        mock_env(),
        mock_info("owner", &[]),
        ExecuteMsg::ProposeOwner {
            address: "member".into(),
        },
    )
    .unwrap();
    assert_eq!(
        execute(
            deps.as_mut(),
            mock_env(),
            mock_info("outsider", &[]),
            ExecuteMsg::AcceptOwner {}
        )
        .unwrap_err(),
        ContractError::NoPendingOwner
    );
    execute(
        deps.as_mut(),
        mock_env(),
        mock_info("member", &[]),
        ExecuteMsg::AcceptOwner {},
    )
    .unwrap();
    let config: Config =
        from_json(query(deps.as_ref(), mock_env(), QueryMsg::Config {}).unwrap()).unwrap();
    assert_eq!(config.owner, Addr::unchecked("member"));
    assert_eq!(config.pending_owner, None);
}

#[test]
fn actions_must_be_a_json_array() {
    let mut deps = deps();
    let mut invalid = content("Invalid actions");
    invalid.actions_json = "{}".into();
    assert_eq!(
        execute(
            deps.as_mut(),
            mock_env(),
            mock_info("member", &[]),
            ExecuteMsg::PublishProposal { content: invalid }
        )
        .unwrap_err(),
        ContractError::InvalidActions
    );
}
