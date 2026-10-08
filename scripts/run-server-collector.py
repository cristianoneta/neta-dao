"""Bounded server jobs replacing the three old GitHub schedules.

No git commit, push, pull or CI trigger. Root-owned reviewed code; writable data
only. systemd kills the complete control group on timeout, including grandchildren.
"""
import fcntl
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time
import importlib.util
from server_job_status import record

ROOT = Path(__file__).resolve().parents[1]
STATE = Path("/var/lib/cosmoot-collect")


def run(command, seconds, env):
    process = subprocess.Popen(command, cwd=ROOT, env=env, start_new_session=True)
    try:
        return process.wait(timeout=seconds) == 0
    except subprocess.TimeoutExpired:
        os.killpg(process.pid, signal.SIGKILL)
        process.wait()
        return False


def main():
    if len(sys.argv) != 2 or sys.argv[1] not in {"treasury", "main", "members"}:
        raise SystemExit("Choose treasury, main or members")
    job = sys.argv[1]
    env = dict(os.environ, TREASURY_DAILY_SNAPSHOT="auto", PYTHONDONTWRITEBYTECODE="1")
    # Never inherit the price authority into generic collectors.
    env.pop("NNS_PRICE_SIGNING_KEY", None)
    env.pop("CREDENTIALS_DIRECTORY", None)
    with open("/var/lib/cosmoot-collect/collector.lock", "a") as lock:
        deadline = time.monotonic() + 120
        while True:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except BlockingIOError:
                if time.monotonic() >= deadline:
                    record(STATE, job, "busy")
                    raise SystemExit("Collector busy; retained prior snapshots, next timer retries.")
                time.sleep(1)
        jobs = {
            "treasury": [(["scripts/update_treasury.py"], 240),
                         (["scripts/community_block_ledger.py", "--seconds", "180"], 210),
                         (["scripts/update_generic_accounting.py", "--collect"], 240),
                         (["scripts/update_delegation_treasury.py"], 300)],
            "main": [(["scripts/update_main_dao.py"], 360)],
            "members": [(["scripts/update_members.py"], 570)],
        }
        record(STATE, job, "running")
        succeeded = False
        try:
            succeeded = True
            for args, seconds in jobs[job]:
                succeeded = run([sys.executable, *args], seconds, env) and succeeded
            if job == "main":
                credential = Path(os.environ.get("CREDENTIALS_DIRECTORY", "/nonexistent")) / "nns-price-key"
                if credential.is_file():
                    signer_env = dict(env, NNS_PRICE_SIGNING_KEY=credential.read_text())
                    succeeded = run(["node", "names/publish-snapshot.mjs", "data/treasury/neta-main.json",
                                     "docs/deployments/nns-mainnet.json", "data/nns/price.json"],
                                    30, signer_env) and succeeded
                else:
                    print("Price authority missing; retaining previous signed price.", file=sys.stderr)
                    succeeded = False
            # Publish independent results without manufacturing freshness on source failure.
            spec = importlib.util.spec_from_file_location("publisher", ROOT / "scripts/publish-server-snapshots.py")
            publisher = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(publisher)
            publisher.publish(ROOT, "/srv/cosmoot/public-snapshots", json.loads(
                (ROOT / "deploy/cosmoot/snapshot-paths.json").read_text()))
        except BaseException:
            succeeded = False
            raise
        finally:
            record(STATE, job, "succeeded" if succeeded else "failed")
        raise SystemExit(0 if succeeded else 1)


if __name__ == "__main__":
    main()
