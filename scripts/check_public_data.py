"""Read the data delivered to the three public websites from outside their collectors."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
import sys
import urllib.error
import urllib.request

from server_source_status import MAX_BYTES, age_issues, check, timestamp


RELEASE_SITES = ('https://cosmoot.com', 'https://dao.netareborn.com', 'https://data.cosmoot.com')
NETA_SITE = 'https://netareborn.com'
NETA_SOURCES = {
    'metadata.json': ('generated_at', 8),
    'data/map/state.json': ('updated_at', 8),
    'data/map/map-of-neta.json': ('generated_at', 8),
    'data/recovery/recovery-stats.json': ('updated_at', 3),
    'data/recovery/wynd-market.json': ('updated_at', 30),
}


def download(site, path):
    url = site + '/' + path
    request = urllib.request.Request(url, headers={'Accept': 'application/json',
        'User-Agent': 'Public snapshot freshness monitor/1.0'})
    with urllib.request.urlopen(request, timeout=12) as response:
        if response.geturl() != url or response.status != 200:
            raise ValueError('Unexpected HTTP destination or status')
        body = response.read(MAX_BYTES + 1)
        if len(body) > MAX_BYTES:
            raise ValueError('Oversized public response')
        value = json.loads(body)
        if not isinstance(value, dict):
            raise ValueError('Snapshot object required')
        return value, response.headers.get('X-Cosmoot-Snapshot')


def inspect(site, now, fetch=download):
    observed = {}
    def read(_, name):
        value, delivery = fetch(site, name)
        observed[name] = {key: value[key] for key in (
            'generated_at', 'updated_at', 'blockTime', 'height', 'last_success_at', 'chain_refresh'
        ) if key in value}
        for field in ('accrual_coverage', 'block_coverage'):
            if isinstance(value.get(field), dict):
                observed[name][field] = {k: value[field].get(k) for k in ('status','through_time','through_height')}
        if name == 'data/treasury/current.json':
            market = value.get('wynd_market') or {}
            try:
                observed[name]['market_issues'] = age_issues(timestamp(market.get('block_time')), now, 35*60)
                if market.get('height') != value.get('height') or len(market.get('pools', {})) != 8:
                    observed[name]['market_issues'].append('incomplete-wynd-market')
            except (ValueError, TypeError, AttributeError):
                observed[name]['market_issues'] = ['missing-wynd-observation']
        if delivery:
            observed[name]['delivery'] = delivery
        return value

    if site == NETA_SITE:
        rows = []
        for name, (field, hours) in NETA_SOURCES.items():
            try:
                value = read(None, name)
                issues = age_issues(timestamp(value.get(field)), now, hours * 3600)
                if name in ('metadata.json', 'data/map/map-of-neta.json') and value.get('validation', {}).get('passed') is not True:
                    issues.append('source-validation-unavailable')
                if name.endswith('recovery-stats.json') and (value.get('status') != 'COLLECTING' or
                        type(value.get('juno_last_height')) is not int or value['juno_last_height'] <= 0):
                    issues.append('missing-recovery-coverage')
                if name.endswith('wynd-market.json') and len(value.get('pools', {})) != 8:
                    issues.append('pool-coverage-unavailable')
            except (OSError, ValueError, TypeError, KeyError, AttributeError, OverflowError) as error:
                issues = [type(error).__name__]
            rows.append(dict(path=name, issues=issues))
    else:
        rows = check('.', now=now, reader=read)['sources']
        market_path = 'data/treasury/current.json'
        for row in rows:
            if row['path'] == market_path and 'market_issues' in observed.get(market_path, {}):
                row['issues'].extend(observed[market_path]['market_issues'])
            if observed.get(row['path'], {}).get('delivery') == 'static-fallback':
                row['issues'].append('static-fallback')
    for row in rows:
        row.update(ok=not row['issues'], observation=observed.get(row['path']))
    return dict(site=site, ok=all(row['ok'] for row in rows), sources=rows)


def main():
    now = datetime.now(timezone.utc)
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda site: inspect(site, int(now.timestamp())), (*RELEASE_SITES, NETA_SITE)))
    print(json.dumps({'checked_at': now.isoformat(), 'sites': results}, indent=2))
    return int(any(not result['ok'] for result in results))


if __name__ == '__main__':
    sys.exit(main())
