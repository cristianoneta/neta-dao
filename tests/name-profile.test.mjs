import test from 'node:test';
import assert from 'node:assert/strict';
import { readPublicProfile } from '../name-profile.mjs';
const identity = {
  name: 'cristiano.neta',
  owner: 'juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57',
  generation: 1,
  ownership_revision: 2,
  expires_at: 200
};
const make = (
  record = identity,
  result = { active: true, profile: { identity, contacts: { website: 'https://example.org' } } }
) => ({ identity: async () => record, profile: async () => result, block: { time: 100 } });
test('public profile reads active ownership and safely normalized contacts without a wallet', async () => {
  const data = await readPublicProfile(make(), 'cristiano', () => 100);
  assert.equal(data.identity.owner, identity.owner);
  assert.equal(data.contacts.website, 'https://example.org');
  assert.equal(
    (
      await readPublicProfile(
        make(identity, { active: false, profile: null }),
        'cristiano',
        () => 100
      )
    ).contacts,
    null
  );
});
test('public profile rejects expired names, changed ownership and unsafe contacts', async () => {
  for (const reader of [
    make({ ...identity, expires_at: 99 }),
    make(identity, {}),
    make(identity, { active: false, profile: { identity } }),
    make(identity, {
      active: true,
      profile: { identity: { ...identity, ownership_revision: 1 }, contacts: {} }
    }),
    make(identity, {
      active: true,
      profile: { identity, contacts: { website: 'javascript:alert(1)' } }
    })
  ]) {
    await assert.rejects(readPublicProfile(reader, 'cristiano', () => 100));
  }
});
