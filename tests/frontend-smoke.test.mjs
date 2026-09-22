import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const governance = readFileSync("neta-governance.js", "utf8");
const html = readFileSync("index.html", "utf8");
const treasury = readFileSync("treasury.js", "utf8");
const ux = readFileSync("ux-draft.js", "utf8");
const relay = readFileSync("relay.js", "utf8");
const tokenRegistry = JSON.parse(readFileSync("data/treasury/token-registry.json", "utf8"));

test("browser scripts parse", () => {
  execFileSync(process.execPath, ["--check", "neta-governance.js"]);
  execFileSync(process.execPath, ["--check", "ux-draft.js"]);
  execFileSync(process.execPath, ["--check", "treasury.js"]);
  execFileSync(process.execPath, ["--check", "relay.js"]);
});

test("Relay follows DAOs and creates local governance notifications safely", () => {
  for (const id of ["relay-view", "relay-unread-badge", "relay-feed", "relay-mark-read", "relay-new-message", "relay-composer", "relay-discard-message"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(relay, /neta-relay-favorites:v1/);
  assert.match(relay, /NEW PROPOSAL/);
  assert.match(relay, /STATUS CHANGED/);
  assert.match(relay, /NEW REVISION/);
  assert.match(relay, /neta:relay-open/);
  assert.doesNotMatch(relay, /\.innerHTML\s*=|insertAdjacentHTML|\.outerHTML\s*=/);
});

test("Relay messaging remains locked behind explicit security gates", () => {
  assert.match(html, /End-to-end encryption requires the UNI-7 messaging contract/);
  assert.match(html, /TESTNET · NO STAKE GATE/);
  assert.match(relay, /ENCRYPTED MESSAGING IS NOT ACTIVE YET/);
  assert.match(relay, /MESSAGE NOT SENT · UNI-7 CONTRACT ACTIVATION REQUIRED/);
  assert.match(relay, /closeComposer/);
});

test("Relay prioritizes messages before governance in the inbox", () => {
  const messages = html.indexOf('data-relay-filter="messages"');
  const governanceFilter = html.indexOf('data-relay-filter="governance"');
  assert.ok(messages > -1 && messages < governanceFilter);
});

test("Relay hides a zero badge and keeps the inbox before the watchlist", () => {
  const relayCss = readFileSync("relay.css", "utf8");
  assert.match(relayCss, /relay-unread-badge\[hidden\]\{display:none\}/);
  assert.match(relayCss, /relay-feed-card\{order:1\}/);
  assert.match(relayCss, /relay-watchlist\{order:2\}/);
});

test("Juno community history is seeded with two daily snapshots", () => {
  const history = JSON.parse(readFileSync("data/treasury/juno-community-history.json", "utf8"));
  assert.ok(history.snapshots.length >= 2);
  assert.notEqual(history.snapshots.at(-2).generated_at.slice(0, 10), history.snapshots.at(-1).generated_at.slice(0, 10));
  assert.ok(history.snapshots.every(snapshot => snapshot.assets.length > 0));
});

test("treasury renders LP ownership and underlying assets without HTML injection", () => {
  assert.match(treasury, /item\.type==="lp"/);
  assert.match(treasury, /item\.underlyings/);
  assert.doesNotMatch(treasury, /\.innerHTML\s*=|insertAdjacentHTML|\.outerHTML\s*=/);
  for (const id of ["treasury-assets", "treasury-total", "treasury-updated", "treasury-refresh"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
});

test("DAO selection propagates to non-proposal workspace views", () => {
  assert.match(governance, /neta:dao-change/);
  assert.match(treasury, /juno-community-pool\.json/);
  assert.match(treasury, /community_pool/);
  assert.match(ux, /JUNO NETWORK GOVERNANCE · TREASURY/);
  assert.match(ux, /NO LIVE/);
});

test("workspace view survives refresh and supports direct links", () => {
  assert.match(ux, /neta-workspace-active-view/);
  assert.match(ux, /window\.location\.hash/);
  assert.match(ux, /history\.replaceState/);
  assert.match(ux, /hashchange/);
  assert.match(ux, /selectView\(initialView/);
});

test("treasury denom identities are persisted outside generated snapshots", () => {
  assert.equal(tokenRegistry["ibc/4A482FA914A4B9B05801ED81C33713899F322B24F76A06F4B8FE872485EA22FF"].symbol, "USDC.n");
  assert.equal(tokenRegistry["ibc/171E8F6687D290D378678310F9F15D367DCD245BF06184532B703A92054A8A4F"].decimals, 18);
  assert.equal(tokenRegistry["ibc/C4CFF46FD6DE35CA4CF4CE031E643C8FDC9BA4B99AE598E9B0ED98FE3A2319F9"].symbol, "ATOM");
});

test("operations treasury includes the DAO-controlled Osmosis Polytone proxy", () => {
  const collector = readFileSync("scripts/update_treasury.py", "utf8");
  assert.match(collector, /osmo1xjfyz4f7da2yu43c0ptlswyln50wqyj53495sesaq40ja5megq4qms9f80/);
  assert.match(collector, /polytone-proxy/);
  assert.match(treasury, /source_chain/);
});

test("operations events replay the address index and keep a durable watermark", () => {
  const collector = readFileSync("scripts/update_treasury_events.py", "utf8");
  assert.match(collector, /last_scanned_height/);
  assert.match(collector, /full-address-index-replay/);
  assert.match(collector, /historical address index is empty/);
});

test("treasury events replace sample activity with verified linked transactions", () => {
  for (const id of ["treasury-events", "treasury-events-toggle", "treasury-event-filters", "treasury-event-count"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(treasury, /data\/treasury\/events\.json/);
  assert.match(treasury, /neta:open-proposal/);
  assert.match(treasury, /testingaten/);
  assert.match(governance, /neta:open-proposal/);
  assert.doesNotMatch(html, /4,200 USDC received from Osmosis|2,500 JUNO → 731\.42 NETA|Milestone 02 released/);
});

test("small and unpriced treasury assets are collapsed without changing totals", () => {
  assert.match(treasury, /Number\(item\.usd_value\)>=50/);
  assert.match(treasury, /SMALL \/ UNPRICED ASSETS/);
  assert.match(treasury, /renderAssets\(data\.assets,totalUsd,data\.warnings\|\|\[\],policyText\)/);
  assert.match(treasury, /details\.append\(warning\)/);
  assert.match(treasury, /details\.append\(policy\)/);
});

test("treasury history uses daily snapshots and keeps attribution inputs", () => {
  const collector = readFileSync("scripts/update_treasury.py", "utf8");
  for (const field of ["symbol", "source_chain", "amount", "usd_price", "usd_value"]) {
    assert.match(collector, new RegExp(`item\\.get\\(\\"${field}\\"|item\\[\\"${field}\\"\\]`));
  }
  assert.match(treasury, /historyFile/);
  assert.match(treasury, /priceEffect/);
  assert.match(treasury, /netFlow/);
  assert.match(treasury, /treasury-history-chart/);
  for (const id of ["treasury-period-change", "treasury-net-flow", "treasury-market-effect"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.doesNotMatch(html, /CUSTODY BY CHAIN|LARGEST ASSETS/);
  assert.match(treasury, /asset-custody/);
  assert.match(treasury, /custody_address/);
});

test("user content is not rendered through HTML injection sinks", () => {
  assert.doesNotMatch(governance, /\.innerHTML\s*=|insertAdjacentHTML|\.outerHTML\s*=/);
});

test("governance controls referenced by JavaScript exist", () => {
  for (const id of [
    "gov-status",
    "gov-connect",
    "dao-search",
    "dao-options",
    "proposal-list",
    "primary-action",
    "eligibility-action",
    "add-deliverable",
    "deliverable-list",
    "revision-dialog",
    "comment-form",
  ]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
});

test("shipped workshop WASM matches its reviewed checksum", () => {
  const wasm = readFileSync("assets/neta_proposal_workshop.wasm");
  const expected = readFileSync("assets/neta_proposal_workshop.sha256", "utf8")
    .trim()
    .split(/\s+/)[0];
  assert.equal(createHash("sha256").update(wasm).digest("hex"), expected);
});

test("mainnet Juno submission remains explicitly locked", () => {
  assert.match(governance, /Mainnet deposit and submission remain locked/);
  assert.match(governance, /Native Juno voting is shown read-only/);
});

test("UNI-7 indexing errors are detected in RPC data payloads", () => {
  assert.match(governance, /e\?\.data/);
  assert.match(governance, /transaction indexing is disabled/i);
});

test("UNI-7 code discovery uses legacy-compatible pagination", () => {
  assert.doesNotMatch(governance, /cosmwasm\/wasm\/v1\/code\?pagination\.reverse/);
  assert.match(governance, /pagination\?\.next_key/);
});

test("UNI-7 code discovery accepts hexadecimal data hashes", () => {
  assert.match(governance, /\^\[0-9a-f\]\{64\}\$/i);
  assert.match(governance, /hashHex\(info\.data_hash\)/);
});

test("Juno review uses the canonical UNI-7 contract", () => {
  assert.match(governance, /id:"juno"[^}]+mode:"native-gov"[^}]+workshopContract:"juno18d3mzk3ver06zfr5nf752aycss75vtcqd8fsdcuuzmh5mzj4cm6qrgx3fw"/);
});

test("Juno review explains each missing stake requirement", () => {
  assert.match(governance, /MORE JUNOX DELEGATED/);
  assert.match(governance, /MORE TEST NETA STAKED/);
  assert.match(governance, /CURRENT:/);
});

test("comment staking actions are configured per DAO and contextual", () => {
  assert.match(governance, /commentStakeUrl/);
  assert.match(governance, /commentBlocked=discussion/);
  assert.match(governance, /!state\.access\?\.can_comment/);
  assert.doesNotMatch(governance, /delegateTestJunox|TEST_DELEGATION_AMOUNT/);
});

test("deliverables are embedded in the revision payload", () => {
  assert.match(governance, /DELIVERABLE_TYPE="dao_deliverable_v1"/);
  assert.match(governance, /MILESTONE \/ DELIVERABLE/);
  assert.match(governance, /DEADLINE/);
  assert.match(governance, /CONFIRMED BY/);
  assert.match(governance, /EXPECTED RESULT \/ EVIDENCE/);
});
