import {normalizeName, validateJunoAddress} from './names-profile-core.mjs';

export const DAY = 86400, GRACE = 30 * DAY;
const dateLabel = seconds => new Intl.DateTimeFormat('en-GB', {day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', timeZone:'UTC'}).format(new Date(seconds * 1000)) + ' UTC';
export function validIdentity(record) {
  if (!record || normalizeName(record.name) !== record.name) throw Error('Invalid name identity.');
  validateJunoAddress(record.owner);
  for (const key of ['generation', 'ownership_revision', 'expires_at']) if (!Number.isSafeInteger(record[key]) || record[key] < 1) throw Error('Invalid name identity.');
  return record;
}
function monthsBefore(seconds, months) {
  const date = new Date(seconds * 1000), day = date.getUTCDate();
  date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() - months);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last)); return Math.floor(date.getTime() / 1000);
}
export function reminderSchedule(expiry) {
  return [["6-months", monthsBefore(expiry, 6)], ["3-months", monthsBefore(expiry, 3)], ["1-month", monthsBefore(expiry, 1)],
    ["2-weeks", expiry - 14 * DAY], ["1-week", expiry - 7 * DAY], ["1-day", expiry - DAY], ["expired", expiry], ["released", expiry + GRACE]];
}
export function nameLinks(event) {
  validIdentity(event.identity);
  if (!['juno-1', 'uni-7'].includes(event.chainId)) throw Error('Invalid Names network.');
  const params = new URLSearchParams({'nns-name': event.identity.name, 'nns-network': event.chainId});
  return {profile: `/index.html?${params}#relay/profile`, renew: `/index.html?${params}&nns-action=renew#relay/register`};
}
export function emptyState() { return {version: 1, identities: {}, events: []}; }
export function readState(raw) {
  if (raw === null) return emptyState();
  const state = JSON.parse(raw);
  if (state?.version !== 1 || !state.identities || !Array.isArray(state.events)) throw Error('Saved name notifications cannot be read.');
  for (const record of Object.values(state.identities)) validIdentity(record);
  for (const event of state.events) { validIdentity(event.identity); nameLinks(event); }
  return state;
}
export function observeName(state, record, {owner, chainId, registry, now}) {
  validIdentity(record); validateJunoAddress(owner);
  if (!['juno-1', 'uni-7'].includes(chainId)) throw Error('Invalid Names network.');
  const next = structuredClone(state), prior = next.identities[record.name];
  const sameOwner = record.owner === owner;
  const sameIdentity = prior && prior.generation === record.generation && prior.ownership_revision === record.ownership_revision;
  // Historical messages remain in the previous owner's account; no new reminders follow a transfer.
  if (!sameOwner) {
    delete next.identities[record.name];
    for (const e of next.events) if (e.identity.name === record.name && e.type !== 'NAME TRANSFERRED') { e.superseded = true; e.read = true; }
    if (prior && prior.generation === record.generation && record.ownership_revision > prior.ownership_revision) {
      const thread = ['nns', chainId, registry, owner, prior.name, prior.generation, prior.ownership_revision].join(':');
      const id = `${thread}:transferred:${record.ownership_revision}`;
      if (!next.events.some(e => e.id === id)) next.events.unshift({id, proposalKey:thread, kind:'names', dao:'nns', daoLabel:'NETA NAMING SERVICE',
        title:record.name, type:'NAME TRANSFERRED', detail:`Current owner: ${record.owner}`, chainId, registry, identity:structuredClone(prior),
        createdAt:new Date(now * 1000).toISOString(), read:false,
        body:`${record.name} has been transferred and no longer belongs to your wallet.\n\nThe registry currently confirms ${record.owner} as its owner. You can no longer manage or renew this name as its owner, and you will receive no further renewal reminders for this ownership.\n\nThe registration expiry remains ${dateLabel(record.expires_at)}. Your previous profile and validator proofs do not transfer to the new owner.\n\nNetwork: ${chainId === 'juno-1' ? 'Juno mainnet' : 'UNI-7 testnet'}`});
    }
    next.events = next.events.slice(0, 200);
    return next;
  }
  next.identities[record.name] = record;
  const thread = ['nns', chainId, registry, owner, record.name, record.generation, record.ownership_revision].join(':');
  const date = dateLabel(record.expires_at);
  const network = chainId === 'juno-1' ? 'Juno mainnet' : 'UNI-7 testnet';
  const add = (type, suffix, detail, body) => {
    const id = `${thread}:${suffix}`;
    if (next.events.some(e => e.id === id)) return;
    next.events.unshift({id, proposalKey: thread, kind: 'names', dao: 'nns', daoLabel: 'NETA NAMING SERVICE', title: record.name,
      type, detail, body, chainId, registry, identity: structuredClone(record), createdAt: new Date(now * 1000).toISOString(), read: false});
  };
  for (const e of next.events) {
    if (e.identity.name === record.name && (e.proposalKey !== thread || e.identity.expires_at !== record.expires_at)) { e.superseded = true; e.read = true; }
  }
  if (now < record.expires_at) {
    if (!sameIdentity) {
      if (record.ownership_revision > 1) add('NAME RECEIVED', 'received', `Transfer to your wallet confirmed on ${network}`, `Congratulations — you have received ${record.name}. The registry confirms your wallet as its new owner on ${network}.\n\nWallet: ${owner}\nValid until: ${date}\n\nThe transfer preserves the registration expiry; it does not purchase another year. The previous owner's public profile and validator proofs do not transfer. Set up your own description and public contact details using My profile below.\n\nUse your name as a memorable identity in compatible applications. Manage name opens your registration and renewal options.`);
      else add('WELCOME', 'welcome', `Your name on ${network}`, `Congratulations — ${record.name} is registered to your wallet on ${network}.\n\nWallet: ${owner}\nValid until: ${date}\n\nYour name is a memorable identity inside compatible applications. You can add a description and public contact details to your profile, and compatible apps can resolve your name to its Juno wallet address.\n\nIt is not an Internet domain; other wallets do not automatically recognise it. Private RELAY messaging is still in development.\n\nSet up your profile below, or open Manage name to view and extend your registration.`);
    }
    else if (prior.expires_at !== record.expires_at) add('RENEWAL CONFIRMED', `renewed:${record.expires_at}`, `New expiry: ${date}`, `Your renewal of ${record.name} is confirmed.\n\nPrevious expiry: ${dateLabel(prior.expires_at)}\nNew expiry: ${date}\n\nFuture reminders use the new expiry. Your profile and ownership stay the same.\n\nWallet: ${owner}\nNetwork: ${network}`);
  }
  // Catch up with the most relevant reminder, rather than flooding the inbox after a long absence.
  const due = reminderSchedule(record.expires_at).filter(([, time]) => now >= time).at(-1);
  if (due) {
    const [stage] = due;
    const labels = {'6-months':'6 months','3-months':'3 months','1-month':'1 month','2-weeks':'2 weeks','1-week':'1 week','1-day':'1 day'};
    if (stage === 'released') add('NAME RELEASED', `${record.expires_at}:${stage}`, 'The 30-day grace period has ended', `${record.name} expired on ${date}. Its 30-day grace period has ended and the name can be registered again. Renewal of this previous registration is no longer available.\n\nNetwork: ${network}`);
    else if (stage === 'expired') add('NAME EXPIRED', `${record.expires_at}:${stage}`, `Renew during the 30-day grace period`, `${record.name} expired on ${date} and no longer resolves as an active name. You can renew it before ${dateLabel(record.expires_at + GRACE)}.\n\nUse Renew name below to open the renewal menu. Network: ${network}`);
    else add('RENEWAL REMINDER', `${record.expires_at}:${stage}`, `${labels[stage]} reminder · expires ${date}`, `${record.name} expires on ${date}. This is your ${labels[stage]} reminder.\n\nExtend its registration using Renew name below. The menu will show the term and exact NETA amount before you confirm a payment in Keplr.\n\nNetwork: ${network}`);
  }
  next.events = next.events.slice(0, 200);
  return next;
}
