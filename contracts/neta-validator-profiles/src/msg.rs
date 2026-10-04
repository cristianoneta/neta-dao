use cosmwasm_std::Binary;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct InstantiateMsg {
    pub registry: String,
}

// Required v2 registry interface. Legacy v1 Resolve is deliberately incompatible.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum RegistryQuery {
    Identity { name: String },
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Identity {
    pub name: String,
    pub owner: String,
    pub generation: u64,
    pub ownership_revision: u64,
    pub expires_at: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq, JsonSchema)]
pub struct Contacts {
    pub description: String,
    pub discord: String,
    pub telegram: String,
    pub twitter: String,
    pub email: String,
    pub website: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Operator {
    pub chain_id: String,
    pub address: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Pair {
    pub mainnet: Operator,
    pub testnet: Operator,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Proof {
    pub public_key: Binary,
    pub signature: Binary,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ExecuteMsg {
    UpdateContacts {
        name: String,
        expected_revision: u64,
        contacts: Contacts,
    },
    LinkValidators {
        name: String,
        expected_revision: u64,
        pair: Pair,
        expires_at: u64,
        mainnet_proof: Proof,
        testnet_proof: Proof,
    },
    UnlinkValidators {
        name: String,
        expected_revision: u64,
    },
    // Either operator may withdraw its consent, even if the name owner refuses.
    RevokeByOperator {
        name: String,
        expected_revision: u64,
        expires_at: u64,
        operator: Operator,
        proof: Proof,
    },
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum QueryMsg {
    Config {},
    Profile {
        name: String,
    },
    OperatorBinding {
        operator: Operator,
    },
    Challenge {
        name: String,
        expected_revision: u64,
        pair: Pair,
        expires_at: u64,
        revoke: bool,
    },
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Profile {
    pub identity: Identity,
    pub revision: u64,
    pub contacts: Contacts,
    pub validators: Option<Pair>,
    pub updated_at: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct ProfileResponse {
    pub active: bool,
    // Expired/reassigned identities do not expose old contact data or proofs.
    pub profile: Option<Profile>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct ChallengeResponse {
    pub text: String,
    pub mainnet_signer: String,
    pub testnet_signer: String,
}
