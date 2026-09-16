use crate::contract::{execute, instantiate, query};
use crate::error::ContractError;
use crate::msg::{AccessResponse, ExecuteMsg, InstantiateMsg, ProposalContent, QueryMsg, StakedBalanceQuery, StakedBalanceResponse, VotingPowerQuery, VotingPowerResponse};
use cosmwasm_std::testing::{mock_dependencies, mock_env, mock_info, MockApi, MockQuerier, MockStorage};
use cosmwasm_std::{from_json, to_json_binary, ContractResult, Empty, OwnedDeps, QuerierResult, SystemResult, Uint128, WasmQuery};

fn content(title: &str) -> ProposalContent {
    ProposalContent { title: title.into(), summary: "Summary".into(), body: "Body".into(), actions_json: "[]".into() }
}

fn deps() -> OwnedDeps<MockStorage, MockApi, MockQuerier, Empty> {
    let mut deps = mock_dependencies();
    deps.querier.update_wasm(|query| -> QuerierResult {
        let WasmQuery::Smart { contract_addr, msg } = query else { panic!("unexpected wasm query") };
        if contract_addr == "voting" {
            let q: VotingPowerQuery = from_json(msg).unwrap();
            let power = if matches!(q.voting_power_at_height.address.as_str(), "owner" | "member") { 1u128 } else { 0 };
            SystemResult::Ok(ContractResult::Ok(to_json_binary(&VotingPowerResponse { power: Uint128::new(power), height: 123 }).unwrap()))
        } else if contract_addr == "staking" {
            let q: StakedBalanceQuery = from_json(msg).unwrap();
            let balance = match q.staked_balance_at_height.address.as_str() { "ten" => 10_000_000, "staker" => 10_000_001, _ => 0 };
            SystemResult::Ok(ContractResult::Ok(to_json_binary(&StakedBalanceResponse { balance: Uint128::new(balance), height: 123 }).unwrap()))
        } else { panic!("unexpected contract {contract_addr}") }
    });
    instantiate(deps.as_mut(), mock_env(), mock_info("owner", &[]), InstantiateMsg { owner:"owner".into(), dao_voting_contract:"voting".into(), stake_contract:"staking".into(), minimum_comment_stake:Uint128::new(10_000_000) }).unwrap();
    execute(deps.as_mut(), mock_env(), mock_info("owner", &[]), ExecuteMsg::SetPaused { paused:false }).unwrap();
    deps
}

#[test]
fn only_members_publish_and_revise() {
    let mut deps = deps();
    let err = execute(deps.as_mut(), mock_env(), mock_info("outsider", &[]), ExecuteMsg::PublishProposal { content:content("No") }).unwrap_err();
    assert_eq!(err, ContractError::Unauthorized);
    execute(deps.as_mut(), mock_env(), mock_info("member", &[]), ExecuteMsg::PublishProposal { content:content("Version one") }).unwrap();
    let err = execute(deps.as_mut(), mock_env(), mock_info("owner", &[]), ExecuteMsg::AddRevision { proposal_id:1, content:content("Version two"), change_log:"Changed".into() }).unwrap_err();
    assert_eq!(err, ContractError::Unauthorized);
    execute(deps.as_mut(), mock_env(), mock_info("member", &[]), ExecuteMsg::AddRevision { proposal_id:1, content:content("Version two"), change_log:"Changed".into() }).unwrap();
}

#[test]
fn comment_gate_is_strictly_more_than_ten_neta() {
    let mut deps = deps();
    execute(deps.as_mut(), mock_env(), mock_info("member", &[]), ExecuteMsg::PublishProposal { content:content("Proposal") }).unwrap();
    let mut msg = |who:&str| execute(deps.as_mut(), mock_env(), mock_info(who, &[]), ExecuteMsg::AddComment { proposal_id:1, version:1, parent_id:None, title:Some("Thread".into()), body:"Comment".into() });
    assert_eq!(msg("ten").unwrap_err(), ContractError::CommentStakeNotMet);
    msg("staker").unwrap();
    let access:AccessResponse=from_json(query(deps.as_ref(),mock_env(),QueryMsg::Access{address:"staker".into()}).unwrap()).unwrap();
    assert!(access.can_comment);
    assert!(!access.can_publish);
}

#[test]
fn only_latest_revision_can_be_finalized() {
    let mut deps = deps();
    execute(deps.as_mut(), mock_env(), mock_info("member", &[]), ExecuteMsg::PublishProposal { content:content("V1") }).unwrap();
    execute(deps.as_mut(), mock_env(), mock_info("member", &[]), ExecuteMsg::AddRevision { proposal_id:1, content:content("V2"), change_log:"Changed".into() }).unwrap();
    let hash="a".repeat(64);
    let err=execute(deps.as_mut(),mock_env(),mock_info("member",&[]),ExecuteMsg::Finalize{proposal_id:1,version:1,content_hash:hash.clone()}).unwrap_err();
    assert_eq!(err,ContractError::NotLatestVersion);
    execute(deps.as_mut(),mock_env(),mock_info("member",&[]),ExecuteMsg::Finalize{proposal_id:1,version:2,content_hash:hash}).unwrap();
    let err=execute(deps.as_mut(),mock_env(),mock_info("member",&[]),ExecuteMsg::AddRevision{proposal_id:1,content:content("V3"),change_log:"Too late".into()}).unwrap_err();
    assert_eq!(err,ContractError::Finalized);
}
