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

#[test]
fn native_only_review_never_queries_neta_and_enforces_juno_lifecycle() {
    let mut deps = community_deps();
    // Instantiation, access and every community write must work even when
    // external voting/staking contracts are unavailable.
    deps.querier
        .update_wasm(|_| panic!("native-only review queried CW20 or DAO"));
    instantiate(
        deps.as_mut(),
        mock_env(),
        mock_info("owner", &[]),
        InstantiateMsg {
            owner: "owner".into(),
            dao_voting_contract: "unused".into(),
            stake_contract: "unused".into(),
            minimum_comment_stake: Uint128::zero(),
            community_gate: Some(CommunityGate {
                native_denom: "ujuno".into(),
                minimum_native_stake: Uint128::new(1_000_000),
                minimum_neta_stake: Uint128::zero(),
            }),
        },
    )
    .unwrap();
    let access =
        |deps: &OwnedDeps<MockStorage, MockApi, MockQuerier, Empty>, who: &str| -> AccessResponse {
            from_json(
                query(
                    deps.as_ref(),
                    mock_env(),
                    QueryMsg::Access {
                        address: who.into(),
                    },
                )
                .unwrap(),
            )
            .unwrap()
        };
    assert!(!access(&deps, "juno_only").can_publish);
    execute(
        deps.as_mut(),
        mock_env(),
        mock_info("owner", &[]),
        ExecuteMsg::SetPaused { paused: false },
    )
    .unwrap();
    let eligible = access(&deps, "juno_only");
    assert!(eligible.can_publish && eligible.can_comment);
    assert_eq!(eligible.active_neta_stake, Uint128::zero());
    assert!(!access(&deps, "neta_only").can_publish);
    assert_eq!(
        execute(
            deps.as_mut(),
            mock_env(),
            mock_info("neta_only", &[]),
            ExecuteMsg::PublishProposal {
                content: content("No native stake")
            }
        )
        .unwrap_err(),
        ContractError::CommunityStakeNotMet
    );
    execute(
        deps.as_mut(),
        mock_env(),
        mock_info("juno_only", &[]),
        ExecuteMsg::PublishProposal {
            content: content("Native only"),
        },
    )
    .unwrap();
    execute(
        deps.as_mut(),
        mock_env(),
        mock_info("juno_only", &[]),
        ExecuteMsg::AddRevision {
            proposal_id: 1,
            content: content("Revised"),
            change_log: "Clarify".into(),
        },
    )
    .unwrap();
    execute(
        deps.as_mut(),
        mock_env(),
        mock_info("juno_only", &[]),
        ExecuteMsg::AddComment {
            proposal_id: 1,
            version: 2,
            parent_id: None,
            title: None,
            body: "Review".into(),
        },
    )
    .unwrap();
    execute(
        deps.as_mut(),
        mock_env(),
        mock_info("juno_only", &[]),
        ExecuteMsg::Finalize {
            proposal_id: 1,
            version: 2,
        },
    )
    .unwrap();
    execute(
        deps.as_mut(),
        mock_env(),
        mock_info("juno_only", &[]),
        ExecuteMsg::Withdraw { proposal_id: 1 },
    )
    .unwrap();
    deps.querier.update_staking(
        "ujuno",
        &[],
        &[FullDelegation {
            delegator: Addr::unchecked("below"),
            validator: "validator".into(),
            amount: coin(999_999, "ujuno"),
            can_redelegate: coin(999_999, "ujuno"),
            accumulated_rewards: vec![],
        }],
    );
    assert!(!access(&deps, "below").can_publish);
}

fn attachment_content() -> (ProposalContent, Vec<cosmwasm_std::Binary>) {
    use crate::attachments::{Manifest, CHUNK_BYTES, PREFIX};
    use sha2::{Digest, Sha256};
    let bytes = "Complete evidence — governance and allocations.\n"
        .repeat(500)
        .into_bytes();
    let chunks: Vec<cosmwasm_std::Binary> = bytes.chunks(CHUNK_BYTES).map(Into::into).collect();
    let manifest = Manifest {
        schema: 1,
        sha256: format!("{:x}", Sha256::digest(&bytes)),
        bytes: bytes.len() as u32,
        chunks: chunks
            .iter()
            .map(|c| format!("{:x}", Sha256::digest(c.as_slice())))
            .collect(),
    };
    let mut value = content("An attached review");
    value.body = PREFIX.to_string() + &serde_json::to_string(&manifest).unwrap();
    (value, chunks)
}
#[test]
fn attachments_are_complete_immutable_revision_scoped_and_resumable() {
    use crate::attachments::{self, AttachmentStatus};
    let mut deps = deps();
    let (value, chunks) = attachment_content();
    execute(
        deps.as_mut(),
        mock_env(),
        mock_info("member", &[]),
        ExecuteMsg::PublishProposal {
            content: value.clone(),
        },
    )
    .unwrap();
    let upload = |index: usize| ExecuteMsg::UploadReviewChunk {
        proposal_id: 1,
        version: 1,
        index: index as u32,
        data: chunks[index].clone(),
    };
    let finalize = || ExecuteMsg::Finalize {
        proposal_id: 1,
        version: 1,
    };
    assert!(execute(
        deps.as_mut(),
        mock_env(),
        mock_info("member", &[]),
        finalize()
    )
    .is_err());
    assert_eq!(
        execute(
            deps.as_mut(),
            mock_env(),
            mock_info("owner", &[]),
            upload(0)
        )
        .unwrap_err(),
        ContractError::Unauthorized
    );
    execute(
        deps.as_mut(),
        mock_env(),
        mock_info("member", &[]),
        upload(0),
    )
    .unwrap();
    execute(
        deps.as_mut(),
        mock_env(),
        mock_info("member", &[]),
        upload(0),
    )
    .unwrap();
    let status: Option<AttachmentStatus> = from_json(
        query(
            deps.as_ref(),
            mock_env(),
            QueryMsg::ReviewAttachment {
                proposal_id: 1,
                version: 1,
            },
        )
        .unwrap(),
    )
    .unwrap();
    assert_eq!(status.unwrap().uploaded, vec![0]);
    assert!(execute(
        deps.as_mut(),
        mock_env(),
        mock_info("member", &[]),
        ExecuteMsg::UploadReviewChunk {
            proposal_id: 1,
            version: 1,
            index: 0,
            data: vec![0; chunks[0].len()].into()
        }
    )
    .is_err());
    assert!(execute(
        deps.as_mut(),
        mock_env(),
        mock_info("member", &[]),
        finalize()
    )
    .is_err());
    for i in (1..chunks.len()).rev() {
        execute(
            deps.as_mut(),
            mock_env(),
            mock_info("member", &[]),
            upload(i),
        )
        .unwrap();
    }
    attachments::assert_complete(&deps.storage, 1, 1).unwrap();
    // New revisions cannot borrow completeness from earlier versions.
    execute(
        deps.as_mut(),
        mock_env(),
        mock_info("member", &[]),
        ExecuteMsg::AddRevision {
            proposal_id: 1,
            content: value,
            change_log: "New revision".into(),
        },
    )
    .unwrap();
    assert!(execute(
        deps.as_mut(),
        mock_env(),
        mock_info("member", &[]),
        upload(0)
    )
    .is_err());
    assert!(execute(
        deps.as_mut(),
        mock_env(),
        mock_info("member", &[]),
        ExecuteMsg::Finalize {
            proposal_id: 1,
            version: 2
        }
    )
    .is_err());
    for (i, data) in chunks.iter().enumerate() {
        execute(
            deps.as_mut(),
            mock_env(),
            mock_info("member", &[]),
            ExecuteMsg::UploadReviewChunk {
                proposal_id: 1,
                version: 2,
                index: i as u32,
                data: data.clone(),
            },
        )
        .unwrap();
    }
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
    assert_eq!(
        execute(
            deps.as_mut(),
            mock_env(),
            mock_info("member", &[]),
            ExecuteMsg::UploadReviewChunk {
                proposal_id: 1,
                version: 2,
                index: 0,
                data: chunks[0].clone()
            }
        )
        .unwrap_err(),
        ContractError::Finalized
    );
    assert_eq!(
        attachments::CHUNKS.load(&deps.storage, (1, 1, 0)).unwrap(),
        chunks[0]
    );
}
#[test]
fn attachment_manifest_and_aggregate_hash_fail_closed() {
    use crate::attachments::{self, Manifest, PREFIX};
    let mut deps = deps();
    let (mut value, chunks) = attachment_content();
    let mut manifest: Manifest =
        serde_json::from_str(value.body.strip_prefix(PREFIX).unwrap()).unwrap();
    manifest.sha256 = "0".repeat(64);
    value.body = PREFIX.to_string() + &serde_json::to_string(&manifest).unwrap();
    execute(
        deps.as_mut(),
        mock_env(),
        mock_info("member", &[]),
        ExecuteMsg::PublishProposal { content: value },
    )
    .unwrap();
    for (i, data) in chunks.iter().enumerate() {
        execute(
            deps.as_mut(),
            mock_env(),
            mock_info("member", &[]),
            ExecuteMsg::UploadReviewChunk {
                proposal_id: 1,
                version: 1,
                index: i as u32,
                data: data.clone(),
            },
        )
        .unwrap();
    }
    assert!(attachments::assert_complete(&deps.storage, 1, 1).is_err());
    manifest.bytes = 750001;
    assert!(
        attachments::parse(&(PREFIX.to_string() + &serde_json::to_string(&manifest).unwrap()))
            .is_err()
    );
    manifest.bytes = 1;
    assert!(
        attachments::parse(&(PREFIX.to_string() + &serde_json::to_string(&manifest).unwrap()))
            .is_err()
    );
    assert!(attachments::parse(&(PREFIX.to_string() + "{}")).is_err());
}
#[test]
fn attachment_migration_preserves_all_legacy_state_and_pending_owner() {
    use crate::contract::migrate;
    use crate::msg::MigrateMsg;
    use cosmwasm_std::{Order, Storage};
    let mut deps = deps();
    execute(
        deps.as_mut(),
        mock_env(),
        mock_info("member", &[]),
        ExecuteMsg::PublishProposal {
            content: content("Legacy rule review"),
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
    execute(
        deps.as_mut(),
        mock_env(),
        mock_info("owner", &[]),
        ExecuteMsg::ProposeOwner {
            address: "successor".into(),
        },
    )
    .unwrap();
    cw2::set_contract_version(
        &mut deps.storage,
        "crates.io:neta-proposal-workshop",
        "0.3.1",
    )
    .unwrap();
    let before: Vec<_> = deps
        .storage
        .range(None, None, Order::Ascending)
        .filter(|(key, _)| key != b"contract_info")
        .collect();
    migrate(deps.as_mut(), mock_env(), MigrateMsg {}).unwrap();
    let after: Vec<_> = deps
        .storage
        .range(None, None, Order::Ascending)
        .filter(|(key, _)| key != b"contract_info")
        .collect();
    assert_eq!(before, after);
    execute(
        deps.as_mut(),
        mock_env(),
        mock_info("successor", &[]),
        ExecuteMsg::AcceptOwner {},
    )
    .unwrap();
    assert_eq!(
        crate::state::CONFIG.load(&deps.storage).unwrap().owner,
        Addr::unchecked("successor")
    );
    assert!(migrate(deps.as_mut(), mock_env(), MigrateMsg {}).is_err());
    cw2::set_contract_version(&mut deps.storage, "unrelated", "0.3.1").unwrap();
    assert!(migrate(deps.as_mut(), mock_env(), MigrateMsg {}).is_err());
}
