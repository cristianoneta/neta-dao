use super::*;
use cosmwasm_std::{testing::mock_env, Addr, Empty, Timestamp, Uint128};
use cw_multi_test::{App, Contract, ContractWrapper, Executor};
use ed25519_zebra::{SigningKey, VerificationKey};

#[derive(Deserialize)]
struct Fixture {
    config: Config,
    offer: SignedQuote,
    text: String,
    salt: String,
    commitment: String,
}
#[test]
fn node_ed25519_quote_and_commitment_match_registry() {
    let mut s = Suite::new(false);
    let fixture: Fixture =
        from_json(include_bytes!("../../../tests/fixtures/nns-v2-quote.json")).unwrap();
    assert_eq!(s.config(), fixture.config);
    assert_eq!(
        quote_preimage(&s.env(), &fixture.config, &fixture.offer.quote),
        fixture.text
    );
    assert_eq!(
        commitment(&s.env(), "alice", "alice.neta", &fixture.salt).unwrap(),
        fixture.commitment
    );
    let salt = s.commit("alice", "alice");
    assert_eq!(salt, fixture.salt);
    assert!(s.send("alice", fixture.offer, Some(salt)));
}

fn signer() -> SigningKey {
    SigningKey::from([7u8; 32])
}
fn public_key(key: &SigningKey) -> Binary {
    let bytes: [u8; 32] = VerificationKey::from(key).into();
    bytes.to_vec().into()
}
fn registry_code() -> Box<dyn Contract<Empty>> {
    Box::new(ContractWrapper::new(execute, instantiate, query))
}
fn profile_code() -> Box<dyn Contract<Empty>> {
    Box::new(ContractWrapper::new(
        neta_validator_profiles::execute,
        neta_validator_profiles::instantiate,
        neta_validator_profiles::query,
    ))
}
fn token_code(fail_forward: bool) -> Box<dyn Contract<Empty>> {
    if fail_forward {
        Box::new(ContractWrapper::new(
            failing_token_execute,
            cw20_base::contract::instantiate,
            cw20_base::contract::query,
        ))
    } else {
        Box::new(ContractWrapper::new(
            cw20_base::contract::execute,
            cw20_base::contract::instantiate,
            cw20_base::contract::query,
        ))
    }
}
fn failing_token_execute(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: cw20_base::msg::ExecuteMsg,
) -> Result<Response, cw20_base::ContractError> {
    if matches!(&msg, cw20_base::msg::ExecuteMsg::Transfer { recipient, .. } if recipient == "treasury")
    {
        return Err(fail("fixture: fee forwarding rejected").into());
    }
    cw20_base::contract::execute(deps, env, info, msg)
}

struct Suite {
    app: App,
    token: Addr,
    registry: Addr,
    profiles: Addr,
    nonce: u64,
}
impl Suite {
    fn new(fail_forward: bool) -> Self {
        Self::with_upgrade_admin(fail_forward, None)
    }
    fn with_upgrade_admin(fail_forward: bool, migration_admin: Option<String>) -> Self {
        let mut app = App::default();
        app.update_block(|b| {
            b.chain_id = "uni-7".into();
            b.time = Timestamp::from_seconds(1_700_000_000);
        });
        let token_id = app.store_code(token_code(fail_forward));
        let token = app
            .instantiate_contract(
                token_id,
                Addr::unchecked("deployer"),
                &cw20_base::msg::InstantiateMsg {
                    name: "Test NETA".into(),
                    symbol: "TNETA".into(),
                    decimals: 6,
                    initial_balances: ["alice", "bob", "charlie", "sponsor"]
                        .iter()
                        .map(|a| cw20::Cw20Coin {
                            address: (*a).into(),
                            amount: Uint128::new(1_000_000_000_000),
                        })
                        .collect(),
                    mint: None,
                    marketing: None,
                },
                &[],
                "test token",
                None,
            )
            .unwrap();
        let registry_id = app.store_code(registry_code());
        let registry = app
            .instantiate_contract(
                registry_id,
                Addr::unchecked("deployer"),
                &InstantiateMsg {
                    token: token.to_string(),
                    treasury: "treasury".into(),
                    admin: "admin".into(),
                    quote_public_key: public_key(&signer()),
                    testnet_only: true,
                },
                &[],
                "NNS v2 test",
                migration_admin.clone(),
            )
            .unwrap();
        app.execute_contract(
            Addr::unchecked("admin"),
            registry.clone(),
            &ExecuteMsg::SetPurchasesPaused { paused: false },
            &[],
        )
        .unwrap();
        let profile_id = app.store_code(profile_code());
        let profiles = app
            .instantiate_contract(
                profile_id,
                Addr::unchecked("deployer"),
                &neta_validator_profiles::msg::InstantiateMsg {
                    registry: registry.to_string(),
                },
                &[],
                "profiles",
                migration_admin,
            )
            .unwrap();
        Self {
            app,
            token,
            registry,
            profiles,
            nonce: 0,
        }
    }
    fn config(&self) -> Config {
        self.app
            .wrap()
            .query_wasm_smart(&self.registry, &QueryMsg::Config {})
            .unwrap()
    }
    fn identity(&self, n: &str) -> Identity {
        self.app
            .wrap()
            .query_wasm_smart(&self.registry, &QueryMsg::Identity { name: n.into() })
            .unwrap()
    }
    fn resolve(&self, n: &str) -> ResolveResponse {
        self.app
            .wrap()
            .query_wasm_smart(&self.registry, &QueryMsg::Resolve { name: n.into() })
            .unwrap()
    }
    fn balance(&self, a: &str) -> Uint128 {
        let r: cw20::BalanceResponse = self
            .app
            .wrap()
            .query_wasm_smart(
                &self.token,
                &cw20::Cw20QueryMsg::Balance { address: a.into() },
            )
            .unwrap();
        r.balance
    }
    fn env(&self) -> Env {
        let mut e = mock_env();
        e.block = self.app.block_info();
        e.contract.address = self.registry.clone();
        e
    }
    fn sign(&self, q: Quote) -> SignedQuote {
        let signature: [u8; 64] = signer()
            .sign(quote_preimage(&self.env(), &self.config(), &q).as_bytes())
            .into();
        SignedQuote {
            quote: q,
            signature: signature.to_vec().into(),
        }
    }
    fn offer(&mut self, payer: &str, n: &str, years: u8, operation: Operation) -> SignedQuote {
        let config = self.config();
        let now = self.app.block_info().time.seconds();
        self.nonce += 1;
        let (owner, generation, ownership_revision, expected_expires_at) =
            if operation == Operation::Register {
                (payer.to_string(), self.resolve(n).next_generation, 1, 0)
            } else {
                let r = self.identity(n);
                (r.owner, r.generation, r.ownership_revision, r.expires_at)
            };
        let n = name(n).unwrap();
        self.sign(Quote {
            operation,
            payer: payer.into(),
            owner,
            name: n.clone(),
            generation,
            ownership_revision,
            expected_expires_at,
            years,
            tariff_version: config.tariff_version,
            signer_version: config.signer_version,
            usd_per_neta_12: Uint128::new(2_000_000_000_000),
            amount: amount(&config.tariff, &n, years, Uint128::new(2_000_000_000_000)).unwrap(),
            nonce: format!("{:064x}", self.nonce),
            issued_at: now,
            expires_at: now + QUOTE_TTL,
        })
    }
    fn commit(&mut self, owner: &str, n: &str) -> String {
        let salt = "a1".repeat(32);
        let hash = commitment(&self.env(), owner, &name(n).unwrap(), &salt).unwrap();
        self.app
            .execute_contract(
                Addr::unchecked(owner),
                self.registry.clone(),
                &ExecuteMsg::Commit { hash },
                &[],
            )
            .unwrap();
        self.app.update_block(|b| {
            b.height += 1;
            b.time = b.time.plus_seconds(1);
        });
        salt
    }
    fn send(&mut self, payer: &str, offer: SignedQuote, salt: Option<String>) -> bool {
        let value = offer.quote.amount;
        let hook = if let Some(salt) = salt {
            HookMsg::Register { offer, salt }
        } else {
            HookMsg::Renew { offer }
        };
        self.app
            .execute_contract(
                Addr::unchecked(payer),
                self.token.clone(),
                &cw20::Cw20ExecuteMsg::Send {
                    contract: self.registry.to_string(),
                    amount: value,
                    msg: to_json_binary(&hook).unwrap(),
                },
                &[],
            )
            .is_ok()
    }
    fn register(&mut self, who: &str, n: &str, years: u8) {
        let salt = self.commit(who, n);
        let offer = self.offer(who, n, years, Operation::Register);
        assert!(self.send(who, offer, Some(salt)));
    }
    fn transfer(&mut self, from: &str, to: &str, n: &str) -> u64 {
        let r = self.identity(n);
        self.app
            .execute_contract(
                Addr::unchecked(from),
                self.registry.clone(),
                &ExecuteMsg::OfferTransfer {
                    name: n.into(),
                    recipient: to.into(),
                    expires_at: self.app.block_info().time.seconds() + 100,
                    expected_generation: r.generation,
                    expected_ownership_revision: r.ownership_revision,
                },
                &[],
            )
            .unwrap();
        let offer: Option<TransferOffer> = self
            .app
            .wrap()
            .query_wasm_smart(&self.registry, &QueryMsg::TransferOffer { name: n.into() })
            .unwrap();
        offer.unwrap().id
    }
    fn accept(&mut self, who: &str, n: &str, id: u64) -> bool {
        self.app
            .execute_contract(
                Addr::unchecked(who),
                self.registry.clone(),
                &ExecuteMsg::AcceptTransfer {
                    name: n.into(),
                    offer_id: id,
                },
                &[],
            )
            .is_ok()
    }
}

#[test]
fn registration_prices_for_all_lengths_are_forwarded_exactly() {
    let mut s = Suite::new(false);
    for (who, n, fee) in [
        ("alice", "abc", 320_000_000u128),
        ("bob", "abcd", 80_000_000),
        ("charlie", "alice", 2_500_000),
    ] {
        let before = s.balance("treasury");
        s.register(who, n, 1);
        assert_eq!(s.balance("treasury") - before, Uint128::new(fee));
        assert_eq!(s.resolve(n).owner.as_deref(), Some(who));
        assert_eq!(s.identity(n).generation, 1);
        assert_eq!(s.balance(s.registry.as_str()), Uint128::zero());
    }
}

#[test]
fn fee_rounding_and_name_normalization_are_exact() {
    let t = Tariff {
        three_cents: 64000,
        four_cents: 16000,
        standard_cents: 500,
    };
    assert_eq!(name(" ALICE.NETA ").unwrap(), "alice.neta");
    assert_eq!(
        amount(&t, "alice.neta", 1, Uint128::new(3_000_000_000_000)).unwrap(),
        Uint128::new(1_666_667)
    );
    for n in ["ab", "dao", "x.dao.neta", "a--bc", "a_bc", "éabc"] {
        assert!(name(n).is_err());
    }
    assert!(amount(&t, "alice.neta", 0, Uint128::one()).is_err());
    assert!(amount(&t, "alice.neta", 6, Uint128::one()).is_err());
    assert!(amount(&t, "alice.neta", 1, Uint128::zero()).is_err());
}

#[test]
fn third_party_renewal_preserves_identity_and_cap() {
    let mut s = Suite::new(false);
    s.register("alice", "alice", 1);
    let before = s.identity("alice");
    let q = s.offer("sponsor", "alice", 2, Operation::Renew);
    assert!(s.send("sponsor", q, None));
    let r = s.identity("alice");
    assert_eq!(r.owner, before.owner);
    assert_eq!(r.generation, before.generation);
    assert_eq!(r.ownership_revision, before.ownership_revision);
    assert_eq!(r.expires_at, before.expires_at + 2 * YEAR);
    let bad = s.offer("sponsor", "alice", 3, Operation::Renew);
    assert!(!s.send("sponsor", bad, None));
    assert_eq!(s.identity("alice"), r);
}

#[test]
fn grace_renewal_starts_now_and_release_increments_generation() {
    let mut s = Suite::new(false);
    s.register("alice", "alice", 1);
    let old = s.identity("alice");
    s.app
        .update_block(|b| b.time = Timestamp::from_seconds(old.expires_at + 10));
    assert!(s.resolve("alice").in_grace);
    assert!(!s.resolve("alice").active);
    // Historical identity is still available to the profile contract.
    assert_eq!(s.identity("alice"), old);
    let renewal = s.offer("sponsor", "alice", 1, Operation::Renew);
    assert!(s.send("sponsor", renewal, None));
    let renewed = s.identity("alice");
    assert_eq!(renewed.expires_at, s.app.block_info().time.seconds() + YEAR);
    s.app
        .update_block(|b| b.time = Timestamp::from_seconds(renewed.expires_at + GRACE));
    assert!(s.resolve("alice").available);
    let renewal = s.offer("sponsor", "alice", 1, Operation::Renew);
    assert!(!s.send("sponsor", renewal, None));
    s.register("bob", "alice", 1);
    assert_eq!(s.identity("alice").generation, 2);
    assert_eq!(s.identity("alice").owner, "bob");
}

#[test]
fn offers_require_recipient_acceptance_and_fresh_offer_id() {
    let mut s = Suite::new(false);
    s.register("alice", "alice", 1);
    let before = s.identity("alice");
    let first = s.transfer("alice", "bob", "alice");
    assert_eq!(s.identity("alice"), before);
    assert!(!s.accept("charlie", "alice", first));
    s.app
        .execute_contract(
            Addr::unchecked("alice"),
            s.registry.clone(),
            &ExecuteMsg::CancelTransfer {
                name: "alice".into(),
                offer_id: first,
            },
            &[],
        )
        .unwrap();
    let second = s.transfer("alice", "bob", "alice");
    assert!(second > first);
    assert!(!s.accept("bob", "alice", first));
    assert!(s.accept("bob", "alice", second));
    let after = s.identity("alice");
    assert_eq!(after.owner, "bob");
    assert_eq!(after.expires_at, before.expires_at);
    assert_eq!(after.ownership_revision, before.ownership_revision + 1);
    assert!(!s.accept("bob", "alice", second));
}

#[test]
fn one_active_name_is_checked_at_registration_renewal_and_acceptance() {
    let mut s = Suite::new(false);
    s.register("alice", "alice", 1);
    s.register("bob", "bobby", 1);
    let offer = s.transfer("alice", "bob", "alice");
    assert!(!s.accept("bob", "alice", offer));
    let salt = s.commit("alice", "other");
    let q = s.offer("alice", "other", 1, Operation::Register);
    assert!(!s.send("alice", q, Some(salt)));
    let c: Option<Commitment> = s
        .app
        .wrap()
        .query_wasm_smart(
            &s.registry,
            &QueryMsg::Commitment {
                address: "alice".into(),
            },
        )
        .unwrap();
    s.app
        .execute_contract(
            Addr::unchecked("alice"),
            s.registry.clone(),
            &ExecuteMsg::CancelCommit {
                hash: c.unwrap().hash,
            },
            &[],
        )
        .unwrap();
    let expiry = s.identity("alice").expires_at;
    s.app
        .update_block(|b| b.time = Timestamp::from_seconds(expiry));
    s.register("alice", "other", 1);
    let q = s.offer("sponsor", "alice", 1, Operation::Renew);
    assert!(!s.send("sponsor", q, None));
}

#[test]
fn quote_replay_tampering_and_cross_operation_fail_atomically() {
    let mut s = Suite::new(false);
    let salt = s.commit("alice", "alice");
    let valid = s.offer("alice", "alice", 1, Operation::Register);
    let before = s.balance("alice");
    for change in 0..6 {
        let mut q = valid.clone();
        match change {
            0 => q.quote.amount += Uint128::one(),
            1 => q.quote.owner = "bob".into(),
            2 => q.quote.payer = "bob".into(),
            3 => q.quote.name = "other.neta".into(),
            4 => q.signature = vec![0; 64].into(),
            _ => q.quote.generation += 1,
        }
        assert!(!s.send("alice", q, Some(salt.clone())));
        assert_eq!(s.balance("alice"), before);
    }
    assert!(!s.send("alice", valid.clone(), None));
    assert!(s.send("alice", valid.clone(), Some(salt.clone())));
    let paid = s.balance("alice");
    assert!(!s.send("alice", valid, Some(salt)));
    assert_eq!(s.balance("alice"), paid);
}

#[test]
fn stale_concurrent_renewal_and_post_transfer_quote_fail() {
    let mut s = Suite::new(false);
    s.register("alice", "alice", 1);
    let first = s.offer("sponsor", "alice", 1, Operation::Renew);
    let stale = s.offer("sponsor", "alice", 1, Operation::Renew);
    assert!(s.send("sponsor", first, None));
    assert!(!s.send("sponsor", stale, None));
    let stale = s.offer("sponsor", "alice", 1, Operation::Renew);
    let id = s.transfer("alice", "bob", "alice");
    assert!(s.accept("bob", "alice", id));
    assert!(!s.send("sponsor", stale, None));
}

#[test]
fn quote_expiry_key_rotation_and_pause_require_new_offer() {
    let mut s = Suite::new(false);
    let salt = s.commit("alice", "alice");
    let q = s.offer("alice", "alice", 1, Operation::Register);
    s.app
        .update_block(|b| b.time = b.time.plus_seconds(QUOTE_TTL));
    assert!(!s.send("alice", q, Some(salt.clone())));
    let q = s.offer("alice", "alice", 1, Operation::Register);
    assert!(s
        .app
        .execute_contract(
            Addr::unchecked("attacker"),
            s.registry.clone(),
            &ExecuteMsg::SetPurchasesPaused { paused: true },
            &[]
        )
        .is_err());
    s.app
        .execute_contract(
            Addr::unchecked("admin"),
            s.registry.clone(),
            &ExecuteMsg::SetPurchasesPaused { paused: true },
            &[],
        )
        .unwrap();
    assert!(!s.send("alice", q.clone(), Some(salt.clone())));
    s.app
        .execute_contract(
            Addr::unchecked("admin"),
            s.registry.clone(),
            &ExecuteMsg::SetPurchasesPaused { paused: false },
            &[],
        )
        .unwrap();
    s.app
        .execute_contract(
            Addr::unchecked("admin"),
            s.registry.clone(),
            &ExecuteMsg::RotateQuoteKey {
                public_key: public_key(&SigningKey::from([8; 32])),
                expected_version: 1,
            },
            &[],
        )
        .unwrap();
    assert!(!s.send("alice", q, Some(salt)));
}

#[test]
fn fee_forwarding_failure_rolls_back_token_and_registry_state() {
    let mut s = Suite::new(true);
    let salt = s.commit("alice", "alice");
    let q = s.offer("alice", "alice", 1, Operation::Register);
    let before = s.balance("alice");
    assert!(!s.send("alice", q.clone(), Some(salt.clone())));
    assert_eq!(s.balance("alice"), before);
    assert_eq!(s.balance("treasury"), Uint128::zero());
    assert!(s.resolve("alice").available);
    let c: Option<Commitment> = s
        .app
        .wrap()
        .query_wasm_smart(
            &s.registry,
            &QueryMsg::Commitment {
                address: "alice".into(),
            },
        )
        .unwrap();
    assert!(c.is_some());
    assert!(!s.send("alice", q, Some(salt)));
}

#[test]
fn actual_registry_profile_integration_clears_contacts_on_transfer_and_reregistration() {
    use neta_validator_profiles::msg::{
        Contacts, ExecuteMsg as PExec, ProfileResponse, QueryMsg as PQuery,
    };
    let mut s = Suite::new(false);
    s.register("alice", "alice", 1);
    s.app
        .execute_contract(
            Addr::unchecked("alice"),
            s.profiles.clone(),
            &PExec::UpdateContacts {
                name: "alice.neta".into(),
                expected_revision: 0,
                contacts: Contacts {
                    email: "alice@example.org".into(),
                    ..Contacts::default()
                },
            },
            &[],
        )
        .unwrap();
    let p: ProfileResponse = s
        .app
        .wrap()
        .query_wasm_smart(
            &s.profiles,
            &PQuery::Profile {
                name: "alice.neta".into(),
            },
        )
        .unwrap();
    assert_eq!(p.profile.unwrap().contacts.email, "alice@example.org");
    let id = s.transfer("alice", "bob", "alice");
    assert!(s.accept("bob", "alice", id));
    let p: ProfileResponse = s
        .app
        .wrap()
        .query_wasm_smart(
            &s.profiles,
            &PQuery::Profile {
                name: "alice.neta".into(),
            },
        )
        .unwrap();
    let p = p.profile.unwrap();
    assert_eq!(p.identity.owner, "bob");
    assert_eq!(p.contacts, Contacts::default());
    assert!(s
        .app
        .execute_contract(
            Addr::unchecked("alice"),
            s.profiles.clone(),
            &PExec::UpdateContacts {
                name: "alice.neta".into(),
                expected_revision: p.revision,
                contacts: Contacts::default()
            },
            &[]
        )
        .is_err());
    let expiry = s.identity("alice").expires_at;
    s.app
        .update_block(|b| b.time = Timestamp::from_seconds(expiry));
    let p: ProfileResponse = s
        .app
        .wrap()
        .query_wasm_smart(
            &s.profiles,
            &PQuery::Profile {
                name: "alice.neta".into(),
            },
        )
        .unwrap();
    assert!(!p.active);
    s.app.update_block(|b| b.time = b.time.plus_seconds(GRACE));
    s.register("charlie", "alice", 1);
    let p: ProfileResponse = s
        .app
        .wrap()
        .query_wasm_smart(
            &s.profiles,
            &PQuery::Profile {
                name: "alice.neta".into(),
            },
        )
        .unwrap();
    let p = p.profile.unwrap();
    assert_eq!(p.identity.generation, 2);
    assert_eq!(p.contacts, Contacts::default());
}

#[test]
fn commitment_maturity_expiry_and_cancellation_are_enforced() {
    let mut s = Suite::new(false);
    let salt = "a1".repeat(32);
    let hash = commitment(&s.env(), "alice", "alice.neta", &salt).unwrap();
    let commit = ExecuteMsg::Commit { hash: hash.clone() };
    s.app
        .execute_contract(Addr::unchecked("alice"), s.registry.clone(), &commit, &[])
        .unwrap();
    let q = s.offer("alice", "alice", 1, Operation::Register);
    let before = s.balance("alice");
    assert!(!s.send("alice", q.clone(), Some(salt.clone()))); // Same block.
    assert_eq!(s.balance("alice"), before);
    assert!(s
        .app
        .execute_contract(Addr::unchecked("alice"), s.registry.clone(), &commit, &[])
        .is_err());
    assert!(s
        .app
        .execute_contract(
            Addr::unchecked("bob"),
            s.registry.clone(),
            &ExecuteMsg::CancelCommit { hash: hash.clone() },
            &[]
        )
        .is_err());
    assert!(s
        .app
        .execute_contract(
            Addr::unchecked("alice"),
            s.registry.clone(),
            &ExecuteMsg::CancelCommit {
                hash: "00".repeat(32)
            },
            &[]
        )
        .is_err());
    s.app.update_block(|b| {
        b.height += 1;
        b.time = b.time.plus_seconds(COMMIT_TTL);
    });
    let fresh = s.offer("alice", "alice", 1, Operation::Register);
    assert!(!s.send("alice", fresh, Some(salt.clone()))); // Expired commitment, fresh quote.
    s.app
        .execute_contract(
            Addr::unchecked("alice"),
            s.registry.clone(),
            &ExecuteMsg::CancelCommit { hash },
            &[],
        )
        .unwrap();
    let new_salt = s.commit("alice", "alice");
    let fresh = s.offer("alice", "alice", 1, Operation::Register);
    assert!(s.send("alice", fresh, Some(new_salt)));
}

#[test]
fn quotes_cannot_cross_registry_chain_or_tariff_and_receive_cannot_be_forged() {
    let mut s = Suite::new(false);
    let salt = s.commit("alice", "alice");
    let q = s.offer("alice", "alice", 1, Operation::Register);
    for chain in [false, true] {
        let mut env = s.env();
        if chain {
            env.block.chain_id = "juno-1".into();
        } else {
            env.contract.address = Addr::unchecked("other-registry");
        }
        let bytes: [u8; 64] = signer()
            .sign(quote_preimage(&env, &s.config(), &q.quote).as_bytes())
            .into();
        let mut altered = q.clone();
        altered.signature = bytes.to_vec().into();
        assert!(!s.send("alice", altered, Some(salt.clone())));
    }
    let receive = ExecuteMsg::Receive(Cw20ReceiveMsg {
        sender: "alice".into(),
        amount: q.quote.amount,
        msg: to_json_binary(&HookMsg::Register {
            offer: q.clone(),
            salt: salt.clone(),
        })
        .unwrap(),
    });
    assert!(s
        .app
        .execute_contract(Addr::unchecked("alice"), s.registry.clone(), &receive, &[])
        .is_err());
    assert!(s.resolve("alice").available);
    let tariff = Tariff {
        three_cents: 64_000,
        four_cents: 16_000,
        standard_cents: 600,
    };
    let change = ExecuteMsg::SetTariff {
        tariff,
        expected_version: 1,
    };
    assert!(s
        .app
        .execute_contract(Addr::unchecked("alice"), s.registry.clone(), &change, &[])
        .is_err());
    s.app
        .execute_contract(Addr::unchecked("admin"), s.registry.clone(), &change, &[])
        .unwrap();
    assert!(!s.send("alice", q, Some(salt.clone())));
    assert!(s
        .app
        .execute_contract(Addr::unchecked("admin"), s.registry.clone(), &change, &[])
        .is_err());
    let fresh = s.offer("alice", "alice", 1, Operation::Register);
    assert!(s.send("alice", fresh, Some(salt)));
    assert_eq!(s.balance("treasury"), Uint128::new(3_000_000));
}

#[test]
fn deployment_rejects_wrong_chain_and_mainnet_destination() {
    use cosmwasm_std::testing::{mock_dependencies, mock_info};
    let msg = InstantiateMsg {
        token: "token".into(),
        treasury: "treasury".into(),
        admin: "admin".into(),
        quote_public_key: public_key(&signer()),
        testnet_only: true,
    };
    let mut deps = mock_dependencies();
    let mut env = mock_env();
    env.block.chain_id = "juno-1".into();
    assert!(instantiate(
        deps.as_mut(),
        env.clone(),
        mock_info("deployer", &[]),
        msg.clone()
    )
    .unwrap_err()
    .to_string()
    .contains("UNI-7 only"));
    let mut mainnet = msg;
    mainnet.testnet_only = false;
    assert!(
        instantiate(deps.as_mut(), env, mock_info("deployer", &[]), mainnet)
            .unwrap_err()
            .to_string()
            .contains("pinned NETA token")
    );
}

#[test]
fn approved_short_name_tariff_applies_to_registration_and_renewal() {
    let mut s = Suite::new(false);
    let tariff = Tariff {
        three_cents: 9_900,
        four_cents: 1_900,
        standard_cents: 500,
    };
    s.app
        .execute_contract(
            Addr::unchecked("admin"),
            s.registry.clone(),
            &ExecuteMsg::SetTariff {
                tariff,
                expected_version: 1,
            },
            &[],
        )
        .unwrap();
    assert_eq!(s.config().tariff_version, 2);
    for (who, n, fee) in [
        ("alice", "abc", 49_500_000u128),
        ("bob", "abcd", 9_500_000),
        ("charlie", "alice", 2_500_000),
    ] {
        let before = s.balance("treasury");
        s.register(who, n, 1);
        assert_eq!(s.balance("treasury") - before, Uint128::new(fee));
        let identity = s.identity(n);
        let quote = s.offer("sponsor", n, 1, Operation::Renew);
        assert!(s.send("sponsor", quote, None));
        assert_eq!(s.balance("treasury") - before, Uint128::new(fee * 2));
        assert_eq!(s.identity(n).owner, identity.owner);
        assert_eq!(s.identity(n).expires_at, identity.expires_at + YEAR);
    }
}

#[derive(Deserialize)]
struct SnapshotFixture {
    offer: SnapshotOffer,
    text: String,
}
impl Suite {
    fn snapshot_offer(&mut self, payer: &str, n: &str, operation: Operation) -> SnapshotOffer {
        let quote = self.offer(payer, n, 1, operation).quote;
        let snapshot = PriceSnapshot {
            signer_version: self.config().signer_version,
            usd_per_neta_12: quote.usd_per_neta_12,
            observed_at: self.env().block.time.seconds() - 3600,
            expires_at: self.env().block.time.seconds() - 3600 + PRICE_SNAPSHOT_TTL,
        };
        let signature: [u8; 64] = signer()
            .sign(price_snapshot_preimage(&self.env(), &self.config(), &snapshot).as_bytes())
            .into();
        SnapshotOffer {
            quote,
            snapshot,
            signature: signature.to_vec().into(),
        }
    }
    fn send_snapshot(&mut self, payer: &str, offer: SnapshotOffer, salt: Option<String>) -> bool {
        let value = offer.quote.amount;
        let hook = if let Some(salt) = salt {
            HookMsg::RegisterSnapshot { offer, salt }
        } else {
            HookMsg::RenewSnapshot { offer }
        };
        self.app
            .execute_contract(
                Addr::unchecked(payer),
                self.token.clone(),
                &cw20::Cw20ExecuteMsg::Send {
                    contract: self.registry.to_string(),
                    amount: value,
                    msg: to_json_binary(&hook).unwrap(),
                },
                &[],
            )
            .is_ok()
    }
    fn resign_snapshot(&self, offer: &mut SnapshotOffer) {
        let signature: [u8; 64] = signer()
            .sign(price_snapshot_preimage(&self.env(), &self.config(), &offer.snapshot).as_bytes())
            .into();
        offer.signature = signature.to_vec().into();
    }
}
#[test]
fn shared_price_signature_matches_node_and_pays_dao_exactly() {
    let mut s = Suite::new(false);
    let fixture: SnapshotFixture = from_json(include_bytes!(
        "../../../tests/fixtures/nns-price-snapshot.json"
    ))
    .unwrap();
    assert_eq!(
        price_snapshot_preimage(&s.env(), &s.config(), &fixture.offer.snapshot),
        fixture.text
    );
    let salt = s.commit("alice", "alice");
    let before = s.balance("alice");
    let fee = fixture.offer.quote.amount;
    assert!(s.send_snapshot("alice", fixture.offer.clone(), Some(salt.clone())));
    assert_eq!(s.balance("alice"), before - fee);
    assert_eq!(s.balance("treasury"), fee);
    assert!(!s.send_snapshot("alice", fixture.offer.clone(), Some(salt)));
    // The same price/signature intentionally prices another buyer and name.
    let salt = s.commit("bob", "bobby");
    let mut b = s.snapshot_offer("bob", "bobby", Operation::Register);
    b.snapshot = fixture.offer.snapshot;
    b.signature = fixture.offer.signature;
    assert!(s.send_snapshot("bob", b, Some(salt)));
    let renewal = s.snapshot_offer("sponsor", "alice", Operation::Renew);
    assert!(s.send_snapshot("sponsor", renewal.clone(), None));
    assert_eq!(s.identity("alice.neta").owner, "alice");
    assert!(!s.send_snapshot("sponsor", renewal, None));
}
#[test]
fn snapshot_rejects_forged_rates_underpayment_wrong_sender_and_identity() {
    let mut s = Suite::new(false);
    let salt = s.commit("alice", "alice");
    let original = s.snapshot_offer("alice", "alice", Operation::Register);
    for case in 0..7 {
        let mut o = original.clone();
        match case {
            0 => o.quote.amount = Uint128::one(),
            1 => o.quote.usd_per_neta_12 = Uint128::new(4_000_000_000_000),
            2 => {
                o.snapshot.usd_per_neta_12 = Uint128::new(4_000_000_000_000);
                o.quote.usd_per_neta_12 = o.snapshot.usd_per_neta_12;
                o.quote.amount = amount(
                    &s.config().tariff,
                    &o.quote.name,
                    1,
                    o.snapshot.usd_per_neta_12,
                )
                .unwrap();
            }
            3 => o.quote.owner = "bob".into(),
            4 => o.quote.payer = "bob".into(),
            5 => o.quote.generation = 2,
            _ => o.signature = Binary::from(vec![0u8; 64]),
        }
        assert!(!s.send_snapshot("alice", o, Some(salt.clone())));
    }
    assert!(s.send_snapshot("alice", original, Some(salt)));
}
#[test]
fn signed_but_invalid_snapshot_windows_and_changed_policy_are_rejected() {
    let mut s = Suite::new(false);
    let salt = s.commit("alice", "alice");
    let original = s.snapshot_offer("alice", "alice", Operation::Register);
    let now = s.env().block.time.seconds();
    for case in 0..5 {
        let mut o = original.clone();
        match case {
            0 => o.snapshot.observed_at = now + 1,
            1 => o.snapshot.expires_at = now,
            2 => o.snapshot.expires_at = o.snapshot.observed_at + PRICE_SNAPSHOT_TTL + 1,
            3 => o.snapshot.signer_version += 1,
            _ => o.snapshot.expires_at = now + 1, // review cannot outlive its price
        }
        s.resign_snapshot(&mut o);
        assert!(!s.send_snapshot("alice", o, Some(salt.clone())));
    }
    s.app
        .execute_contract(
            Addr::unchecked("admin"),
            s.registry.clone(),
            &ExecuteMsg::SetTariff {
                tariff: Tariff {
                    three_cents: 9900,
                    four_cents: 1900,
                    standard_cents: 500,
                },
                expected_version: 1,
            },
            &[],
        )
        .unwrap();
    assert!(!s.send_snapshot("alice", original, Some(salt.clone())));
    let fresh = s.snapshot_offer("alice", "alice", Operation::Register);
    s.app
        .execute_contract(
            Addr::unchecked("admin"),
            s.registry.clone(),
            &ExecuteMsg::RotateQuoteKey {
                public_key: public_key(&signer()),
                expected_version: 1,
            },
            &[],
        )
        .unwrap();
    assert!(!s.send_snapshot("alice", fresh, Some(salt)));
}
#[test]
fn snapshot_signature_is_bound_to_registry_chain_token_and_treasury() {
    let mut s = Suite::new(false);
    let salt = s.commit("alice", "alice");
    for case in 0..4 {
        let mut o = s.snapshot_offer("alice", "alice", Operation::Register);
        let mut env = s.env();
        let mut config = s.config();
        match case {
            0 => env.block.chain_id = "juno-1".into(),
            1 => env.contract.address = Addr::unchecked("other-registry"),
            2 => config.token = "other-token".into(),
            _ => config.treasury = "other-treasury".into(),
        }
        let signature: [u8; 64] = signer()
            .sign(price_snapshot_preimage(&env, &config, &o.snapshot).as_bytes())
            .into();
        o.signature = signature.to_vec().into();
        assert!(!s.send_snapshot("alice", o, Some(salt.clone())));
    }
}
#[test]
fn snapshot_payment_failure_rolls_back_commitment_and_balances() {
    let mut s = Suite::new(true);
    let salt = s.commit("alice", "alice");
    let o = s.snapshot_offer("alice", "alice", Operation::Register);
    let before = s.balance("alice");
    assert!(!s.send_snapshot("alice", o, Some(salt)));
    assert_eq!(s.balance("alice"), before);
    assert!(s.resolve("alice").available);
    let c: Option<Commitment> = s
        .app
        .wrap()
        .query_wasm_smart(
            &s.registry,
            &QueryMsg::Commitment {
                address: "alice".into(),
            },
        )
        .unwrap();
    assert!(c.is_some());
}

// A future target supplies its migrate entrypoint; the existing uploaded source
// need not have one. These synthetic targets preserve the current storage schema.
fn fixture_registry_upgrade(deps: DepsMut, _env: Env, _msg: Empty) -> StdResult<Response> {
    let old = cw2::get_contract_version(deps.storage)?;
    if old.contract != "crates.io:neta-names-v2" || old.version != "0.3.1" {
        return Err(fail("unsupported migration source"));
    }
    cw2::set_contract_version(deps.storage, &old.contract, "0.3.2-test")?;
    Ok(Response::new())
}
fn fixture_profile_upgrade(deps: DepsMut, _env: Env, _msg: Empty) -> StdResult<Response> {
    let old = cw2::get_contract_version(deps.storage)?;
    if old.contract != "crates.io:neta-validator-profiles" {
        return Err(fail("unsupported migration source"));
    }
    cw2::set_contract_version(deps.storage, &old.contract, "0.1.1-test")?;
    Ok(Response::new())
}
#[test]
fn wallet_upgrades_and_later_dao_admin_transfer_preserve_names_and_profiles() {
    use neta_validator_profiles::msg::{
        Contacts, ExecuteMsg as PExec, ProfileResponse, QueryMsg as PQuery,
    };
    let initial_admin = "juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57";
    for transfer_first in [false, true] {
        let mut s = Suite::with_upgrade_admin(false, Some(initial_admin.into()));
        s.register("alice", "alice", 2);
        s.app
            .execute_contract(
                Addr::unchecked("alice"),
                s.profiles.clone(),
                &PExec::UpdateContacts {
                    name: "alice.neta".into(),
                    expected_revision: 0,
                    contacts: Contacts {
                        email: "alice@example.org".into(),
                        ..Contacts::default()
                    },
                },
                &[],
            )
            .unwrap();
        let config = s.config();
        let identity = s.identity("alice");
        let query_profile = PQuery::Profile {
            name: "alice.neta".into(),
        };
        let before: ProfileResponse = s
            .app
            .wrap()
            .query_wasm_smart(&s.profiles, &query_profile)
            .unwrap();
        let new_registry = s.app.store_code(Box::new(
            ContractWrapper::new(execute, instantiate, query)
                .with_migrate(fixture_registry_upgrade),
        ));
        let new_profiles = s.app.store_code(Box::new(
            ContractWrapper::new(
                neta_validator_profiles::execute,
                neta_validator_profiles::instantiate,
                neta_validator_profiles::query,
            )
            .with_migrate(fixture_profile_upgrade),
        ));
        for (address, target) in [
            (s.registry.clone(), new_registry),
            (s.profiles.clone(), new_profiles),
        ] {
            let old = s.app.wrap().query_wasm_contract_info(&address).unwrap();
            assert_eq!(old.admin.as_deref(), Some(initial_admin));
            for sender in ["deployer", "alice", "admin", MAINNET_TREASURY] {
                assert!(s
                    .app
                    .migrate_contract(Addr::unchecked(sender), address.clone(), &Empty {}, target)
                    .is_err());
                assert_eq!(
                    s.app
                        .wrap()
                        .query_wasm_contract_info(&address)
                        .unwrap()
                        .code_id,
                    old.code_id
                );
            }
            let transfer = cosmwasm_std::WasmMsg::UpdateAdmin {
                contract_addr: address.to_string(),
                admin: MAINNET_TREASURY.into(),
            };
            assert!(s
                .app
                .execute(Addr::unchecked("deployer"), transfer.clone().into())
                .is_err());
            let effective_admin = if transfer_first {
                s.app
                    .execute(Addr::unchecked(initial_admin), transfer.into())
                    .unwrap();
                assert!(s
                    .app
                    .migrate_contract(
                        Addr::unchecked(initial_admin),
                        address.clone(),
                        &Empty {},
                        target
                    )
                    .is_err());
                MAINNET_TREASURY
            } else {
                initial_admin
            };
            s.app
                .migrate_contract(
                    Addr::unchecked(effective_admin),
                    address.clone(),
                    &Empty {},
                    target,
                )
                .unwrap();
            let after = s.app.wrap().query_wasm_contract_info(&address).unwrap();
            assert_eq!(after.code_id, target);
            assert_eq!(after.admin.as_deref(), Some(effective_admin));
        }
        assert_eq!(s.config(), config);
        assert_eq!(s.identity("alice"), identity);
        let after: ProfileResponse = s
            .app
            .wrap()
            .query_wasm_smart(&s.profiles, &query_profile)
            .unwrap();
        assert_eq!(after, before);
    }
}

#[test]
fn mainnet_owner_controls_tariffs_but_fees_remain_with_dao() {
    use cosmwasm_std::testing::{mock_dependencies, mock_info};
    use cosmwasm_std::{ContractResult, SystemResult};
    let owner = "juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57";
    let mut deps = mock_dependencies();
    // The token query has an explicit decimals field, never an admin/treasury override.
    deps.querier.update_wasm(|_| {
        SystemResult::Ok(ContractResult::Ok(Binary::from(
            br#"{"decimals":6}"#.as_slice(),
        )))
    });
    let mut env = mock_env();
    env.block.chain_id = "juno-1".into();
    instantiate(
        deps.as_mut(),
        env.clone(),
        mock_info("deployer", &[]),
        InstantiateMsg {
            token: MAINNET_TOKEN.into(),
            treasury: MAINNET_TREASURY.into(),
            admin: owner.into(),
            quote_public_key: public_key(&signer()),
            testnet_only: false,
        },
    )
    .unwrap();
    let initial = CONFIG.load(&deps.storage).unwrap();
    assert_eq!(
        initial.tariff,
        Tariff {
            three_cents: 9_900,
            four_cents: 1_900,
            standard_cents: 500
        }
    );
    let tariff = ExecuteMsg::SetTariff {
        tariff: Tariff {
            three_cents: 9_900,
            four_cents: 1_900,
            standard_cents: 600,
        },
        expected_version: 1,
    };
    for unauthorized in ["deployer", MAINNET_TREASURY] {
        assert!(execute(
            deps.as_mut(),
            env.clone(),
            mock_info(unauthorized, &[]),
            tariff.clone()
        )
        .is_err());
        assert!(execute(
            deps.as_mut(),
            env.clone(),
            mock_info(unauthorized, &[]),
            ExecuteMsg::SetAdmin {
                admin: unauthorized.into()
            }
        )
        .is_err());
    }
    execute(
        deps.as_mut(),
        env.clone(),
        mock_info(owner, &[]),
        tariff.clone(),
    )
    .unwrap();
    assert!(execute(deps.as_mut(), env.clone(), mock_info(owner, &[]), tariff).is_err());
    let before = CONFIG.load(&deps.storage).unwrap();
    assert_eq!(before.admin, owner);
    assert_eq!(before.treasury, MAINNET_TREASURY);
    assert_eq!(before.tariff.standard_cents, 600);
    assert_eq!(before.tariff_version, 2);
    assert!(before.purchases_paused);
    // Application admin can also be handed over later, separately from Wasm upgrade rights.
    execute(
        deps.as_mut(),
        env.clone(),
        mock_info(owner, &[]),
        ExecuteMsg::SetAdmin {
            admin: MAINNET_TREASURY.into(),
        },
    )
    .unwrap();
    assert!(execute(
        deps.as_mut(),
        env.clone(),
        mock_info(owner, &[]),
        ExecuteMsg::SetPurchasesPaused { paused: false }
    )
    .is_err());
    execute(
        deps.as_mut(),
        env,
        mock_info(MAINNET_TREASURY, &[]),
        ExecuteMsg::SetPurchasesPaused { paused: false },
    )
    .unwrap();
    let after = CONFIG.load(&deps.storage).unwrap();
    assert_eq!(after.treasury, before.treasury);
    assert_eq!(after.tariff, before.tariff);
    assert_eq!(after.admin, MAINNET_TREASURY);
}
