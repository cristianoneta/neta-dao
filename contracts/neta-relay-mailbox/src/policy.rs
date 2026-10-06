use crate::{dao, Error};
use cosmwasm_std::{Addr, Deps, DepsMut, Env, StdResult};
use cw_storage_plus::Item;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

pub const REGISTRY: &str = "juno1pc8wrq89ljuhu2qt6rtk5lkkrptxajtf3un5llu8prg7r4z50vlszfhhza";
pub const OWNER: &str = "juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57";
const CONFIG: Item<Config> = Item::new("personal_policy_v1");

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Config {
    pub chain_id: String,
    pub nns_registry: Option<String>,
    pub dao_enabled: bool,
}
pub fn init(deps: DepsMut, env: &Env, sender: &Addr, mainnet: bool) -> Result<(), Error> {
    let chain = if mainnet { "juno-1" } else { "uni-7" };
    if env.block.chain_id != chain || (mainnet && sender.as_str() != OWNER) {
        return Err(Error::Network);
    }
    if mainnet {
        // Bind at instantiation: no unprotected interval before a registrar action.
        dao::bind_initial_registry(deps.storage, deps.api.addr_validate(REGISTRY)?)?;
    }
    CONFIG.save(
        deps.storage,
        &Config {
            chain_id: chain.into(),
            nns_registry: mainnet.then(|| REGISTRY.into()),
            dao_enabled: !mainnet,
        },
    )?;
    Ok(())
}
pub fn config(deps: Deps) -> StdResult<Config> {
    CONFIG.load(deps.storage)
}
pub fn network(deps: Deps, env: &Env) -> Result<Config, Error> {
    let config = config(deps)?;
    if config.chain_id != env.block.chain_id {
        return Err(Error::Network);
    }
    Ok(config)
}
pub fn sender(deps: Deps, env: &Env, address: &Addr) -> Result<(), Error> {
    let config = network(deps, env)?;
    dao::active_name(deps, env, address, config.nns_registry.is_some())?;
    Ok(())
}
