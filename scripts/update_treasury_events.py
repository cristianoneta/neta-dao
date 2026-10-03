#!/usr/bin/env python3
"""Collect immutable, transaction-backed NETA Operations treasury events."""
from __future__ import annotations

import base64
import json
import os
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
    errors, fallback = [], None
    probe = f"wasm._contract_address='{chain['address']}'"
    for base in chain["rpcs"]:
        try:
            status = rpc(base, "status", timeout=5)
            indexed = rpc(base, "tx_search", timeout=5, query=probe, page=1, per_page=1, order_by="desc")
            total = int(indexed.get("total_count", 0))
            if chain["require_history"] and total == 0:
                raise RuntimeError("historical address index is empty")
            height = int(status["sync_info"]["latest_block_height"])
            if fallback is None:
                fallback = (base, height, total, False)
            # Some public gateways reject every height range. Probe this before
            # choosing a node; keep a full-replay fallback rather than breaking
            # production when no range-capable archive is reachable.
            rpc(base, "tx_search", timeout=5, query=f"{probe} AND tx.height>={chain['creation_height']} AND tx.height<={height-20}", page=1, per_page=1, order_by="asc")
            return base, height, total, True
        except Exception as error:
            errors.append(f"{base}: {error}")
    if fallback is not None:
        return fallback
    raise RuntimeError(f"no {chain['name']} RPC with a usable transaction index: " + " | ".join(errors))


def load_existing():
    try:
        return json.loads(OUT.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return {"schema_version": 2, "events": []}


def search(base, key, address, start_height=None, end_height=None):
    rows, page, expected = [], 1, None
    expression = f"{key}='{address}'"
    if start_height is not None:
        expression += f" AND tx.height>={int(start_height)}"
    if end_height is not None:
        expression += f" AND tx.height<={int(end_height)}"
    while page <= 1000:
        result = rpc(base, "tx_search", query=expression, page=page, per_page=PER_PAGE, order_by="asc")
        total = int(result.get("total_count", 0))
        if total < 0 or (expected is not None and total != expected):
            raise RuntimeError("transaction index changed during bounded scan")
        expected = total
        batch = result.get("txs", [])
        if not batch and len(rows) < total:
            raise RuntimeError("transaction pagination truncated before total_count")
        rows.extend(batch)
        if len(rows) >= total:
            if len(rows) != total or len({tx["hash"] for tx in rows}) != total:
                raise RuntimeError("duplicate or inconsistent transaction pages")
            return rows
        page += 1
    raise RuntimeError("transaction pagination safety limit reached")


def block_hash(base, height):
    value = rpc(base, "block", timeout=10, height=height).get("block_id", {}).get("hash")
    if not isinstance(value, str) or not re.fullmatch(r"[0-9A-Fa-f]{64}", value):
        raise RuntimeError("missing block identity for scan anchor")
    return value.upper()


def scan_start(chain, base, end_height, source):
    if os.environ.get("TREASURY_EVENTS_FULL_REPLAY") == "1" or not source:
        return chain["creation_height"], False
    anchor = source.get("last_scanned_height")
    if source.get("address") != chain["address"] or not isinstance(anchor, int) or anchor < chain["creation_height"] or anchor > end_height or not source.get("anchor_hash"):
        return chain["creation_height"], False
    try:
        observed = block_hash(base, anchor)
    except Exception:
        return chain["creation_height"], False
    if observed != source["anchor_hash"]:
        raise RuntimeError("stored scan anchor changed; preserve ledger for explicit reconciliation")
    return max(chain["creation_height"], anchor - 100), True


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


def collect_chain(chain, existing, registry, titles, source=None):
    base, latest_height, indexed_total, range_capable = select_rpc(chain)
    # Scan only finalized older blocks and retain an overlap for delayed indexing.
    end_height = max(chain["creation_height"], latest_height - 20)
    anchor_hash = block_hash(base, end_height)
    start_height, incremental = scan_start(chain, base, end_height, source)
    if not range_capable:
        start_height, incremental = chain["creation_height"], False
    found = {}
    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = [pool.submit(search, base, key, chain["address"], start_height if range_capable else None, end_height if range_capable else None) for key in QUERIES]
        for future in futures:
            for tx in future.result():
                if start_height <= int(tx["height"]) <= end_height and int(tx.get("tx_result", {}).get("code", 0)) == 0:
                    found[tx["hash"]] = tx
    prior = {row["tx_hash"]: row for row in existing if row.get("chain_id") == chain["id"]}
    historical_missing = sum(start_height <= int(row["height"]) <= end_height and digest not in found for digest, row in prior.items())
    if historical_missing and chain["require_history"]:
        raise RuntimeError("historical index lost recorded transactions; preserve existing ledger")
    # Optional Osmosis legacy indexing was incomplete before this change. Keep
    # every cached event and report the gap rather than blocking fresh balances.
    timestamp_by_height = {int(row["height"]): row.get("timestamp") for row in prior.values()}
    missing_heights = sorted({int(tx["height"]) for tx in found.values()} - set(timestamp_by_height))
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(block_time, base, height): height for height in missing_heights}
        for future in as_completed(futures):
            timestamp_by_height[futures[future]] = future.result()
    if block_hash(base, end_height) != anchor_hash:
        raise RuntimeError("scan block identity changed during collection")
    for tx in found.values():
        prior[tx["hash"]] = normalize(tx, timestamp_by_height[int(tx["height"])], registry, chain, titles)
    for row in prior.values():
        row["chain_name"] = chain["name"]
        row["treasury_address"] = chain["address"]
        row["proposal_title"] = titles.get(str(row.get("proposal_id")), row.get("proposal_title")) if row.get("proposal_id") else None
        row["account_explorer_url"] = chain["explorer_account"].format(address=chain["address"])
    return list(prior.values()), {"chain_id": chain["id"], "address": chain["address"], "source": base, "indexed_transactions": indexed_total, "last_scanned_height": end_height, "anchor_hash": anchor_hash, "scan_start_height": start_height, "incremental": incremental, "range_capable": range_capable, "historical_missing_transactions": historical_missing, "contract_creation_height": chain["creation_height"]}


def collect():
    previous = load_existing()
    existing = previous.get("events", [])
    source_by_chain = {row["chain_id"]: row for row in previous.get("sources", [])}
    registry, titles = denom_registry(), proposal_titles()
    rows, sources = [], []
    for chain in CHAINS:
        chain_rows, source = collect_chain(chain, existing, registry, titles, source_by_chain.get(chain["id"]))
        rows.extend(chain_rows)
        sources.append(source)
    rows.sort(key=lambda row: (row.get("timestamp") or "", row["chain_id"] == "juno-1", row["height"], row["tx_hash"]), reverse=True)
    missing = sum(not row.get("timestamp") for row in rows)
    warnings = [f"Exact block timestamp unavailable from public RPC archives for {missing} historical events."] if missing else []
    warnings += [f"{source['chain_id']}: {source['historical_missing_transactions']} cached historical transactions are currently absent from the public index; records retained." for source in sources if source["historical_missing_transactions"]]
    return {"schema_version": 2, "generated_at": now(), "treasuries": [{"chain_id": chain["id"], "address": chain["address"]} for chain in CHAINS], "scope": "neta-operations-cross-chain", "sources": sources, "cursor": {"strategy": "anchored-incremental-with-full-replay-fallback", "chains": sources}, "warnings": warnings, "events": rows}


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
