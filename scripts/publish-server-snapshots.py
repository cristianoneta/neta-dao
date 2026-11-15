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
import stat
import sys
import tempfile
import time

MAX_BYTES = 25 * 1024 * 1024


BALLOT_PATH = re.compile(r'data/governance/juno-votes/[1-9][0-9]{0,19}\.json')


def previous_generation(destination):
    current = destination / "current"
    if not current.is_symlink():
        if current.exists():
            raise ValueError("Current must be a generation symlink")
        return None, {}
    name = os.readlink(current)
    if not re.fullmatch(r"generation-[A-Za-z0-9_-]+", name):
        raise ValueError("Invalid current generation")
    folder = destination / name
    manifest = folder / "receipt.json"
    if folder.is_symlink() or manifest.is_symlink() or not manifest.is_file():
        raise ValueError("Invalid generation receipt")
    return folder, json.loads(manifest.read_text())["files"]


def reusable(folder, name, content):
    path = folder / name
    # No component between the generation and file may redirect the link.
    if any(p.is_symlink() for p in path.parents if folder in p.parents):
        return False
    try:
        info = path.lstat()
        return (stat.S_ISREG(info.st_mode) and stat.S_IMODE(info.st_mode) == 0o644
                and info.st_size == len(content) and path.read_bytes() == content)
    except FileNotFoundError:
        return False


def publish(repo, destination, paths, *, metrics=None):
    repo, destination = Path(repo).resolve(), Path(destination).resolve()
    destination.mkdir(parents=True, exist_ok=True)
    previous_dir, previous = previous_generation(destination)
    counters = dict(files=0, input_bytes=0, changed_bytes=0, linked_bytes=0, written_bytes=0)
    repaired = False
    stage = Path(tempfile.mkdtemp(prefix="generation-", dir=destination))
    os.chmod(stage, 0o755)
    link = destination / (".next-" + stage.name)
    try:
        receipt = {"published_at": int(time.time()), "files": {}}
        vote_directory = repo / "data/governance/juno-votes"
        ballots = sorted(str(f.relative_to(repo)) for f in vote_directory.glob("*.json")
                         if BALLOT_PATH.fullmatch(str(f.relative_to(repo))))
        for name in [*paths, *ballots]:
            if not BALLOT_PATH.fullmatch(name) and not re.fullmatch(r"data/(?:treasury|daos|nns)/[a-z0-9-]+\.json(?:\.gz)?", name):
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
            digest = hashlib.sha256(content).hexdigest()
            if name in receipt["files"]:
                raise ValueError("Duplicate public snapshot path")
            receipt["files"][name] = digest
            counters["files"] += 1
            counters["input_bytes"] += len(content)
            if previous.get(name) == digest:
                if reusable(previous_dir, name, content):
                    try:
                        os.link(previous_dir / name, target, follow_symlinks=False)
                    except OSError:
                        pass  # Filesystems without hardlinks still publish an independent copy.
                    else:
                        counters["linked_bytes"] += len(content)
                        continue
                else:
                    repaired = True
            else:
                counters["changed_bytes"] += len(content)
            target.write_bytes(content)
            os.chmod(target, 0o644)
            counters["written_bytes"] += len(content)
        if not receipt["files"]:
            raise ValueError("Empty public snapshot set")
        current = destination / "current"
        missing_ballots = {p for p in previous if BALLOT_PATH.fullmatch(p)} - receipt["files"].keys()
        if missing_ballots:
            raise ValueError("Missing retained ballot archives; preserving the previous publication")
        if previous == receipt["files"] and not repaired:
            shutil.rmtree(stage)
            if metrics is not None:
                metrics.update(counters, switched=False)
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
    if metrics is not None:
        metrics.update(counters, switched=True)
    return True


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    if len(sys.argv) != 2:
        raise SystemExit("Usage: publish-server-snapshots.py PUBLIC_DIRECTORY")
    changed = publish(root, sys.argv[1], json.loads(
        (root / "deploy/cosmoot/snapshot-paths.json").read_text()))
    print("Public snapshots published." if changed else "Public snapshots unchanged.")
