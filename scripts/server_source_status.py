"""Read-only freshness checks for published data; never re-date or sign a snapshot.

These checks do not verify signatures, blockchain truth or accounting completeness.
PARTIAL valuation remains explicit without being confused with an old observation.
"""
import argparse
from datetime import datetime
import json
from pathlib import Path
import stat
import time

MAX_BYTES = 25 * 1024 * 1024
CADENCES = {"treasury": 35 * 60, "main": 65 * 60, "members": 65 * 60}
ACCRUAL_MAX_AGE = 26 * 60 * 60
SOURCES = {
    "data/treasury/current.json": "treasury",
    "data/treasury/juno-community-pool.json": "treasury",
    "data/treasury/juno-delegation.json": "treasury",
    "data/treasury/neta-main.json": "main",
    "data/daos/neta.json": "members",
    "data/daos/neta-operations.json": "members",
    "data/daos/juno.json": "members",
    "data/daos/juno-delegation-planner.json": "main",
}


def read_object(root, name):
    path = root / name
    if any(p.is_symlink() for p in (path, *path.parents) if p != root and root in p.parents):
        raise ValueError("snapshot symlink")
    info = path.stat()
    if not stat.S_ISREG(info.st_mode) or info.st_size > MAX_BYTES:
        raise ValueError("snapshot file")
    with path.open("rb") as file:
        raw = file.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise ValueError("snapshot size")
    value = json.loads(raw)
    if not isinstance(value, dict):
        raise ValueError("snapshot object")
    return value


def timestamp(value):
    if not isinstance(value, str):
        raise ValueError("timestamp missing")
    result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if result.tzinfo is None:
        raise ValueError("timestamp timezone missing")
    return int(result.timestamp())


def age_issues(observed, now, maximum):
    if type(observed) is not int or observed <= 0:
        return ["invalid-observation"]
    if observed > now + 60:
        return ["future-observation"]
    return ["stale-observation"] if now - observed > maximum else []


def check(root, *, now=None):
    now = int(time.time() if now is None else now)
    # Capture one generation once, even if the current symlink changes mid-check.
    root = Path(root).resolve()
    rows = []
    for name, job in SOURCES.items():
        issues, warnings = [], []
        try:
            value = read_object(root, name)
            if name == "data/daos/juno-delegation-planner.json":
                issues += age_issues(timestamp(value.get("blockTime")), now, CADENCES[job])
                issues += ["collection:" + issue for issue in age_issues(timestamp(value.get("collectedAt")), now, CADENCES[job])]
                if value.get("chainId") != "juno-1" or type(value.get("schema")) is not int or value["schema"] != 1 or value.get("programme") != "juno1nmezpepv3lx45mndyctz2lzqxa6d9xzd2xumkxf7a6r4nxt0y95qypm6c0":
                    issues.append("invalid-source-identity")
                rows.append({"path": name, "ok": not issues, "issues": issues, "warnings": []})
                continue
            issues += age_issues(timestamp(value.get("generated_at")), now, CADENCES[job])
            if value.get("chain_id") != "juno-1" or type(value.get("schema_version")) is not int or value["schema_version"] != 1:
                issues.append("invalid-source-identity")
            if job == "members":
                if value.get("members_complete") is not True:
                    issues.append("membership-incomplete")
            elif value.get("status") == "PARTIAL":
                warnings.append("partial-valuation")
            elif value.get("status") != "LIVE":
                issues.append("source-unavailable")
        except (OSError, ValueError, TypeError, OverflowError):
            issues.append("snapshot-unavailable")
        rows.append({"path": name, "ok": not issues, "issues": issues, "warnings": warnings})

    summaries = [
        ("data/daos/neta-status.json", "main", ("balances", "events", "accounting")),
        ("data/daos/membership-status.json", "members", ("neta", "neta-operations", "juno")),
    ]
    for name, job, required in summaries:
        issues = []
        try:
            value = read_object(root, name)
            issues += age_issues(timestamp(value.get("checked_at")), now, CADENCES[job])
            tasks = value.get("daos") if job == "members" else value
            if not isinstance(tasks, dict):
                raise ValueError("task results missing")
            for task in required:
                if not isinstance(tasks.get(task), dict) or tasks[task].get("status") != "completed":
                    issues.append("refresh-unavailable:" + task)
            if "reconciliation" in tasks and (
                not isinstance(tasks["reconciliation"], dict)
                or tasks["reconciliation"].get("status") != "completed"
            ):
                issues.append("refresh-unavailable:reconciliation")
        except (OSError, ValueError, TypeError, OverflowError):
            issues.append("snapshot-unavailable")
        rows.append({"path": name, "ok": not issues, "issues": issues, "warnings": []})

    name, issues = "data/nns/price.json", []
    try:
        value = read_object(root, name)
        snapshot = value.get("snapshot")
        if not isinstance(snapshot, dict):
            raise ValueError("price snapshot missing")
        observed, expires = snapshot.get("observed_at"), snapshot.get("expires_at")
        issues += age_issues(observed, now, CADENCES["main"])
        if value.get("chain_id") != "juno-1" or type(value.get("schema_version")) is not int or value["schema_version"] != 1:
            issues.append("invalid-source-identity")
        if type(observed) is not int or type(expires) is not int or expires - observed != 86400:
            issues.append("invalid-price-validity")
        elif now >= expires:
            issues.append("price-expired")
    except (OSError, ValueError, TypeError, OverflowError):
        issues.append("snapshot-unavailable")
    rows.append({"path": name, "ok": not issues, "issues": issues, "warnings": []})
    name, issues = "data/treasury/juno-delegation-accounting.json", []
    try:
        value = read_object(root, name)
        issues += age_issues(timestamp(value.get("checked_at")), now, CADENCES["treasury"])
        if value.get("chain_id") != "juno-1" or value.get("dao_id") != "juno-delegation" or value.get("schema_version") != 4:
            issues.append("invalid-source-identity")
        if value.get("accrual_refresh_status") != "completed":
            issues.append("staking-accrual-refresh-unavailable")
        coverage = value.get("accrual_coverage")
        if not isinstance(coverage, dict) or coverage.get("status") != "CURRENT":
            issues.append("staking-accrual-coverage-unavailable")
        if not isinstance(coverage, dict):
            raise ValueError("staking coverage missing")
        if (type(coverage.get("intervals")) is not int or coverage["intervals"] < 1
                or type(coverage.get("through_height")) is not int or coverage["through_height"] < 1):
            issues.append("staking-accrual-evidence-missing")
        issues += ["staking-accrual:" + issue for issue in age_issues(
            timestamp(coverage.get("through_time")), now, ACCRUAL_MAX_AGE)]
    except (OSError, ValueError, TypeError, OverflowError):
        issues.append("snapshot-unavailable")
    rows.append({"path": name, "ok": not issues, "issues": issues, "warnings": []})
    return {"ok": all(row["ok"] for row in rows), "sources": rows,
            "scope": "Published observation freshness and refresh results only; no signature, chain or accounting audit."}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default="/srv/cosmoot/public-snapshots/current")
    args = parser.parse_args()
    result = check(args.root)
    print(json.dumps(result))
    raise SystemExit(0 if result["ok"] else 1)
