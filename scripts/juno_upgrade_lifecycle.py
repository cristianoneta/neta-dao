"""Deterministic proposal/observation lifecycle; does not schedule or publish.

The transport must supply two independent, same-height governance observations.
Canonical history comes from update_validator_upgrades' two-observer scanner.
Keep plan execution height distinct from the last committed pre-upgrade block.
"""
import copy
from datetime import datetime, timezone
import hashlib
import re

from update_validator_upgrades import checked_commit, checked_validators, instant, validate_checkpoint

WINDOW_SECONDS = 5 * 60 * 60
GOVERNANCE_SOURCES = ('https://juno-api.polkachu.com', 'https://juno.api.m.stavr.tech')
STATES = {1: 'deposit', 2: 'voting', 3: 'passed', 4: 'rejected', 5: 'failed'}
MODERN = '/cosmos.upgrade.v1beta1.MsgSoftwareUpgrade'
LEGACY = '/cosmos.upgrade.v1beta1.SoftwareUpgradeProposal'
WRAPPER = '/cosmos.gov.v1.MsgExecLegacyContent'


def timestamp(value):
    return datetime.fromtimestamp(value, timezone.utc).isoformat().replace('+00:00', 'Z')


def number(value):
    if isinstance(value, bool) or not re.fullmatch(r'[1-9][0-9]*', str(value)):
        raise ValueError('Invalid positive chain integer')
    result = int(value)
    if result >= 2 ** 63:
        raise ValueError('Chain integer out of range')
    return result


def plan(value):
    if not isinstance(value, dict):
        raise ValueError('Missing upgrade plan')
    name = value.get('name')
    if not isinstance(name, str) or not name.strip() or len(name) > 128 or any(ord(c) < 32 for c in name):
        raise ValueError('Invalid upgrade name')
    height = number(value.get('height'))
    if height < 2:
        raise ValueError('Upgrade lacks a prior committed block')
    # Info may contain arbitrary links/text; never execute or fetch it.
    return {'name': name, 'height': height}


def proposal_status(value):
    if isinstance(value, str) and value.startswith('PROPOSAL_STATUS_'):
        status = value.removeprefix('PROPOSAL_STATUS_').lower().removesuffix('_period')
        if status in STATES.values():
            return status
    if not isinstance(value, bool) and str(value) in {str(k) for k in STATES}:
        return STATES[int(value)]
    raise ValueError('Unsupported governance status')


def upgrades(proposals):
    if not isinstance(proposals, list) or len(proposals) > 500:
        raise ValueError('Invalid bounded proposal page')
    result, seen = [], set()
    for proposal in proposals:
        identifier = number(proposal.get('id', proposal.get('proposal_id')))
        if identifier in seen:
            raise ValueError('Duplicate proposal identity')
        seen.add(identifier)
        messages = proposal.get('messages')
        if messages is None:
            messages = [proposal['content']] if proposal.get('content') else []
        if not isinstance(messages, list) or len(messages) > 100:
            raise ValueError('Invalid proposal messages')
        for index, message in enumerate(messages):
            if not isinstance(message, dict):
                raise ValueError('Invalid proposal message')
            if message.get('@type') == WRAPPER:
                message = message.get('content', {})
                if not isinstance(message, dict):
                    raise ValueError('Invalid legacy content')
            if message.get('@type') not in (MODERN, LEGACY):
                continue  # Titles, metadata and unrelated messages are not evidence.
            result.append({'proposalId': identifier, 'messageIndex': index,
                           'status': proposal_status(proposal.get('status')), 'plan': plan(message.get('plan'))})
    return sorted(result, key=lambda row: (row['proposalId'], row['messageIndex']))


def governance(observations):
    if not isinstance(observations, list) or len(observations) != 2:
        raise ValueError('Two governance observations required')
    normalized, sources = [], []
    for value in observations:
        source = value.get('source', '')
        if not source.startswith('https://') or source in sources:
            raise ValueError('Independent HTTPS governance sources required')
        sources.append(source)
        if value.get('chainId') != 'juno-1' or value.get('complete') is not True or 'activePlan' not in value:
            raise ValueError('Wrong chain or partial governance scan')
        normalized.append({'height': number(value.get('height')),
                           'proposals': upgrades(value.get('proposals')),
                           'activePlan': plan(value['activePlan']) if value.get('activePlan') else None})
    if set(sources) != set(GOVERNANCE_SOURCES) or normalized[0] != normalized[1]:
        raise ValueError('Governance observers disagree')
    return normalized[0]


def reconcile(registry, observations, now):
    snapshot = governance(observations)  # Reject the entire uncertain read before mutation.
    if registry.get('schema') != 1 or registry.get('chainId') != 'juno-1':
        raise ValueError('Invalid upgrade registry')
    if snapshot['height'] < registry.get('observedHeight', 0):
        raise ValueError('Governance observation moved backwards')
    result = copy.deepcopy(registry)
    events = result.setdefault('events', {})
    grouped = {}
    for row in snapshot['proposals']:
        grouped.setdefault(row['plan']['name'], []).append(row)
    for name, rows in grouped.items():
        identifier = 'juno-plan-' + hashlib.sha256(name.encode()).hexdigest()[:24]
        old = events.get(identifier)
        if old and old['status'] in ('closed', 'observing'):
            continue  # Anchored events and archives cannot be revised by a late proposal read.
        approved = [r for r in rows if r['status'] == 'passed' and r['plan'] == snapshot['activePlan']]
        chosen = (approved or rows)[-1]
        current_plan = chosen['plan']
        status = chosen['status']
        if approved:
            status = 'scheduled' if snapshot['height'] < current_plan['height'] else 'awaiting-halt-evidence'
        elif status == 'passed':
            status = 'not-scheduled'
            if snapshot['height'] >= current_plan['height'] and old and old.get('confirmedPlan') == current_plan:
                status = 'awaiting-halt-evidence'
            if old and old['status'] == 'scheduled' and snapshot['height'] < old['plan']['height']:
                status = 'cancelled'
        event = old or {'id': identifier, 'chainId': 'juno-1', 'firstSeenAt': timestamp(now),
                        'path': '/community-tools/validator-upgrades/' + identifier + '/', 'revisions': []}
        if old and old['plan'] != current_plan:
            event['revisions'].append({'plan': copy.deepcopy(old['plan']), 'changedAt': timestamp(now)})
        event.update(plan=copy.deepcopy(current_plan), status=status,
                     governanceStatus=chosen['status'], proposalIds=sorted({r['proposalId'] for r in rows}))
        if approved:
            event['confirmedPlan'] = copy.deepcopy(current_plan)
        elif status != 'awaiting-halt-evidence':
            event.pop('confirmedPlan', None)
        events[identifier] = event
    result.update(observedHeight=snapshot['height'], checkedAt=timestamp(now))
    return result


def anchor(event, blocks, validator_sets, now):
    if event['status'] in ('observing', 'closed'):
        return copy.deepcopy(event)
    if event['status'] not in ('scheduled', 'awaiting-halt-evidence') or event.get('confirmedPlan') != event['plan']:
        raise ValueError('Unscheduled upgrade cannot start observation')
    # Cosmos executes the upgrade before committing scheduled height H; H-1 is
    # the final old-chain block, and validators at H form the fixed baseline.
    execution_height = event['plan']['height']
    block = checked_commit(blocks, execution_height - 1, 'juno-1')
    if len(validator_sets) != 2:
        raise ValueError('Two baseline validator observations required')
    validators = checked_validators(validator_sets, execution_height)
    halt_time = instant(block['header']['time'])
    if halt_time > now:
        raise ValueError('Halt anchor lies in the future')
    result = copy.deepcopy(event)
    result.update(status='observing', upgradeHeight=execution_height - 1,
                  halt={'height': execution_height - 1, 'hash': block['commit']['block_id']['hash'],
                        'time': block['header']['time']}, deadline=timestamp(halt_time + WINDOW_SECONDS),
                  validators=[{'address': v['address'], 'power': v['voting_power']} for v in validators],
                  firstSignatures={v['address']: None for v in validators},
                  scannedThrough=execution_height - 1, scannedHash=block['commit']['block_id']['hash'])
    return result


def observe(event, history, now):
    if event['status'] == 'closed':
        return copy.deepcopy(event)  # Late or restarted workers cannot overwrite a closed result.
    if event['status'] != 'observing':
        raise ValueError('Missing confirmed halt anchor')
    expected_deadline = instant(event['halt']['time']) + WINDOW_SECONDS
    if instant(event['deadline']) != expected_deadline:
        raise ValueError('Observation deadline changed')
    result = copy.deepcopy(event)
    if history is not None:
        validate_checkpoint(history, {'id': event['id'], 'chainId': 'juno-1', 'height': event['upgradeHeight']})
        if history['halt'] != event['halt'] or history['validators'] != event['validators']:
            raise ValueError('Observation anchor/baseline changed')
        if history['scannedThrough'] < event['scannedThrough']:
            raise ValueError('Observation watermark moved backwards')
        if history['scannedThrough'] == event['scannedThrough'] and history['scannedHash'] != event['scannedHash']:
            raise ValueError('Observation boundary hash changed')
        for address, record in history['firstSignatures'].items():
            if record and instant(record['timestamp']) <= expected_deadline:
                previous = result['firstSignatures'][address]
                if previous is not None and record != previous:
                    raise ValueError('First signature evidence changed')
                result['firstSignatures'][address] = copy.deepcopy(record)
        result.update(scannedThrough=history['scannedThrough'], scannedHash=history['scannedHash'],
                      scannedBlockTime=history.get('scannedBlockTime'),
                      resumed=history['firstResumedSignatureTime'] is not None)
    all_signed = bool(result.get('resumed')) and bool(result['firstSignatures']) and all(result['firstSignatures'].values())
    coverage = bool(result.get('scannedBlockTime')) and instant(result['scannedBlockTime']) >= expected_deadline
    if all_signed or now >= expected_deadline:
        result.update(status='closed', endedAt=timestamp(min(now, expected_deadline)),
                      reason='all-validators-evidenced' if all_signed and now < expected_deadline else 'five-hour-limit',
                      coverageComplete=all_signed or coverage,
                      missingEvidenceNote=None if all_signed else (
                          'No upgrade evidenced within 5h' if coverage else 'Observation coverage incomplete'))
    return result
