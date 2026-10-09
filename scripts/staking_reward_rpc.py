"""Bounded, height-pinned distribution queries over the existing Juno RPC.

Only the length-delimited fields of the two Cosmos SDK query responses are
accepted. SDK LegacyDec protobuf amounts are integer strings scaled by 1e18,
unlike the decimal strings returned by REST. Never interpret a current response
as historical state, or replace unavailable state with zero rewards.
"""
import base64
import json
import re
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from community_block_ledger import RPC

MAX_BYTES = 512 * 1024


def fields(raw, allowed):
    if len(raw) > MAX_BYTES:
        raise ValueError('Reward protobuf too large')
    position = 0

    def varint():
        nonlocal position
        value = 0
        for shift in range(0, 70, 7):
            if position >= len(raw):
                raise ValueError('Truncated reward protobuf')
            byte = raw[position]
            position += 1
            value |= (byte & 127) << shift
            if not byte & 128:
                return value
        raise ValueError('Oversized reward protobuf varint')

    result = {number: [] for number in allowed}
    while position < len(raw):
        tag = varint()
        number, wire = tag >> 3, tag & 7
        if number not in allowed or wire != 2:
            raise ValueError('Unexpected reward protobuf field')
        length = varint()
        if length > len(raw) - position:
            raise ValueError('Truncated reward protobuf field')
        result[number].append(raw[position:position + length])
        position += length
    return result


def single(values):
    if len(values) != 1:
        raise ValueError('Missing or duplicate reward protobuf field')
    return values[0].decode('utf-8', errors='strict')


def coin(raw):
    value = fields(raw, (1, 2))
    denom, amount = single(value[1]), single(value[2])
    if not re.fullmatch(r'[a-zA-Z][a-zA-Z0-9/:._-]{0,127}', denom):
        raise ValueError('Invalid reward denomination')
    if not re.fullmatch(r'[0-9]{1,100}', amount):
        raise ValueError('Invalid SDK reward decimal')
    whole, fraction = divmod(int(amount), 10**18)
    return {'denom': denom, 'amount': f'{whole}.{fraction:018d}'}


def decode_rewards(raw):
    value = fields(raw, (1, 2))
    rewards = []
    for raw_row in value[1]:
        row = fields(raw_row, (1, 2))
        validator = single(row[1])
        if not re.fullmatch(r'junovaloper1[023456789acdefghjklmnpqrstuvwxyz]{38,58}', validator):
            raise ValueError('Invalid reward validator')
        rewards.append({'validator_address': validator, 'reward': [coin(c) for c in row[2]]})
    return {'rewards': rewards, 'total': [coin(c) for c in value[2]]}


def query(method, address, height):
    if method not in ('DelegationTotalRewards', 'DelegatorWithdrawAddress'):
        raise ValueError('Unsupported historical query')
    if not re.fullmatch(r'juno1[023456789acdefghjklmnpqrstuvwxyz]{38,58}', address):
        raise ValueError('Invalid rewards address')
    if type(height) is not int or not 0 < height < 2**63:
        raise ValueError('Invalid rewards height')
    encoded = address.encode('ascii')
    data = (b'\x0a' + bytes([len(encoded)]) + encoded).hex()
    url = RPC + '/abci_query?' + urlencode({
        'path': json.dumps('/cosmos.distribution.v1beta1.Query/' + method),
        'data': '0x' + data, 'height': str(height), 'prove': 'false',
    })
    with urlopen(Request(url, headers={'Accept': 'application/json'}), timeout=12) as response:
        raw = response.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise ValueError('Historical reward response too large')
    payload = json.loads(raw)
    result = payload.get('result', {}).get('response', {})
    if payload.get('error') or type(result.get('code')) is not int or result['code'] != 0:
        raise ValueError('Historical reward RPC state unavailable')
    if result.get('height') != str(height):
        raise ValueError('Historical reward RPC did not confirm requested height')
    return base64.b64decode(result.get('value', ''), validate=True)


def historical_rewards(address, height):
    rewards = decode_rewards(query('DelegationTotalRewards', address, height))
    owner = single(fields(query('DelegatorWithdrawAddress', address, height), (1,))[1])
    if owner != address:
        raise ValueError('Historical reward withdrawal owner changed')
    return rewards
