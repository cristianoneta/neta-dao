"""Derived pool charts and immutable USD references; no additional network collection."""
from bisect import bisect_right
from collections import defaultdict
from decimal import Decimal
import hashlib
import json
from pathlib import Path
import sqlite3


def schema(db):
    db.executescript('''
      CREATE TABLE IF NOT EXISTS trade_values (chain TEXT, txhash TEXT, event_index INTEGER, time INTEGER, payload TEXT,
        PRIMARY KEY(chain,txhash,event_index));
      CREATE TABLE IF NOT EXISTS usd_references (asset TEXT, time INTEGER, payload TEXT, PRIMARY KEY(asset,time));
      CREATE INDEX IF NOT EXISTS problems_pool_time ON problems(pool,time);
    ''')


def freeze_values(db, references, state_root, now):
    """Freeze one leg using a prior recorded price. Never reprice old swaps at today's price."""
    schema(db)
    values, denoms = references
    pending = db.execute('''SELECT s.payload FROM swaps s LEFT JOIN trade_values v
      ON s.chain=v.chain AND s.txhash=v.txhash AND s.event_index=v.event_index
      WHERE v.chain IS NULL ORDER BY s.time''').fetchall()
    start = min((json.loads(r[0])['time'] for r in pending), default=now) - 1800
    from market_direct_sources import stamp
    with db:
        for slug, ref in values.items():
            at = int(stamp(ref['observed_at']))
            if 0 < at <= now:
                db.execute('INSERT OR IGNORE INTO usd_references VALUES (?,?,?)', (slug, at, json.dumps(ref)))
    prices = defaultdict(dict)
    for slug, at, payload in db.execute('SELECT * FROM usd_references WHERE time>=? AND time<=?', (start, now)):
        prices[slug][at] = json.loads(payload)
    # Read existing minute archives. This neither changes the price collector nor
    # creates an extra price polling schedule. Read-only SQLite retains live WAL state.
    for slug in {v[0] for v in denoms.values()}:
        path = Path(state_root) / ('neta.sqlite3' if slug == 'neta' else 'cosmos/' + slug + '.sqlite3')
        if not path.is_file():
            continue
        try:
            source = sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True, timeout=2)
            try:
                for (raw,) in source.execute('SELECT payload FROM samples WHERE time>=? AND time<=? ORDER BY time', (start, now)):
                    o = json.loads(raw)
                    at = int(stamp(o.get('price_observed_at') or o.get('block_time') or o['time']))
                    price = Decimal(str(o.get('price_usd') or 0))
                    anchor = o.get('usd_anchor') or {}
                    anchor_at = stamp(anchor.get('observed_at') or at)
                    if price > 0 and start <= at <= now and -60 <= at-anchor_at <= 1800:
                        prices[slug][at] = {'price': str(price), 'observed_at': at, 'source': 'Recorded minute reference'}
            finally:
                source.close()
        except (sqlite3.Error, ValueError, KeyError, TypeError, ArithmeticError):
            continue
    ordered = {slug: sorted(rows) for slug, rows in prices.items()}
    with db:
        for (raw,) in pending:
            t = json.loads(raw)
            result = {'usd': None, 'basis': 'unavailable', 'reason': 'No prior recorded USD reference within 30 minutes'}
            for side in ('in', 'out'):
                mapped = denoms.get(t['chain'] + ':' + t['denom_' + side])
                if not mapped:
                    continue
                slug, decimals = mapped
                times = ordered.get(slug, [])
                index = bisect_right(times, t['time'])-1
                if index < 0 or t['time']-times[index] > 1800:
                    continue
                at = times[index]
                ref = prices[slug][at]
                usd = Decimal(t['raw_' + side]) / Decimal(10)**decimals * Decimal(ref['price'])
                result = {'usd': str(usd), 'basis': 'prior-recorded-reference', 'reference_at': at,
                          'price': ref['price'], 'asset': slug, 'leg': side,
                          'note': 'USD estimate at a prior reference; wrappers may diverge'}
                break
            db.execute('INSERT OR IGNORE INTO trade_values VALUES (?,?,?,?,?)',
                       (t['chain'], t['txhash'], t['event_index'], t['time'], json.dumps(result, sort_keys=True)))


def stored_value(db, trade):
    row = db.execute('SELECT payload FROM trade_values WHERE chain=? AND txhash=? AND event_index=?',
                     (trade['chain'], trade['txhash'], trade['event_index'])).fetchone()
    return json.loads(row[0]) if row else {'usd': None, 'basis': 'unavailable'}


def publish_histories(db, registry, cursors, output, now, publish):
    """Stream one pool at a time; chart memory is bounded by 458 compact buckets."""
    first_seen = dict(db.execute('SELECT id,first_seen FROM pools'))
    from market_direct_sources import stamp
    ranges = [('1d', 300, 86400), ('7d', 3600, 7*86400)]
    for key, spec in registry.items():
        cursor = cursors.get(spec['chain_id'])
        end = int(stamp(cursor['block_time'])) if cursor else 0
        covered = max(cursor['first_time'], first_seen[key]) if cursor else now
        series = {period: {} for period, _, _ in ranges}
        def buckets(at):
            for period, interval, length in ranges:
                bucket = at//interval*interval
                if (now-length)//interval*interval <= bucket <= now:
                    yield series[period].setdefault(bucket, {'liquid': None, 'usd': Decimal(0), 'swaps': 0, 'valued': 0, 'problem': False})
        # Retain only the latest liquidity and accumulated activity for each bin.
        # No seven-day observation payload list and no per-bucket SQL queries.
        for at, raw in db.execute('SELECT time,payload FROM observations WHERE pool=? AND time>=? AND time<=? ORDER BY time', (key, now-7*86400-3600, now)):
            o = json.loads(raw)
            liquid = float(o['liquidity_usd']) if o.get('status') == 'ok' and o.get('liquidity_usd') is not None else None
            for row in buckets(at): row['liquid'] = liquid
        for at, value in db.execute('''SELECT s.time,v.payload FROM swaps s LEFT JOIN trade_values v
          ON s.chain=v.chain AND s.txhash=v.txhash AND s.event_index=v.event_index
          WHERE s.pool=? AND s.time>=? AND s.time<=? ORDER BY s.time''', (key, now-7*86400-3600, min(now, end))):
            usd = json.loads(value).get('usd') if value else None
            for row in buckets(at):
                row['swaps'] += 1
                if usd is not None:
                    row['usd'] += Decimal(usd)
                    row['valued'] += 1
        for (at,) in db.execute('SELECT time FROM problems WHERE pool=? AND time>=? AND time<=?', (key, now-7*86400-3600, now)):
            for row in buckets(at): row['problem'] = True
        for period, interval, length in ranges:
            points = []
            for bucket, row in sorted(series[period].items()):
                measured = bool(cursor and covered <= bucket and end >= bucket+interval and not row['problem'])
                volume = float(row['usd']) if measured and row['valued'] == row['swaps'] else None
                points.append([bucket, row['liquid'], volume, row['swaps'] if measured else None])
            payload = {'schema_version': 1, 'pool': key, 'generated_at': now, 'range': period,
                       'resolution_seconds': interval, 'columns': ['time', 'liquidity_usd', 'volume_usd', 'swaps'],
                       'points': points, 'volume_basis': 'prior-recorded-reference',
                       'note': 'Volume per interval, not rolling 24h. Partial, unindexed or unvalued intervals remain unavailable.'}
            digest = hashlib.sha256(key.encode()).hexdigest()
            publish(Path(output)/'pilot/history'/digest/(period+'.json'), payload)
