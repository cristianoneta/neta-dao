import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const governance = readFileSync("neta-governance.js", "utf8");
const html = readFileSync("index.html", "utf8");

test("browser scripts parse", () => {
  execFileSync(process.execPath, ["--check", "neta-governance.js"]);
  execFileSync(process.execPath, ["--check", "ux-draft.js"]);
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
