"""Private atomic collector receipts. A successful run is not a source-freshness claim."""
import argparse
import json
import os
from pathlib import Path
import tempfile
import time

JOBS = {"treasury": 35 * 60, "main": 65 * 60, "members": 65 * 60}
MAX_RUN_SECONDS = 22 * 60


def record(directory, job, status, *, now=None):
    if job not in JOBS or status not in {"running", "succeeded", "failed", "busy"}:
        raise ValueError("Invalid collector receipt")
    now = int(time.time() if now is None else now)
    directory = Path(directory)
    path = directory / (job + ".json")
    try:
        previous = json.loads(path.read_text())
        if previous.get("schema") != 1 or previous.get("job") != job:
            raise ValueError("Wrong collector receipt identity")
    except FileNotFoundError:
        previous = {}
    value = {"schema": 1, "job": job, "status": status, "updatedAt": now,
             "startedAt": now if status == "running" else previous.get("startedAt"),
             "lastSuccessfulRun": now if status == "succeeded" else previous.get("lastSuccessfulRun")}
    fd, temporary = tempfile.mkstemp(prefix=".status-", dir=directory)
    try:
        with os.fdopen(fd, "w") as file:
            json.dump(value, file, sort_keys=True)
            file.write("\n")
            file.flush()
            os.fsync(file.fileno())
        os.replace(temporary, path)
    finally:
        Path(temporary).unlink(missing_ok=True)
    return value


def check(directory, *, now=None):
    now = int(time.time() if now is None else now)
    results = []
    for job, maximum_age in JOBS.items():
        issues = []
        try:
            receipt = json.loads((Path(directory) / (job + ".json")).read_text())
            if receipt.get("schema") != 1 or receipt.get("job") != job:
                raise ValueError("receipt identity")
            last = receipt.get("lastSuccessfulRun")
            if type(last) is not int or last > now + 60 or now - last > maximum_age:
                issues.append("no-recent-success")
            status = receipt.get("status")
            if status not in {"running", "succeeded", "failed", "busy"}:
                issues.append("invalid-status")
            elif status in {"failed", "busy"}:
                issues.append(status)
            elif status == "running":
                start = receipt.get("startedAt")
                if type(start) is not int or start > now + 60 or now - start > MAX_RUN_SECONDS:
                    issues.append("run-stalled")
        except (OSError, ValueError, TypeError, AttributeError):
            issues.append("receipt-unavailable")
        results.append({"job": job, "ok": not issues, "issues": issues})
    return {"ok": all(row["ok"] for row in results), "jobs": results,
            "scope": "Collector process completion only; inspect source timestamps separately."}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--directory", default="/var/lib/cosmoot-collect")
    parser.add_argument("--snapshot-root", help="Also check published observations and refresh results")
    args = parser.parse_args()
    result = check(args.directory)
    if args.snapshot_root:
        from server_source_status import check as check_sources
        result = {"ok": result["ok"], "processes": result, "published": check_sources(args.snapshot_root)}
        result["ok"] = result["ok"] and result["published"]["ok"]
    print(json.dumps(result))
    raise SystemExit(0 if result["ok"] else 1)
