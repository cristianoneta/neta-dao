use cosmwasm_std::{Binary, Uint128};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct InstantiateMsg {
    pub token: String,
    pub treasury: String,
    pub admin: String,
    pub quote_public_key: Binary,
    pub testnet_only: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Tariff {
    pub three_cents: u64,
    pub four_cents: u64,
    pub standard_cents: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Config {
    pub chain_id: String,
    pub token: String,
    pub treasury: String,
    pub admin: String,
    pub quote_public_key: Binary,
    pub signer_version: u64,
    pub tariff: Tariff,
    pub tariff_version: u64,
    pub purchases_paused: bool,
    pub testnet_only: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum Operation {
    Register,
    Renew,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Quote {
    pub operation: Operation,
    pub payer: String,
    pub owner: String,
    pub name: String,
    pub generation: u64,
    pub ownership_revision: u64,
    pub expected_expires_at: u64,
    pub years: u8,
    pub tariff_version: u64,
    pub signer_version: u64,
    // USD per ONE NETA, scaled by 10^12. NETA itself has six decimals.
    pub usd_per_neta_12: Uint128,
    pub amount: Uint128,
    pub nonce: String,
    pub issued_at: u64,
    pub expires_at: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct SignedQuote {
    pub quote: Quote,
    pub signature: Binary,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Cw20ReceiveMsg {
    pub sender: String,
    pub amount: Uint128,
    pub msg: Binary,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum HookMsg {
    Register { offer: SignedQuote, salt: String },
    Renew { offer: SignedQuote },
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ExecuteMsg {
    Commit {
        hash: String,
    },
    CancelCommit {
        hash: String,
    },
    Receive(Cw20ReceiveMsg),
    OfferTransfer {
        name: String,
        recipient: String,
        expires_at: u64,
        expected_generation: u64,
        expected_ownership_revision: u64,
    },
    AcceptTransfer {
        name: String,
        offer_id: u64,
    },
    CancelTransfer {
        name: String,
        offer_id: u64,
    },
    SetPurchasesPaused {
        paused: bool,
    },
    RotateQuoteKey {
        public_key: Binary,
        expected_version: u64,
    },
    SetTariff {
        tariff: Tariff,
        expected_version: u64,
    },
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Identity {
    pub name: String,
    pub owner: String,
    pub generation: u64,
    pub ownership_revision: u64,
    pub expires_at: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Commitment {
    pub hash: String,
    pub height: u64,
    pub expires_at: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct TransferOffer {
    pub id: u64,
    pub owner: String,
    pub recipient: String,
    pub generation: u64,
    pub ownership_revision: u64,
    pub expires_at: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct ResolveResponse {
    pub name: String,
    pub owner: Option<String>,
    // Only an owner identity; NOT a verified receiving/payment address record.
    pub active: bool,
    pub in_grace: bool,
    pub available: bool,
    pub expires_at: Option<u64>,
    pub next_generation: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct NameOfResponse {
    pub address: String,
    pub name: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum QueryMsg {
    Config {},
    Identity { name: String },
    Resolve { name: String },
    NameOf { address: String },
    Commitment { address: String },
    TransferOffer { name: String },
    QuotePreimage { quote: Quote },
}
