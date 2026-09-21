#!/usr/bin/env python3
"""Build fail-visible, read-only snapshots of Operations and Juno treasuries."""
from __future__ import annotations

import base64
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "treasury"
TOKEN_REGISTRY_PATH = OUT / "token-registry.json"
TREASURY = "juno1excmamnysxujtd2hzm343nzdwch79y5cvk5h7w6uxlrt230xqwtqkmancl"
OSMOSIS_TREASURY = "osmo1xjfyz4f7da2yu43c0ptlswyln50wqyj53495sesaq40ja5megq4qms9f80"
RESTS = (
    "https://juno-api.polkachu.com",
    "https://juno.api.m.stavr.tech",
    "https://juno-rest.publicnode.com",
)
OSMOSIS_RESTS = ("https://osmosis-api.polkachu.com", "https://lcd.osmosis.zone")
NETA = "juno168ctmpyppk90d34p3jjy658zf5a5l3w8wk35wht6ccqj4mr0yv8s4j5awr"
WYND = "juno1mkw83sv6c7sjdvsaplrzc8yaes9l42p4mhy0ssuxjnyzl87c9eps7ce3m9"

BUILTIN_ASSETS = {
    "ujuno": {"symbol": "JUNO", "decimals": 6, "coingecko": "juno-network", "origin": "Juno"},
    "ibc/C4CFF46FD6DE35CA4CF4CE031E643C8FDC9BA4B99AE598E9B0ED98FE3A2319F9": {"symbol": "ATOM", "decimals": 6, "coingecko": "cosmos"},
    "ibc/EAC38D55372F38F1AFD68DF7FE9EF762DCF69F26520643CF3F9D292A738D8034": {"symbol": "USDC", "decimals": 6, "coingecko": "usd-coin"},
    "ibc/ED07A3391A112B175915CD8FAF43A2DA8E4790EDE12566649D0C2F97716B8518": {"symbol": "OSMO", "decimals": 6, "coingecko": "osmosis"},
}


def token_registry():
    try:
        persisted = json.loads(TOKEN_REGISTRY_PATH.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError) as error:
        raise RuntimeError(f"invalid treasury token registry: {error}") from error
    return {**BUILTIN_ASSETS, **persisted}


ASSETS = token_registry()

BASE_ASSETS = {
    "ujuno": {"symbol": "JUNO", "decimals": 6, "coingecko": "juno-network"},
    "uatom": {"symbol": "ATOM", "decimals": 6, "coingecko": "cosmos"},
    "uosmo": {"symbol": "OSMO", "decimals": 6, "coingecko": "osmosis"},
    "uakt": {"symbol": "AKT", "decimals": 6, "coingecko": "akash-network"},
    "uatone": {"symbol": "ATONE", "decimals": 6, "coingecko": "atomone"},
    "ujkl": {"symbol": "JKL", "decimals": 6, "coingecko": "jackal-protocol"},
    "uusdc": {"symbol": "USDC.n", "decimals": 6, "coingecko": "usd-coin"},
    "uaxlusdc": {"symbol": "USDC", "decimals": 6, "coingecko": "usd-coin"},
    "uaxldai": {"symbol": "DAI.axl", "decimals": 6, "coingecko": "dai"},
}

CW20 = {
    NETA: {"symbol": "NETA", "decimals": 6},
    WYND: {"symbol": "WYND", "decimals": 6},
}

POOLS = (
    ("JUNO / ATOM", "juno1an2xhen0fzme85dpy7vx60f6ecrufqj6vqkh8gdvlyhfhjmp24qqqleeav", "juno17uv02azt545ag23xq7whw6z3r3chw7jwztnr9lypugy62drq3caqeyd2r3", "juno1nfs4xjxum3fqd564yxj44ragxmh8ey7ugl50avquyt7zrvcwlf8q3juqqg"),
    ("JUNO / USDC", "juno1jn6t0dsxryht8ljxulavxrfd22l87dvac8e9a99a7tuj29ysxksqffhf5k", "juno1gqy6rzary8vwnslmdavqre6jdhakcd4n2z4r803ajjmdq08r66hq7zcwrj", "juno1pawjm34dunptcs8wt2m5tgcyexyzc02pdl9xl52jvcqlpwcgus5sen5yrk"),
    ("JUNO / OSMO", "juno1yhtyn2dv5k7ladzrznxlep2xm6q7dsd332wak3hhdrw0staer0ps83q8jw", "juno1u2pl8ql778655wakqmnhpln65q9pughd6jnrp93xwf4zakqjdh6qx3y9yt", "juno1u4h488kf6xhmelsuwm0gj7dhh8mfjm7n5pyu8c0l0xwy3pvrpc3ql2p6q2"),
    ("WYND / USDC", "juno13ld2eq3w8k6rap5n5vsmwr8c4zhqhtfu9vjx0gqmhpefefl97nxq4u4pap", "juno18zk9xqj9xjm0ry39jjam8qsysj7qh49xwt4qdfp9lgtrk08sd58s2n54ve", "juno1vntf38qmdx9aqskjnxdpcmtap0gymtcxnyf3pjcvn8a63j8q53tssrgzz8"),
    ("JUNO / NETA", "juno1uu3cewmpynvgsdu3lfqv2rh2n5nwtrguahkw64wjk99eg8r6fsss0e757x", "juno1h6x5jlvn6jhpnu63ufe4sgv4utyk8hsfl5rqnrpg2cvp6ccuq4lqwqnzra", "juno1tlhf68k8aksl30mdf5yngudk6z8w4qqzvvauzr92w3gwm7er9p9qxvudu7"),
    ("WYND / JUNO", "juno1stg339rrg9guqsuv205yayq2ttzwz4583luc9pznvexe7rtrtrksdxstg3", "juno1a7lmc8e04hcs4y2275cultvg83u636ult4pmnwktr6l9nhrh2e8qzxfdwf", "juno1zvxvs3tzfqd4eqt6g5dq9wsusy0ap5vk34nklqfl0u938sf3y7hql08umf"),
    ("WYND / ATOM", "juno1k5vhzkssgh35zlv9hqaasetslgqyal6jane86umrqvrjav9eg3hq3pxa0l", "juno16r20f55kp59l0v5ne6hzell3qu27jhuzrqmu59w2nxzcsnj90y0sh2m6p5", "juno1dhl0fxmkwp9m8m0c2mhqhs8utcpswp8ud9eh448ex9cjmqkm96zqa52m7p"),
    ("WYND / OSMO", "juno1dx6djxrsr4f4mqjn3vsp6v0yrg78stv3d8qyp66k209qmzn7r3eqne7mwf", "juno1s00g9axpxgmwcrlc6xqcxzcjmaqpxhftkx62xfh64xends8ls5dqyyjnnl", "juno1d0mqxg0glg2u47q0uvcvw33fg8l5yg9vx5ean3qg3n3ng4tenecs4a7guy"),
)


def now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def request_json(url, timeout=25):
    request = urllib.request.Request(url, headers={"User-Agent": "NETA-DAO-Treasury/1.0", "Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.load(response)


def rest(path, providers=RESTS):
    errors = []
    for base in providers:
        try:
            return request_json(base + path), base
        except Exception as error:  # provider failover is reported in the snapshot
            errors.append(f"{base}: {error}")
    raise RuntimeError("all Juno REST providers failed: " + " | ".join(errors))


def smart(contract, message):
    encoded = base64.b64encode(json.dumps(message, separators=(",", ":")).encode()).decode()
    encoded = urllib.parse.quote(encoded, safe="")
    data, endpoint = rest(f"/cosmwasm/wasm/v1/contract/{contract}/smart/{encoded}")
    return data.get("data", data), endpoint


def decimal(raw, places):
    return Decimal(str(raw)) / (Decimal(10) ** places)


def prices(ids):
    ids = sorted(set(ids))
    query = urllib.parse.urlencode({"ids": ",".join(ids), "vs_currencies": "usd", "include_24hr_change": "true"})
    errors = []
    try:
        data = request_json("https://api.coingecko.com/api/v3/simple/price?" + query)
        found = {key: {"usd": Decimal(str(value["usd"])), "change_24h": value.get("usd_24h_change")} for key, value in data.items() if "usd" in value}
        if found:
            return found, "CoinGecko"
    except Exception as error:
        errors.append(f"CoinGecko: {error}")
    try:
        keys = ",".join("coingecko:" + item for item in ids)
        data = request_json("https://coins.llama.fi/prices/current/" + keys).get("coins", {})
        found = {item: {"usd": Decimal(str(data["coingecko:" + item]["price"])), "change_24h": None} for item in ids if "coingecko:" + item in data}
        if found:
            return found, "DefiLlama"
    except Exception as error:
        errors.append(f"DefiLlama: {error}")
    raise RuntimeError("price lookup failed: " + " | ".join(errors))


def info_key(info):
    if "native" in info:
        return "native:" + info["native"]
    return "cw20:" + info["token"]


def metadata(key):
    kind, address = key.split(":", 1)
    if kind == "native":
        return ASSETS.get(address, {"symbol": address[:18] + "…", "decimals": 6})
    return CW20.get(address, {"symbol": address[:12] + "…", "decimals": 6})


def native_metadata(denom, providers=RESTS):
    if denom in ASSETS:
        return dict(ASSETS[denom])
    if not denom.startswith("ibc/"):
        return dict(BASE_ASSETS.get(denom, {"symbol": denom, "decimals": 6}))
    trace, _ = rest(f"/ibc/apps/transfer/v1/denom_traces/{denom[4:]}", providers)
    trace = trace.get("denom_trace", trace)
    base = trace.get("base_denom", "")
    fallback = {"symbol": base or denom[:18] + "…", "decimals": 6}
    normalized = base.lower()
    if "usdc" in normalized:
        fallback = {"symbol": "USDC", "decimals": 6, "coingecko": "usd-coin"}
    elif "dai" in normalized:
        fallback = {"symbol": "DAI.axl", "decimals": 6, "coingecko": "dai"}
    result = dict(BASE_ASSETS.get(base, fallback))
    result.update({"origin": "IBC", "ibc_path": trace.get("path"), "base_denom": base})
    return result


def native_assets(coins, market, warnings, source_chain="juno", custody_address=TREASURY, providers=RESTS):
    result = []
    for coin in coins:
        try:
            meta = native_metadata(coin["denom"], providers)
        except Exception as error:
            meta = {"symbol": coin["denom"][:18] + "…", "decimals": 6}
            warnings.append(f"Denom trace unavailable for {coin['denom']}: {error}")
        amount = decimal(coin["amount"], meta["decimals"])
        price = market.get(meta.get("coingecko"), {}).get("usd")
        result.append({"type": "token", "key": f"{source_chain}:native:" + coin["denom"], "symbol": meta["symbol"], "amount": str(amount), "origin": meta.get("origin", source_chain.title()), "source_chain": source_chain, "custody_address": custody_address, "ibc_path": meta.get("ibc_path"), "base_denom": meta.get("base_denom", coin["denom"]), "usd_price": str(price) if price is not None else None, "usd_value": str(amount * price) if price is not None else None, "change_24h": market.get(meta.get("coingecko"), {}).get("change_24h")})
    return result


def snapshot_result(stamp, height, endpoint, price_source, assets, warnings, treasury_type, treasury_address=None):
    unresolved = [item["symbol"] for item in assets if item.get("usd_value") is None]
    if unresolved:
        warnings.append("Unpriced assets excluded from USD total: " + ", ".join(unresolved))
    total = sum((Decimal(item["usd_value"]) for item in assets if item.get("usd_value") is not None), Decimal(0))
    return {"schema_version": 1, "status": "LIVE" if not unresolved else "PARTIAL", "generated_at": stamp, "chain_id": "juno-1", "height": height, "treasury_type": treasury_type, "treasury_address": treasury_address, "balance_source": endpoint, "price_source": price_source, "valuation_policy": "LP positions remain visible and are valued exactly once from their proportional underlying reserves.", "total_usd": str(total), "assets": assets, "warnings": warnings}


def build_operations(market, price_source, stamp, height):
    bank, endpoint = rest(f"/cosmos/bank/v1beta1/balances/{TREASURY}?pagination.limit=1000")
    osmosis_bank, osmosis_endpoint = rest(f"/cosmos/bank/v1beta1/balances/{OSMOSIS_TREASURY}?pagination.limit=1000", OSMOSIS_RESTS)
    warnings = []
    free = native_assets(bank.get("balances", []), market, warnings)
    free.extend(native_assets(osmosis_bank.get("balances", []), market, warnings, "osmosis", OSMOSIS_TREASURY, OSMOSIS_RESTS))
    for contract, meta in CW20.items():
        response, _ = smart(contract, {"balance": {"address": TREASURY}})
        amount = decimal(response.get("balance", "0"), meta["decimals"])
        if amount:
            free.append({"type": "token", "key": "cw20:" + contract, "symbol": meta["symbol"], "amount": str(amount), "source_chain": "juno", "custody_address": TREASURY, "usd_price": None, "usd_value": None, "change_24h": None})

    pool_states = {}
    for name, lp, pair, stake in POOLS:
        balance, _ = smart(lp, {"balance": {"address": TREASURY}})
        staked, _ = smart(stake, {"all_staked": {"address": TREASURY}})
        claims, _ = smart(stake, {"claims": {"address": TREASURY}})
        active_raw = sum(int(row.get("stake", "0")) for row in staked.get("stakes", []))
        claims_raw = sum(int(row.get("amount", "0")) for row in claims.get("claims", []))
        direct_raw = int(balance.get("balance", "0"))
        lp_raw = direct_raw + active_raw + claims_raw
        if not lp_raw:
            continue
        token_info, _ = smart(lp, {"token_info": {}})
        pool, _ = smart(pair, {"pool": {}})
        supply = int(token_info["total_supply"])
        underlyings = []
        for asset in pool.get("assets", []):
            key = info_key(asset["info"])
            meta = metadata(key)
            raw = int(asset["amount"]) * lp_raw // supply
            amount = decimal(raw, meta["decimals"])
            price = market.get(meta.get("coingecko"), {}).get("usd")
            underlyings.append({"key": key, "symbol": meta["symbol"], "amount": str(amount), "usd_price": str(price) if price is not None else None, "usd_value": str(amount * price) if price is not None else None})
        pool_states[pair] = (pool, underlyings)
        value = sum((Decimal(item["usd_value"]) for item in underlyings if item["usd_value"] is not None), Decimal(0))
        free.append({"type": "lp", "key": "cw20:" + lp, "symbol": name + " LP", "amount": str(decimal(lp_raw, int(token_info.get("decimals", 6)))), "source_chain": "juno", "custody_address": TREASURY, "usd_price": None, "usd_value": str(value), "change_24h": None, "pair": pair, "custody": {"direct_raw": str(direct_raw), "staked_raw": str(active_raw), "claims_raw": str(claims_raw)}, "underlyings": underlyings})

    derived_pairs = ((NETA, "JUNO / NETA", "native:ujuno"), (WYND, "WYND / USDC", "native:ibc/EAC38D55372F38F1AFD68DF7FE9EF762DCF69F26520643CF3F9D292A738D8034"))
    for contract, pool_name, anchor_key in derived_pairs:
        configured_pool = next((item for item in POOLS if item[0] == pool_name), None)
        if not configured_pool:
            continue
        pair = configured_pool[2]
        pool, _ = smart(pair, {"pool": {}})
        amounts = {info_key(asset["info"]): Decimal(asset["amount"]) for asset in pool.get("assets", [])}
        anchor_meta = metadata(anchor_key)
        anchor_raw, token_raw = amounts.get(anchor_key), amounts.get("cw20:" + contract)
        anchor_price = market.get(anchor_meta.get("coingecko"), {}).get("usd")
        if anchor_raw and token_raw and anchor_price:
            token_price = (anchor_raw / token_raw) * anchor_price
            for item in free:
                if item["key"] == "cw20:" + contract:
                    item["usd_price"] = str(token_price)
                    item["usd_value"] = str(Decimal(item["amount"]) * token_price)
            for item in free:
                if item["type"] == "lp":
                    for underlying in item["underlyings"]:
                        if underlying["key"] == "cw20:" + contract:
                            underlying["usd_price"] = str(token_price)
                            underlying["usd_value"] = str(Decimal(underlying["amount"]) * token_price)
                    item["usd_value"] = str(sum((Decimal(x["usd_value"]) for x in item["underlyings"] if x["usd_value"] is not None), Decimal(0)))
        else:
            warnings.append(f"{CW20[contract]['symbol']} price unavailable: {pool_name} pool or USD anchor missing")

    result = snapshot_result(stamp, height, endpoint, price_source, free, warnings, "dao-and-cross-chain", TREASURY)
    result["treasury_accounts"] = [{"chain_id": "juno-1", "address": TREASURY, "control": "dao-core", "balance_source": endpoint}, {"chain_id": "osmosis-1", "address": OSMOSIS_TREASURY, "control": "polytone-proxy", "balance_source": osmosis_endpoint}]
    return result


def build_community_pool(market, price_source, stamp, height):
    response, endpoint = rest("/cosmos/distribution/v1beta1/community_pool")
    warnings = []
    assets = native_assets(response.get("pool", []), market, warnings, "juno", None)
    return snapshot_result(stamp, height, endpoint, price_source, assets, warnings, "community-pool")


def build():
    stamp = now()
    height_data, _ = rest("/cosmos/base/tendermint/v1beta1/blocks/latest")
    height = int(height_data["block"]["header"]["height"])
    price_ids = [item["coingecko"] for item in BASE_ASSETS.values() if item.get("coingecko")]
    market, price_source = prices(price_ids)
    return build_operations(market, price_source, stamp, height), build_community_pool(market, price_source, stamp, height)


def write_snapshot(snapshot, name="current", history_name="history"):
    OUT.mkdir(parents=True, exist_ok=True)
    current = OUT / f"{name}.json"
    current.write_text(json.dumps(snapshot, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    history_path = OUT / f"{history_name}.json"
    try:
        history = json.loads(history_path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        history = {"schema_version": 1, "snapshots": []}
    day = snapshot["generated_at"][:10]
    compact = {key: snapshot[key] for key in ("generated_at", "height", "status", "total_usd")}
    compact["assets"] = [
        {
            "key": item["key"],
            "symbol": item.get("symbol"),
            "source_chain": item.get("source_chain", "juno"),
            "amount": item["amount"],
            "usd_price": item.get("usd_price"),
            "usd_value": item.get("usd_value"),
        }
        for item in snapshot["assets"]
    ]
    rows = [row for row in history.get("snapshots", []) if row.get("generated_at", "")[:10] != day]
    daily_mode = os.environ.get("TREASURY_DAILY_SNAPSHOT")
    berlin = datetime.now(ZoneInfo("Europe/Berlin"))
    if daily_mode == "1" or daily_mode == "auto" and berlin.hour == 21:
        rows.append(compact)
    history["snapshots"] = rows[-730:]
    history_path.write_text(json.dumps(history, indent=2, sort_keys=True) + "\n", encoding="utf-8")


if __name__ == "__main__":
    try:
        operations, community = build()
        write_snapshot(operations)
        write_snapshot(community, "juno-community-pool", "juno-community-history")
        print(json.dumps({"operations": {"status": operations["status"], "assets": len(operations["assets"]), "total_usd": operations["total_usd"]}, "juno_community_pool": {"status": community["status"], "assets": len(community["assets"]), "total_usd": community["total_usd"]}, "height": operations["height"]}))
    except Exception as error:
        print(f"treasury snapshot failed: {error}", file=sys.stderr)
        raise
