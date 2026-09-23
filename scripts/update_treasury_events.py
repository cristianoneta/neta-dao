#!/usr/bin/env python3
"""Collect immutable, transaction-backed NETA Operations treasury events."""
from __future__ import annotations

import base64
import json
import re
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "treasury" / "events.json"
REGISTRY = ROOT / "data" / "treasury" / "token-registry.json"
PROPOSAL_MODULE = "juno1m9skms04ymmhsyc2q9cguja47d07mljsfnvm8f584dc645urxvjsjc9ep0"
PROPOSAL_RESTS = ("https://juno-api.polkachu.com", "https://juno.api.m.stavr.tech", "https://juno-rest.publicnode.com")
TREASURY = "juno1excmamnysxujtd2hzm343nzdwch79y5cvk5h7w6uxlrt230xqwtqkmancl"
OSMOSIS_TREASURY = "osmo1xjfyz4f7da2yu43c0ptlswyln50wqyj53495sesaq40ja5megq4qms9f80"
CHAINS = (
    {
        "id": "juno-1", "name": "Juno", "address": TREASURY, "creation_height": 4_322_988,
        "rpcs": ("https://juno-rpc.publicnode.com", "https://juno.api.pocket.network", "https://juno-rpc.polkachu.com"),
        "explorer_tx": "https://atomscan.com/juno/transactions/{hash}",
        "explorer_account": "https://atomscan.com/juno/accounts/{address}", "require_history": True,
    },
    {
        "id": "osmosis-1", "name": "Osmosis", "address": OSMOSIS_TREASURY, "creation_height": 15_838_602,
        "rpcs": ("https://osmosis-rpc.publicnode.com", "https://osmosis-rpc.polkachu.com"),
        "explorer_tx": "https://www.mintscan.io/osmosis/tx/{hash}",
        "explorer_account": "https://www.mintscan.io/osmosis/address/{address}", "require_history": False,
    },
)
PER_PAGE = 100
QUERIES = ("wasm._contract_address", "transfer.sender", "transfer.recipient", "coin_spent.spender", "coin_received.receiver", "wasm.sender", "wasm.to")
COIN = re.compile(r"^(\d+)(.+)$")


def now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def request_json(url, timeout=30):
    request = urllib.request.Request(url, headers={"User-Agent": "NETA-DAO-Treasury-Events/2.0", "Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.load(response)


def rpc_url(base, method, **params):
    encoded = {key: json.dumps(str(value)) for key, value in params.items()}
    return f"{base}/{method}?{urllib.parse.urlencode(encoded)}"


def rpc(base, method, timeout=30, **params):
    payload = request_json(rpc_url(base, method, **params), timeout=timeout)
    if payload.get("error"):
        raise RuntimeError(f"{base} {method}: {payload['error']}")
    return payload["result"]


def select_rpc(chain):
    errors = []
    probe = f"wasm._contract_address='{chain['address']}'"
    for base in chain["rpcs"]:
        try:
            status = rpc(base, "status")
            indexed = rpc(base, "tx_search", query=probe, page=1, per_page=1, order_by="desc")
            total = int(indexed.get("total_count", 0))
            if chain["require_history"] and total == 0:
                raise RuntimeError("historical address index is empty")
            return base, int(status["sync_info"]["latest_block_height"]), total
        except Exception as error:
            errors.append(f"{base}: {error}")
    raise RuntimeError(f"no {chain['name']} RPC with a usable transaction index: " + " | ".join(errors))


def load_existing():
    try:
        return json.loads(OUT.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return {"schema_version": 2, "events": []}


def search(base, key, address):
    rows, page = [], 1
    while True:
        result = rpc(base, "tx_search", query=f"{key}='{address}'", page=page, per_page=PER_PAGE, order_by="asc")
        batch = result.get("txs", [])
        rows.extend(batch)
        if len(rows) >= int(result.get("total_count", 0)) or not batch:
            return rows
        page += 1


def attributes(event):
    return [(item.get("key", ""), item.get("value", "")) for item in event.get("attributes", [])]


def values(events, event_type, key):
    return [value for event in events if event.get("type") == event_type for name, value in attributes(event) if name == key]


def transfer_rows(events):
    rows = []
    for event in events:
        if event.get("type") != "transfer":
            continue
        grouped = {key: [value for name, value in attributes(event) if name == key] for key in ("sender", "recipient", "amount")}
        width = max((len(value) for value in grouped.values()), default=0)
        for index in range(width):
            row = {key: value[index] if index < len(value) else value[-1] if len(value) == 1 else None for key, value in grouped.items()}
            if all(row.values()):
                rows.append(row)
    return rows


def denom_registry():
    persisted = json.loads(REGISTRY.read_text(encoding="utf-8"))
    return {"ujuno": {"symbol": "JUNO", "decimals": 6}, "uosmo": {"symbol": "OSMO", "decimals": 6}, "uatom": {"symbol": "ATOM", "decimals": 6}, **persisted}


def movements(events, registry, address=TREASURY):
    result = []
    for row in transfer_rows(events):
        if address not in {row["sender"], row["recipient"]}:
            continue
        direction = "out" if row["sender"] == address else "in"
        counterparty = row["recipient"] if direction == "out" else row["sender"]
        for coin in row["amount"].split(","):
            match = COIN.match(coin)
            if not match:
                continue
            raw, denom = match.groups()
            meta = registry.get(denom, {"symbol": denom, "decimals": 6})
            amount = Decimal(raw) / (Decimal(10) ** int(meta.get("decimals", 6)))
            result.append({"direction": direction, "asset": meta.get("symbol", denom), "amount": str(amount), "raw_amount": raw, "denom": denom, "counterparty": counterparty})
    return result


def classify(events, movement_rows, address=TREASURY):
    wasm_actions = values(events, "wasm", "action") + values(events, "wasm", "method")
    packets = [value for value in values(events, "send_packet", "packet_data") if address in value]
    proposals = values(events, "wasm", "proposal_id") + values(events, "wasm", "proposal")
    directions = {row["direction"] for row in movement_rows}
    kind = "inflow" if directions == {"in"} else "payment" if directions == {"out"} else "transfer" if movement_rows else "cross_chain_command" if packets else "proposal_execution" if "execute_proposal_hook" in wasm_actions else "contract_activity"
    return kind, sorted(set(wasm_actions)), proposals[0] if proposals else None, packets


def event_title(kind, movement_rows, proposal_id):
    if movement_rows:
        verb = "received" if kind == "inflow" else "sent" if kind == "payment" else "moved"
        summary = ", ".join(f"{row['amount']} {row['asset']}" for row in movement_rows[:3])
        return f"{summary} {verb}"
    if kind == "cross_chain_command":
        return "Cross-chain command sent from the DAO"
    if kind == "proposal_execution" and proposal_id:
        return f"DAO proposal {proposal_id} executed"
    return "DAO contract activity"


def proposal_titles():
    query = base64.b64encode(json.dumps({"reverse_proposals": {"limit": 100}}, separators=(",", ":")).encode()).decode()
    errors = []
    for base in PROPOSAL_RESTS:
        try:
            proposals = request_json(f"{base}/cosmwasm/wasm/v1/contract/{PROPOSAL_MODULE}/smart/{query}")["data"]["proposals"]
            return {str(item["id"]): item["proposal"].get("title") for item in proposals}
        except Exception as error:
            errors.append(f"{base}: {error}")
    raise RuntimeError("proposal title query failed: " + " | ".join(errors))


def block_time(base, height):
    try:
        return rpc(base, "block", timeout=6, height=height)["block"]["header"]["time"]
    except Exception:
        return None


def normalize(tx, timestamp, registry, chain=None, titles=None):
    chain = chain or CHAINS[0]
    raw_events = tx.get("tx_result", {}).get("events", [])
    movement_rows = movements(raw_events, registry, chain["address"])
    kind, actions, proposal_id, packets = classify(raw_events, movement_rows, chain["address"])
    return {
        "id": f"{chain['id']}:{tx['hash']}", "chain_id": chain["id"], "chain_name": chain["name"],
        "treasury_address": chain["address"], "height": int(tx["height"]), "timestamp": timestamp,
        "timestamp_status": "confirmed" if timestamp else "archive_unavailable", "tx_hash": tx["hash"], "status": "confirmed",
        "type": kind, "title": event_title(kind, movement_rows, proposal_id), "movements": movement_rows,
        "proposal_id": proposal_id, "proposal_title": (titles or {}).get(str(proposal_id)) if proposal_id else None,
        "actions": actions, "ibc_packets": len(packets), "classification_confidence": "confirmed" if movement_rows else "derived",
        "explorer_url": chain["explorer_tx"].format(hash=tx["hash"]), "account_explorer_url": chain["explorer_account"].format(address=chain["address"]),
    }


def collect_chain(chain, existing, registry, titles):
    base, latest_height, indexed_total = select_rpc(chain)
    found = {}
    for key in QUERIES:
        for tx in search(base, key, chain["address"]):
            if int(tx.get("tx_result", {}).get("code", 0)) == 0:
                found[tx["hash"]] = tx
    prior = {row["tx_hash"]: row for row in existing if row.get("chain_id") == chain["id"]}
    timestamp_by_height = {int(row["height"]): row.get("timestamp") for row in prior.values()}
    missing_heights = sorted({int(tx["height"]) for tx in found.values()} - set(timestamp_by_height))
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(block_time, base, height): height for height in missing_heights}
        for future in as_completed(futures):
            timestamp_by_height[futures[future]] = future.result()
    for tx in found.values():
        prior[tx["hash"]] = normalize(tx, timestamp_by_height[int(tx["height"])], registry, chain, titles)
    for row in prior.values():
        row["chain_name"] = chain["name"]
        row["treasury_address"] = chain["address"]
        row["proposal_title"] = titles.get(str(row.get("proposal_id"))) if row.get("proposal_id") else None
        row["account_explorer_url"] = chain["explorer_account"].format(address=chain["address"])
    return list(prior.values()), {"chain_id": chain["id"], "address": chain["address"], "source": base, "indexed_transactions": indexed_total, "last_scanned_height": latest_height, "contract_creation_height": chain["creation_height"]}


def collect():
    existing = load_existing().get("events", [])
    registry, titles = denom_registry(), proposal_titles()
    rows, sources = [], []
    for chain in CHAINS:
        chain_rows, source = collect_chain(chain, existing, registry, titles)
        rows.extend(chain_rows)
        sources.append(source)
    rows.sort(key=lambda row: (row.get("timestamp") or "", row["chain_id"] == "juno-1", row["height"], row["tx_hash"]), reverse=True)
    missing = sum(not row.get("timestamp") for row in rows)
    return {"schema_version": 2, "generated_at": now(), "treasuries": [{"chain_id": chain["id"], "address": chain["address"]} for chain in CHAINS], "scope": "neta-operations-cross-chain", "sources": sources, "cursor": {"strategy": "full-address-index-replay", "chains": sources}, "warnings": [f"Exact block timestamp unavailable from public RPC archives for {missing} historical events."] if missing else [], "events": rows}


def main():
    data = collect()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    counts = {}
    for event in data["events"]:
        counts[event["type"]] = counts.get(event["type"], 0) + 1
    print(json.dumps({"events": len(data["events"]), "types": counts, "chains": data["sources"]}))


if __name__ == "__main__":
    main()
