//! Append-only review bodies. This stores bytes, never executable messages.
use crate::error::ContractError;
use cosmwasm_schema::cw_serde;
use cosmwasm_std::{Binary, StdError, StdResult, Storage};
use cw_storage_plus::Map;
use sha2::{Digest, Sha256};

pub const PREFIX: &str = "cosmoot-review-attachment-1\n";
pub const CHUNK_BYTES: usize = 8192;
pub const MAX_BYTES: usize = 750_000;

#[cw_serde]
pub struct Manifest {
    pub schema: u8,
    pub sha256: String,
    pub bytes: u32,
    pub chunks: Vec<String>,
}
#[cw_serde]
pub struct AttachmentStatus {
    pub manifest: Manifest,
    pub uploaded: Vec<u32>,
}
#[cw_serde]
pub struct AttachmentCapabilities {
    pub schema: u8,
    pub chunk_bytes: u32,
    pub max_bytes: u32,
}
pub const MANIFESTS: Map<(u64, u32), Manifest> = Map::new("review_body_manifests_v1");
pub const CHUNKS: Map<(u64, u32, u32), Binary> = Map::new("review_body_chunks_v1");
fn invalid() -> ContractError {
    StdError::generic_err("invalid or incomplete review attachment").into()
}
fn valid_hash(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c))
}
pub fn parse(body: &str) -> Result<Option<Manifest>, ContractError> {
    let Some(json) = body.strip_prefix(PREFIX) else {
        return Ok(None);
    };
    let manifest: Manifest = serde_json::from_str(json).map_err(|_| invalid())?;
    let bytes = manifest.bytes as usize;
    if manifest.schema != 1
        || bytes == 0
        || bytes > MAX_BYTES
        || !valid_hash(&manifest.sha256)
        || manifest.chunks.len() != bytes.div_ceil(CHUNK_BYTES)
        || manifest.chunks.iter().any(|h| !valid_hash(h))
        || serde_json::to_string(&manifest).map_err(|_| invalid())? != json
    {
        return Err(invalid());
    }
    Ok(Some(manifest))
}
pub fn put(
    storage: &mut dyn Storage,
    id: u64,
    version: u32,
    index: u32,
    data: Binary,
) -> Result<(), ContractError> {
    let manifest = MANIFESTS.load(storage, (id, version))?;
    let i = index as usize;
    if i >= manifest.chunks.len()
        || data.len() != (manifest.bytes as usize - i * CHUNK_BYTES).min(CHUNK_BYTES)
        || format!("{:x}", Sha256::digest(data.as_slice())) != manifest.chunks[i]
    {
        return Err(invalid());
    }
    if let Some(existing) = CHUNKS.may_load(storage, (id, version, index))? {
        if existing != data {
            return Err(invalid());
        }
        return Ok(()); // A lost receipt can be retried without replacing data.
    }
    CHUNKS.save(storage, (id, version, index), &data)?;
    Ok(())
}
pub fn assert_complete(storage: &dyn Storage, id: u64, version: u32) -> Result<(), ContractError> {
    let Some(manifest) = MANIFESTS.may_load(storage, (id, version))? else {
        return Ok(());
    };
    let mut digest = Sha256::new();
    for i in 0..manifest.chunks.len() {
        let data = CHUNKS
            .may_load(storage, (id, version, i as u32))?
            .ok_or_else(invalid)?;
        digest.update(data.as_slice());
    }
    if format!("{:x}", digest.finalize()) != manifest.sha256 {
        return Err(invalid());
    }
    Ok(())
}
pub fn status(storage: &dyn Storage, id: u64, version: u32) -> StdResult<Option<AttachmentStatus>> {
    let Some(manifest) = MANIFESTS.may_load(storage, (id, version))? else {
        return Ok(None);
    };
    let uploaded = (0..manifest.chunks.len() as u32)
        .filter(|i| CHUNKS.has(storage, (id, version, *i)))
        .collect();
    Ok(Some(AttachmentStatus { manifest, uploaded }))
}
