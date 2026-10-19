"""Read-only roster spans and commit counts at one planner snapshot; no authorization."""
from datetime import datetime, timedelta
import json
import sqlite3
import time


def instant(value):
    return datetime.fromisoformat(value.replace('Z', '+00:00'))


def archive_checkpoint(path, ceiling, latest_time):
    """Choose one recent archived block, never a fabricated or reset start."""
    db = sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True, timeout=1)
    try:
        identity = db.execute("SELECT value FROM meta WHERE key='identity'").fetchone()
        if not identity or json.loads(identity[0]).get('chain') != 'juno-1':
            raise ValueError('Archive chain identity unavailable')
        row = db.execute('SELECT height,time,hash FROM blocks WHERE height<=? ORDER BY height DESC LIMIT 1', (ceiling,)).fetchone()
        if not row or not 0 <= (instant(latest_time) - instant(row[1])).total_seconds() <= 3600:
            raise ValueError('Archive has no recent common snapshot block')
        return {'height': row[0], 'time': row[1], 'hash': row[2].hex().upper()}
    finally:
        db.close()


def active_set_history(path, snapshot, seconds=20):
    deadline = time.monotonic() + seconds
    # URI mode=ro prevents a missing archive from becoming a new empty database.
    db = sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True, timeout=1)
    try:
        db.execute('BEGIN')
        identity = db.execute("SELECT value FROM meta WHERE key='identity'").fetchone()
        identity = json.loads(identity[0]) if identity else None
        if not identity or identity['chain'] != 'juno-1':
            raise ValueError('Archive chain identity unavailable')
        height = snapshot['height']
        endpoint = db.execute('SELECT time FROM blocks WHERE height=?', (height,)).fetchone()
        if not endpoint or instant(endpoint[0]) != instant(snapshot['blockTime']):
            raise ValueError('Archive does not cover this planner snapshot')
        cutoff = (instant(snapshot['blockTime']) - timedelta(days=90)).timestamp()
        first = db.execute('SELECT height FROM blocks WHERE epoch<=? AND height<=? ORDER BY height DESC LIMIT 1', (cutoff, height)).fetchone()
        if not first:
            first = db.execute('SELECT height FROM blocks ORDER BY height LIMIT 1').fetchone()
            if not first or first[0] != identity['firstHeight']:
                raise ValueError('Archive is missing the collection origin')
        origin = db.execute('SELECT time FROM blocks WHERE height=?', (identity['firstHeight'],)).fetchone()
        collection_start = {'height': identity['firstHeight'], 'time': origin[0] if origin else identity['startTime']}
        spans, rosters, previous = [], {}, None
        counts, batch, batch_roster, count_start = {}, bytearray(), [], None

        def flush():
            # Count columns in bounded batches, in C, instead of keeping millions
            # of blocks in memory or iterating over every validator in Python.
            for index, address in enumerate(batch_roster):
                flags = batch[index::len(batch_roster)]
                totals = counts.setdefault(address, [0, 0, 0, 0])
                for slot, value in enumerate((len(flags), flags.count(2), flags.count(1), flags.count(3))):
                    totals[slot] += value
            batch.clear()

        for h, stamp, block_hash, prior_hash, roster, flags in db.execute(
                'SELECT height,time,hash,previous,roster,flags FROM blocks WHERE height BETWEEN ? AND ? ORDER BY height', (first[0], height)):
            if time.monotonic() > deadline:
                raise TimeoutError('Active-set export time budget exceeded')
            if previous and (h != previous[0] + 1 or prior_hash != previous[1] or instant(stamp) < instant(previous[2])):
                raise ValueError('Archive continuity mismatch')
            if roster not in rosters:
                record = db.execute('SELECT addresses FROM rosters WHERE id=?', (roster,)).fetchone()
                if not record:
                    raise ValueError('Missing archived roster')
                addresses = json.loads(record[0])
                if not addresses or addresses != sorted(set(addresses)) or len(addresses) > 200:
                    raise ValueError('Invalid archived roster order')
                rosters[roster] = addresses
            addresses = rosters[roster]
            if len(flags) != len(addresses) or sum(flags.count(v) for v in (1, 2, 3)) != len(flags):
                raise ValueError('Invalid archived commit flags')
            # The anchor at/before the 90-day cutoff establishes membership,
            # but contributes no signature slot to the rolling (cutoff, end] window.
            if instant(stamp).timestamp() > cutoff:
                if count_start is None:
                    count_start = {'firstHeight': h, 'startTime': stamp}
                if batch_roster != addresses:
                    flush()
                    batch_roster = addresses
                batch.extend(flags)
                if len(batch) >= len(addresses) * 4096:
                    flush()
            if spans and spans[-1]['addresses'] == addresses:
                spans[-1].update(lastHeight=h, endTime=stamp)
            else:
                spans.append({'firstHeight': h, 'lastHeight': h, 'startTime': stamp,
                              'endTime': stamp, 'addresses': addresses})
                if len(spans) > 10000:
                    raise ValueError('Too many roster transitions for a planner review')
            previous = (h, block_hash, stamp)
        flush()
        expected = sorted(v['consensusAddress'] for v in snapshot['validators'] if v['active'])
        if not spans or spans[-1]['lastHeight'] != height or spans[-1]['addresses'] != expected:
            raise ValueError('Archive and planner consensus set disagree')
        if count_start is None:
            raise ValueError('No observed commit slots in the history window')
        participation = {'schema': 1, **count_start, 'lastHeight': height,
                         'endTime': endpoint[0], 'validators': [
                             dict(zip(('address', 'expected', 'signed', 'absent', 'nil'), (a, *counts[a])))
                             for a in sorted(counts)]}
        return {'schema': 2, 'chainId': 'juno-1', 'source': identity['rpc'],
                'collectionStart': collection_start, 'spans': spans, 'participation': participation}
    finally:
        db.close()
