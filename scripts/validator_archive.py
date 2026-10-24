"""Export exact SQLite rows before hot-history pruning; never re-date evidence."""
import base64
import json

from evidence_archive import store


def encode(value):
    return {'base64': base64.b64encode(value).decode()} if isinstance(value, bytes) else value


def decode(value):
    if isinstance(value, dict):
        if set(value) != {'base64'}:
            raise ValueError('Unknown archive cell')
        return base64.b64decode(value['base64'], validate=True)
    return value


def table(db, name, where, parameters=()):
    query = db.execute(f'SELECT * FROM {name} {where}', parameters)
    return {'columns': [column[0] for column in query.description],
            'rows': [[encode(value) for value in row] for row in query]}


def archive_prefix(db, root, end):
    # Called inside the same SQLite write transaction as deletion. The file can
    # survive a rolled-back transaction and is safe to reuse on the next run.
    identity = json.loads(db.execute("SELECT value FROM meta WHERE key='identity'").fetchone()[0])
    tables = {name: table(db, name, 'WHERE height<=? ORDER BY height', (end,))
              for name in ('blocks', 'events', 'transitions', 'snapshots')}
    # Rosters are tiny, deduplicated, and remain in the hot database. Include the
    # ones needed to interpret this archive without consulting today's database.
    tables['rosters'] = table(db, 'rosters',
        'WHERE id IN (SELECT DISTINCT roster FROM blocks WHERE height<=?) ORDER BY id', (end,))
    blocks = tables['blocks']['rows']
    if not blocks:
        raise ValueError('Cannot archive empty validator prefix')
    # Make ordering deterministic for transitions sharing a height.
    tables['transitions']['rows'].sort()
    payload = {'identity': identity, 'firstHeight': blocks[0][0], 'lastHeight': blocks[-1][0],
               'firstTime': blocks[0][1], 'lastTime': blocks[-1][1], 'tables': tables,
               'scope': 'Original provider observations; not verified signatures or eligibility.'}
    receipt = store(root, 'validator-history', payload)
    return {**receipt, 'firstHeight': payload['firstHeight'], 'lastHeight': payload['lastHeight'],
            'counts': {name: len(value['rows']) for name, value in tables.items()}}
