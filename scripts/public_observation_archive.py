"""Daily membership/planner evidence and every signed price; outside public data.

Daily means first successfully archived observation for its original UTC date,
not an end-of-day balance or a complete membership event history.
"""
import base64
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re

from evidence_archive import atomic_json, directory, read_bundle, store

DAILY = {
    'members': [('juno', 'data/daos/juno.json', 'generated_at'),
                ('neta', 'data/daos/neta.json', 'generated_at'),
                ('neta-operations', 'data/daos/neta-operations.json', 'generated_at')],
    'main': [('planner', 'data/daos/juno-delegation-planner.json', 'blockTime')],
    'treasury': [],
}


def source(repo, path):
    target = Path(repo) / path
    if any(item.is_symlink() for item in (target, *target.parents)):
        raise ValueError('Observation source must not contain symlinks')
    with target.open('rb') as stream:
        raw = stream.read(25 * 1024 * 1024 + 1)
    if len(raw) > 25 * 1024 * 1024:
        raise ValueError('Observation source too large')
    value = json.loads(raw)
    if not isinstance(value, dict):
        raise ValueError('Observation must be an object')
    return raw, value


def capture(repo, root, job):
    count = 0
    for name, path, field in DAILY[job]:
        raw, value = source(repo, path)
        observed = datetime.fromisoformat(value[field].replace('Z', '+00:00'))
        if observed.tzinfo is None:
            raise ValueError('Observation timezone missing')
        day = observed.astimezone(timezone.utc).date().isoformat()
        catalog = directory(Path(root) / 'daily-catalog' / day)
        index = catalog / (name + '.json')
        if index.is_symlink():
            raise ValueError('Archive index symlink')
        if index.exists():
            receipt = json.loads(index.read_text())
            if not re.fullmatch(r'public-observation/[0-9a-f]{64}\.json\.gz', receipt['path']):
                raise ValueError('Invalid observation archive reference')
            saved = read_bundle(Path(root) / receipt['path'])['payload']
            if saved['sourcePath'] != path or saved['day'] != day:
                raise ValueError('Observation archive identity mismatch')
            continue
        receipt = store(root, 'public-observation', {
            'sourcePath': path, 'day': day, 'observedAt': value[field],
            'rawSha256': hashlib.sha256(raw).hexdigest(),
            'rawBase64': base64.b64encode(raw).decode(),
            'scope': 'First archived observation of UTC day, not complete intraday history.'})
        atomic_json(index, receipt)
        count += 1
    if job == 'main':
        raw, value = source(repo, 'data/nns/price.json')
        observed = value['snapshot']['observed_at']
        if type(observed) is not int or not isinstance(value.get('signature'), str):
            raise ValueError('Missing signed price observation')
        # Identical source bytes reuse one bundle. No signature or expiry changes.
        store(root, 'signed-price', {'sourcePath': 'data/nns/price.json',
              'observedAt': observed, 'rawSha256': hashlib.sha256(raw).hexdigest(),
              'rawBase64': base64.b64encode(raw).decode()})
        count += 1
    return {'localBundlesChecked': count, 'independentRetention': False}
