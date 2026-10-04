use bech32::{FromBase32, ToBase32, Variant};
use cosmwasm_std::{Api, Binary, StdError, StdResult};
use ripemd::Ripemd160;
use sha2::{Digest, Sha256};

use crate::msg::{Operator, Proof};

pub fn account(operator: &Operator) -> StdResult<String> {
    if !matches!(operator.chain_id.as_str(), "juno-1" | "uni-7") {
        return Err(StdError::generic_err("unsupported chain"));
    }
    let (prefix, data, variant) = bech32::decode(&operator.address)
        .map_err(|_| StdError::generic_err("invalid operator address"))?;
    let bytes = Vec::<u8>::from_base32(&data)
        .map_err(|_| StdError::generic_err("invalid operator payload"))?;
    if prefix != "junovaloper"
        || variant != Variant::Bech32
        || bytes.len() != 20
        || operator.address != operator.address.to_lowercase()
    {
        return Err(StdError::generic_err(
            "expected canonical Juno operator address",
        ));
    }
    bech32::encode("juno", bytes.to_base32(), Variant::Bech32)
        .map_err(|_| StdError::generic_err("address encoding failed"))
}

// Sorted Amino JSON; signer and data are restricted to Bech32/Base64 here.
pub fn sign_bytes(signer: &str, text: &str) -> Vec<u8> {
    let data = Binary::from(text.as_bytes()).to_base64();
    format!(
        "{{\"account_number\":\"0\",\"chain_id\":\"\",\"fee\":{{\"amount\":[],\"gas\":\"0\"}},\"memo\":\"\",\"msgs\":[{{\"type\":\"sign/MsgSignData\",\"value\":{{\"data\":\"{data}\",\"signer\":\"{signer}\"}}}}],\"sequence\":\"0\"}}"
    ).into_bytes()
}

pub fn verify(api: &dyn Api, operator: &Operator, text: &str, proof: &Proof) -> StdResult<()> {
    let signer = account(operator)?;
    let key = proof.public_key.as_slice();
    if key.len() != 33 || !matches!(key[0], 2 | 3) || proof.signature.len() != 64 {
        return Err(StdError::generic_err(
            "expected compressed secp256k1 ADR-36 proof",
        ));
    }
    let derived = Ripemd160::digest(Sha256::digest(key));
    let expected = bech32::encode("juno", derived.to_base32(), Variant::Bech32)
        .map_err(|_| StdError::generic_err("key address encoding failed"))?;
    if expected != signer {
        return Err(StdError::generic_err(
            "signature key does not control operator",
        ));
    }
    let hash = Sha256::digest(sign_bytes(&signer, text));
    let valid = api
        .secp256k1_verify(&hash, proof.signature.as_slice(), key)
        .map_err(|_| StdError::generic_err("invalid ownership signature"))?;
    if !valid {
        return Err(StdError::generic_err("invalid ownership signature"));
    }
    Ok(())
}
