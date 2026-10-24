"""Deterministic lockfile/artifact inventory; not a binary reachability or vulnerability audit."""
import hashlib
import json
from pathlib import Path
import tomllib

ROOT = Path(__file__).resolve().parent.parent


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def inventory():
    npm = []
    for directory in (".", "faucet", "relay-backup", "spikes/relay-corecrypto"):
        path = ROOT / directory / "package-lock.json"
        lock = json.loads(path.read_text())
        npm.append({"lockfile": path.relative_to(ROOT).as_posix(), "sha256": sha(path),
                    "packages": [{"path": name, "version": package.get("version"),
                                  "integrity": package.get("integrity"), "development": package.get("dev", False)}
                                 for name, package in sorted(lock["packages"].items()) if name]})
    rust = []
    for contract in json.loads((ROOT / "scripts/contracts.json").read_text()):
        path = ROOT / "contracts" / contract / "Cargo.lock"
        lock = tomllib.loads(path.read_text())
        rust.append({"contract": contract, "sha256": sha(path), "packages": lock["package"]})
    binaries = [{"path": path.relative_to(ROOT).as_posix(), "sha256": sha(path)}
                for path in sorted((ROOT / "assets").rglob("*.wasm"))]
    return {"schema": 1, "coverage": {
        "npm": "Resolved lockfile packages, including development tools; not page-load reachability.",
        "rust": "Complete contract locks include native test dependencies. Target-specific exclusion is enforced separately by check-contracts audit.",
        "embeddedWasm": "Artifact identity only. npm audit does not inspect Rust dependencies inside third-party WASM; CoreCrypto requires a separate upstream source/build assessment."
    }, "npm": npm, "contracts": rust, "wasmArtifacts": binaries,
        "contractAuditPolicy": json.loads((ROOT / "scripts/contract-audit-policy.json").read_text())}


if __name__ == "__main__":
    output = ROOT / "dist/dependency-inventory.json"
    output.parent.mkdir(exist_ok=True)
    output.write_text(json.dumps(inventory(), indent=2, sort_keys=True) + "\n")
    print("Wrote dist/dependency-inventory.json; coverage limits are explicit in the report.")
