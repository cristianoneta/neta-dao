#!/usr/bin/env python3
"""Collect immutable, transaction-backed NETA Operations treasury events."""
from __future__ import annotations

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
TREASURY = "juno1excmamnysxujtd2hzm343nzdwch79y5cvk5h7w6uxlrt230xqwtqkmancl"
CHAIN_ID = "juno-1"
CREATION_HEIGHT = 4_322_988
PER_PAGE = 100
RPCS = (
    "https://juno-rpc.publicnode.com",
    "https://juno.api.pocket.network",
    "https://juno-rpc.polkachu.com",
)
QUERIES = (
    "wasm._contract_address",
    "transfer.sender",
    "transfer.recipient",
    "wasm.sender",
    "wasm.to",
)
COIN = re.compile(r"^(\d+)(.+)$")


def now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def request_json(url, timeout=30):
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "NETA-DAO-Treasury-Events/1.0", "Accept": "application/json"},
    )
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


def select_rpc():
    errors = []
    probe = f"wasm._contract_address='{TREASURY}'"
    for base in RPCS:
        try:
            status = rpc(base, "status")
            indexed = rpc(base, "tx_search", query=probe, page=1, per_page=1, order_by="desc")
            total = int(indexed.get("total_count", 0))
            if total == 0:
                raise RuntimeError("historical address index is empty")
            return base, int(status["sync_info"]["latest_block_height"]), total
        except Exception as error:
            errors.append(f"{base}: {error}")
    raise RuntimeError("no Juno RPC with a usable historical transaction index: " + " | ".join(errors))


def load_existing():
    try:
        data = json.loads(OUT.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        data = {"schema_version": 1, "events": []}
    return data


def search(base, key):
    address_query = f"{key}='{TREASURY}'"
    rows = []
    page = 1
    while True:
        result = rpc(base, "tx_search", query=address_query, page=page, per_page=PER_PAGE, order_by="asc")
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
        grouped = {
            key: [value for name, value in attributes(event) if name == key]
            for key in ("sender", "recipient", "amount")
        }
        width = max((len(value) for value in grouped.values()), default=0)
        for index in range(width):
            row = {
                key: value[index] if index < len(value) else value[-1] if len(value) == 1 else None
                for key, value in grouped.items()
            }
            if all(row.values()):
                rows.append(row)
    return rows


def denom_registry():
    persisted = json.loads(REGISTRY.read_text(encoding="utf-8"))
    return {
        "ujuno": {"symbol": "JUNO", "decimals": 6},
        "uatom": {"symbol": "ATOM", "decimals": 6},
        **persisted,
    }


def movements(events, registry):
    result = []
    for row in transfer_rows(events):
        if TREASURY not in {row["sender"], row["recipient"]}:
            continue
        direction = "out" if row["sender"] == TREASURY else "in"
        counterparty = row["recipient"] if direction == "out" else row["sender"]
        for coin in row["amount"].split(","):
            match = COIN.match(coin)
            if not match:
                continue
            raw, denom = match.groups()
            meta = registry.get(denom, {"symbol": denom, "decimals": 6})
            amount = Decimal(raw) / (Decimal(10) ** int(meta.get("decimals", 6)))
            result.append(
                {
                    "direction": direction,
                    "asset": meta.get("symbol", denom),
                    "amount": str(amount),
                    "raw_amount": raw,
                    "denom": denom,
                    "counterparty": counterparty,
                }
            )
    return result


def classify(events, movement_rows):
    wasm_actions = values(events, "wasm", "action") + values(events, "wasm", "method")
    packets = [value for value in values(events, "send_packet", "packet_data") if TREASURY in value]
    proposals = values(events, "wasm", "proposal_id") + values(events, "wasm", "proposal")
    directions = {row["direction"] for row in movement_rows}
    if directions == {"in"}:
        kind = "inflow"
    elif directions == {"out"}:
        kind = "payment"
    elif movement_rows:
        kind = "transfer"
    elif packets:
        kind = "cross_chain_command"
    elif "execute_proposal_hook" in wasm_actions:
        kind = "proposal_execution"
    else:
        kind = "contract_activity"
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


def block_time(base, height):
    try:
        result = rpc(base, "block", timeout=6, height=height)
        return result["block"]["header"]["time"]
    except Exception:
        return None


def normalize(tx, timestamp, registry):
    raw_events = tx.get("tx_result", {}).get("events", [])
    movement_rows = movements(raw_events, registry)
    kind, actions, proposal_id, packets = classify(raw_events, movement_rows)
    return {
        "id": f"{CHAIN_ID}:{tx['hash']}",
        "chain_id": CHAIN_ID,
        "height": int(tx["height"]),
        "timestamp": timestamp,
        "timestamp_status": "confirmed" if timestamp else "archive_unavailable",
        "tx_hash": tx["hash"],
        "status": "confirmed",
        "type": kind,
        "title": event_title(kind, movement_rows, proposal_id),
        "movements": movement_rows,
        "proposal_id": proposal_id,
        "actions": actions,
        "ibc_packets": len(packets),
        "classification_confidence": "confirmed" if movement_rows else "derived",
        "explorer_url": f"https://atomscan.com/juno/transactions/{tx['hash']}",
    }


def collect():
    existing = load_existing()
    base, latest_height, indexed_total = select_rpc()
    found = {}
    for key in QUERIES:
        for tx in search(base, key):
            if int(tx.get("tx_result", {}).get("code", 0)) == 0:
                found[tx["hash"]] = tx
    prior = {row["tx_hash"]: row for row in existing.get("events", [])}
    timestamp_by_height = {int(row["height"]): row.get("timestamp") for row in prior.values()}
    missing_heights = sorted({int(tx["height"]) for tx in found.values()} - set(timestamp_by_height))
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(block_time, base, height): height for height in missing_heights}
        for future in as_completed(futures):
            timestamp_by_height[futures[future]] = future.result()
    registry = denom_registry()
    for tx in found.values():
        prior[tx["hash"]] = normalize(tx, timestamp_by_height[int(tx["height"])], registry)
    rows = sorted(prior.values(), key=lambda row: (row["height"], row["tx_hash"]), reverse=True)
    return {
        "schema_version": 1,
        "generated_at": now(),
        "treasury": TREASURY,
        "scope": "neta-operations-juno-core",
        "source": base,
        "source_indexed_contract_transactions": indexed_total,
        "cursor": {
            "last_scanned_height": latest_height,
            "contract_creation_height": CREATION_HEIGHT,
            "strategy": "full-address-index-replay",
        },
        "warnings": [
            f"Exact block timestamp unavailable from public RPC archives for {sum(not row.get('timestamp') for row in rows)} historical events."
        ] if any(not row.get("timestamp") for row in rows) else [],
        "events": rows,
    }


def main():
    data = collect()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    counts = {}
    for event in data["events"]:
        counts[event["type"]] = counts.get(event["type"], 0) + 1
    print(json.dumps({"events": len(data["events"]), "types": counts, "cursor": data["cursor"]["last_scanned_height"]}))


if __name__ == "__main__":
    main()
