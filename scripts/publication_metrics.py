"""Summarize real publication payload bytes from the last day of systemd journal JSON."""
from collections import defaultdict
from datetime import datetime, timezone
import json
import sys

FIELDS = ('files', 'input_bytes', 'changed_bytes', 'written_bytes', 'linked_bytes')


def summarize(lines, now):
    groups = defaultdict(lambda: dict(attempts=0, switches=0, **dict.fromkeys(FIELDS, 0)))
    stamps = []
    for line in lines:
        entry = json.loads(line)
        try:
            message = json.loads(entry.get('MESSAGE', ''))
        except (TypeError, ValueError):
            continue
        if not isinstance(message, dict) or 'snapshot_publication' not in message:
            continue
        stamp = int(entry['__REALTIME_TIMESTAMP']) / 1_000_000
        if not now - 86400 <= stamp <= now:
            continue
        job, info = message['job'], message['snapshot_publication']
        if job not in ('members','treasury','main') or any(type(info[k]) is not int or info[k] < 0 for k in FIELDS):
            raise ValueError('Invalid publication metrics')
        if info['input_bytes'] != info['written_bytes'] + info['linked_bytes']:
            raise ValueError('Inconsistent publication byte counts')
        group = groups[job]
        group['attempts'] += 1
        group['switches'] += int(info['switched'])
        for field in FIELDS:
            group[field] += info[field]
        stamps.append(stamp)
    def utc(t):
        return datetime.fromtimestamp(t, timezone.utc).isoformat()
    return {'from': utc(now-86400), 'through': utc(now), 'samples': len(stamps),
            'first_sample': utc(min(stamps)) if stamps else None, 'last_sample': utc(max(stamps)) if stamps else None,
            'by_job': dict(groups), 'totals': {k: sum(g[k] for g in groups.values()) for k in FIELDS}}


if __name__ == '__main__':
    print(json.dumps(summarize(sys.stdin, datetime.now(timezone.utc).timestamp()), indent=2))
