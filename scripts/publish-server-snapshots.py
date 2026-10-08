"""Publish only explicitly public JSON snapshots; no Git write or deployment token.

Run while holding the common collector lock. A relative symlink switch makes a
complete generation visible atomically. Keep the two previous generations.
"""
import gzip
import hashlib
import io
import json
import os
from pathlib import Path
import re
import shutil
import sys
import tempfile
import time

MAX_BYTES = 25 * 1024 * 1024


def publish(repo, destination, paths):
    repo, destination = Path(repo).resolve(), Path(destination).resolve()
    destination.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix="generation-", dir=destination))
    os.chmod(stage, 0o755)
    link = destination / (".next-" + stage.name)
    try:
        receipt = {"published_at": int(time.time()), "files": {}}
        for name in paths:
            if not re.fullmatch(r"data/(?:treasury|daos|nns)/[a-z0-9-]+\.json(?:\.gz)?", name):
                raise ValueError("Invalid public snapshot path")
            source = repo / name
            if any(part.is_symlink() for part in [source, *source.parents] if part != repo):
                raise ValueError("Symlink in snapshot source")
            if not source.is_file() or source.stat().st_size > MAX_BYTES:
                raise ValueError("Missing or oversized snapshot: " + name)
            content = source.read_bytes()
            decoded = content
            if name.endswith(".gz"):
                with gzip.GzipFile(fileobj=io.BytesIO(content)) as stream:
                    decoded = stream.read(64 * 1024 * 1024 + 1)
                if len(decoded) > 64 * 1024 * 1024:
                    raise ValueError("Expanded snapshot too large")
            json.loads(decoded)
            target = stage / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content)
            os.chmod(target, 0o644)
            receipt["files"][name] = hashlib.sha256(content).hexdigest()
        if not receipt["files"]:
            raise ValueError("Empty public snapshot set")
        current = destination / "current"
        if current.exists() and not current.is_symlink():
            raise ValueError("Current must be a generation symlink")
        previous_receipt = current / "receipt.json"
        if previous_receipt.exists():
            previous = json.loads(previous_receipt.read_text())
            if previous["files"] == receipt["files"]:
                shutil.rmtree(stage)
                return False
        (stage / "receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
        os.chmod(stage / "receipt.json", 0o644)
        link.symlink_to(stage.name, target_is_directory=True)
        os.replace(link, current)
    except BaseException:
        link.unlink(missing_ok=True)
        shutil.rmtree(stage)
        raise
    # Only our generation directories are eligible for retention cleanup.
    older = sorted((p for p in destination.glob("generation-*")
                    if p.is_dir() and not p.is_symlink() and p != stage),
                   key=lambda p: p.stat().st_mtime, reverse=True)
    for path in older[2:]:
        shutil.rmtree(path)
    return True


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    if len(sys.argv) != 2:
        raise SystemExit("Usage: publish-server-snapshots.py PUBLIC_DIRECTORY")
    changed = publish(root, sys.argv[1], json.loads(
        (root / "deploy/cosmoot/snapshot-paths.json").read_text()))
    print("Public snapshots published." if changed else "Public snapshots unchanged.")
