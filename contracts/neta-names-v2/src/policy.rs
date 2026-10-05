use crate::msg::{Config, Operation, PriceSnapshot, Quote, Tariff};
use cosmwasm_std::{Env, StdError, StdResult, Uint128, Uint256};
use sha2::{Digest, Sha256};

pub const YEAR: u64 = 365 * 24 * 60 * 60;
pub const GRACE: u64 = 30 * 24 * 60 * 60;
pub const QUOTE_TTL: u64 = 300;
pub const PRICE_SNAPSHOT_TTL: u64 = 86400;
pub const COMMIT_TTL: u64 = 3600;
pub const MAINNET_TOKEN: &str = "juno168ctmpyppk90d34p3jjy658zf5a5l3w8wk35wht6ccqj4mr0yv8s4j5awr";
pub const MAINNET_TREASURY: &str =
    "juno1c5v6jkmre5xa9vf9aas6yxewc7aqmjy0rlkkyk4d88pnwuhclyhsrhhns6";

pub fn fail(s: &str) -> StdError {
    StdError::generic_err(s)
}
pub fn increment(n: u64) -> StdResult<u64> {
    n.checked_add(1).ok_or_else(|| fail("counter overflow"))
}
pub fn add(a: u64, b: u64) -> StdResult<u64> {
    a.checked_add(b).ok_or_else(|| fail("time overflow"))
}
pub fn name(input: &str) -> StdResult<String> {
    let lower = input.trim().to_ascii_lowercase();
    let label = lower.strip_suffix(".neta").unwrap_or(&lower);
    if !(3..=32).contains(&label.len())
        || label.starts_with('-')
        || label.ends_with('-')
        || label.contains("--")
        || !label
            .bytes()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == b'-')
        || matches!(
            label,
            "dao" | "admin" | "neta" | "relay" | "support" | "treasury" | "governance"
        )
    {
        return Err(fail("invalid or reserved personal name"));
    }
    Ok(format!("{label}.neta"))
}
pub fn hex64(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c))
}
pub fn amount(tariff: &Tariff, canonical: &str, years: u8, price: Uint128) -> StdResult<Uint128> {
    if !(1..=5).contains(&years) || price.is_zero() {
        return Err(fail("invalid term or price"));
    }
    let length = canonical
        .strip_suffix(".neta")
        .ok_or_else(|| fail("noncanonical name"))?
        .len();
    let cents = match length {
        3 => tariff.three_cents,
        4 => tariff.four_cents,
        _ => tariff.standard_cents,
    };
    let numerator = Uint256::from(cents)
        * Uint256::from(years as u64)
        * Uint256::from(1_000_000u64)
        * Uint256::from(1_000_000_000_000u64);
    let denominator = Uint256::from(price) * Uint256::from(100u64);
    let rounded = (numerator + denominator - Uint256::one()) / denominator;
    let result = Uint128::try_from(rounded).map_err(|_| fail("fee overflow"))?;
    if result.is_zero() {
        return Err(fail("zero fee"));
    }
    Ok(result)
}
pub fn commitment(env: &Env, owner: &str, canonical: &str, salt: &str) -> StdResult<String> {
    if !hex64(salt) {
        return Err(fail("salt must contain 32 random bytes as lowercase hex"));
    }
    Ok(format!(
        "{:x}",
        Sha256::digest(
            format!(
                "NETA names commitment v2\n{}\n{}\n{}\n{}\n{}",
                env.block.chain_id, env.contract.address, owner, canonical, salt
            )
            .as_bytes()
        )
    ))
}
pub fn quote_preimage(env: &Env, config: &Config, q: &Quote) -> String {
    format!(
        "NETA names quote v2\nRegistry chain: {}\nRegistry: {}\nToken: {}\nTreasury: {}\nOperation: {}\nPayer: {}\nOwner: {}\nName: {}\nGeneration: {}\nOwnership revision: {}\nExpected expiry: {}\nYears: {}\nTariff version: {}\nSigner version: {}\nUSD per NETA (12 decimals): {}\nAmount (micro NETA): {}\nNonce: {}\nIssued at: {}\nExpires at: {}",
        env.block.chain_id, env.contract.address, config.token, config.treasury,
        if q.operation == Operation::Register { "register" } else { "renew" }, q.payer, q.owner, q.name,
        q.generation, q.ownership_revision, q.expected_expires_at, q.years, q.tariff_version, q.signer_version,
        q.usd_per_neta_12, q.amount, q.nonce, q.issued_at, q.expires_at,
    )
}

pub fn price_snapshot_preimage(env: &Env, config: &Config, p: &PriceSnapshot) -> String {
    format!(
        "NETA names price snapshot v1\nRegistry chain: {}\nRegistry: {}\nToken: {}\nTreasury: {}\nSigner version: {}\nUSD per NETA (12 decimals): {}\nObserved at: {}\nExpires at: {}",
        env.block.chain_id, env.contract.address, config.token, config.treasury,
        p.signer_version, p.usd_per_neta_12, p.observed_at, p.expires_at,
    )
}
