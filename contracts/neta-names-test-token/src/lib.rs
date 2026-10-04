use cosmwasm_std::{
    entry_point, Binary, Deps, DepsMut, Empty, Env, MessageInfo, Response, StdError, StdResult,
    Uint128,
};

#[entry_point]
pub fn instantiate(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    _msg: Empty,
) -> Result<Response, cw20_base::ContractError> {
    if env.block.chain_id != "uni-7" || !info.funds.is_empty() {
        return Err(StdError::generic_err("mock NETA requires UNI-7 and no native funds").into());
    }
    let msg = cw20_base::msg::InstantiateMsg {
        name: "NETA Names test token".into(),
        symbol: "TNETA".into(),
        decimals: 6,
        initial_balances: vec![cw20::Cw20Coin {
            address: info.sender.to_string(),
            amount: Uint128::new(1_000_000_000_000),
        }],
        mint: None,
        marketing: None,
    };
    cw20_base::contract::instantiate(deps, env, info, msg)
}
#[entry_point]
pub fn execute(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: cw20_base::msg::ExecuteMsg,
) -> Result<Response, cw20_base::ContractError> {
    if env.block.chain_id != "uni-7" || !info.funds.is_empty() {
        return Err(StdError::generic_err("mock NETA requires UNI-7 and no native funds").into());
    }
    cw20_base::contract::execute(deps, env, info, msg)
}
#[entry_point]
pub fn query(deps: Deps, env: Env, msg: cw20_base::msg::QueryMsg) -> StdResult<Binary> {
    cw20_base::contract::query(deps, env, msg)
}
#[cfg(test)]
mod tests {
    use super::*;
    use cosmwasm_std::{
        from_json,
        testing::{mock_dependencies, mock_env, mock_info},
    };
    #[test]
    fn test_token_is_uni7_only_fixed_supply_and_six_decimals() {
        let mut deps = mock_dependencies();
        let mut env = mock_env();
        assert!(instantiate(
            deps.as_mut(),
            env.clone(),
            mock_info("alice", &[]),
            Empty {}
        )
        .is_err());
        env.block.chain_id = "uni-7".into();
        instantiate(
            deps.as_mut(),
            env.clone(),
            mock_info("alice", &[]),
            Empty {},
        )
        .unwrap();
        let info: cw20::TokenInfoResponse = from_json(
            query(
                deps.as_ref(),
                env.clone(),
                cw20_base::msg::QueryMsg::TokenInfo {},
            )
            .unwrap(),
        )
        .unwrap();
        assert_eq!(info.decimals, 6);
        assert_eq!(info.total_supply, Uint128::new(1_000_000_000_000));
        assert!(execute(
            deps.as_mut(),
            env,
            mock_info("alice", &[]),
            cw20::Cw20ExecuteMsg::Mint {
                recipient: "alice".into(),
                amount: Uint128::one()
            }
        )
        .is_err());
    }
}
