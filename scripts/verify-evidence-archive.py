#!/usr/bin/env python3
"""Read-only verification of local evidence; no upload or deletion authorization."""
import argparse
import base64
from collections import Counter
import hashlib
import json
from pathlib import Path
import re

from evidence_archive import read_bundle
from public_observation_archive import DAILY


def verify(root):
    root = Path(root).absolute()
    if any(path.is_symlink() for path in (root, *root.parents)) or not root.is_dir():
        raise ValueError('Missing or symlinked archive root')
    counts, disk_bytes = Counter(), 0
    for path in root.rglob('*.json.gz'):
        if any(item.is_symlink() for item in path.parents):
            raise ValueError('Symlinked archive parent')
        value = read_bundle(path)
        if value['kind'] != path.parent.name:
            raise ValueError('Archive kind differs from directory')
        payload = value['payload']
        if 'rawBase64' in payload:
            raw = base64.b64decode(payload['rawBase64'], validate=True)
            if hashlib.sha256(raw).hexdigest() != payload['rawSha256']:
                raise ValueError('Original observation hash differs')
            json.loads(raw)
        if value['kind'] == 'validator-history':
            blocks = payload['tables']['blocks']['rows']
            heights = [row[0] for row in blocks]
            if not heights or heights[0] != payload['firstHeight'] or heights[-1] != payload['lastHeight']:
                raise ValueError('Archive height bounds differ')
            if any(b != a + 1 for a, b in zip(heights, heights[1:])):
                raise ValueError('Archived block gap')
        counts[value['kind']] += 1
        disk_bytes += path.stat().st_size
    for index in (root / 'daily-catalog').glob('*/*.json'):
        if any(item.is_symlink() for item in (index, *index.parents)):
            raise ValueError('Archive catalog symlink')
        reference = json.loads(index.read_text())
        if not re.fullmatch(r'public-observation/[0-9a-f]{64}\.json\.gz', reference['path']):
            raise ValueError('Archive catalog path invalid')
        saved = read_bundle(root / reference['path'])
        sources = {name: path for group in DAILY.values() for name, path, field in group}
        if (saved['payload']['day'] != index.parent.name
                or saved['payload']['sourcePath'] != sources.get(index.stem)):
            raise ValueError('Archive catalog identity differs')
    return {'ok': True, 'bundles': dict(counts), 'storedBytes': disk_bytes,
            'scope': 'Local hashes and references; not independent retention or chain truth.'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('root', type=Path)
    args = parser.parse_args()
    print(json.dumps(verify(args.root)))
