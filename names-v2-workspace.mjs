import {snapshotReview} from './names/snapshot-client.mjs?v=2';
import {NamesV2Reader} from './names-v2-reader.mjs?v=5';
import {connectNamesWallet} from './names-v2-wallet.mjs?v=7';
import {normalizeName, normalizeContacts, validateJunoAddress, CONTACT_FIELDS} from './names-profile-core.mjs';
import {createTestQuote} from './names-v2-test-authority.mjs';
import {validateQuote, DEFAULT_TARIFF} from './names-v2-core.mjs?v=20261005-pricing-1';

const $ = id => document.getElementById(id);
const manifests = {'uni-7':'./docs/deployments/nns-uni7-owner-2026-10-04.json','juno-1':'./docs/deployments/nns-mainnet.json'};
let chainId='juno-1';
try { if(localStorage.getItem('neta-nns-network')==='uni-7')chainId='uni-7'; } catch {}
$('nns-network').value=chainId;
const mainnet=()=>chainId==='juno-1';
const networkLabel=()=>mainnet()?'Juno mainnet':'UNI-7';
const tokenLabel=()=>mainnet()?'NETA':'mock NETA';
let reader = null, config = null, session = null, busy = false, review = null, epoch = 0, formVersion = 0, signingReady = null;
const now = () => Math.floor(Date.now() / 1000);
const wallet = () => window.NetaWorkspaceWallet?.getAddress() || null;
const pendingPhases = ['commit_pending', 'payment_pending', 'write_pending'];
const micro = value => { const n = BigInt(value); return `${n / 1000000n}.${(n % 1000000n).toString().padStart(6, '0')}`; };
const message = text => { $('nns-status').textContent = text; };
function clearReview() { review = null; $('nns-review').hidden = true; }
function guard(startEpoch, startVersion) {
  if (startEpoch !== epoch || startVersion !== formVersion) throw Error('The wallet, form or page changed. Review again.');
}
function intent() { return session?.client.load(session.owner) || null; }
function fee() {
  try {
    const name = normalizeName($('names-fee-label').value), length = name.length - 5;
    if (!config) throw Error('Check availability to load pricing');
    const cents = length === 3 ? config.tariff.three_cents : length === 4 ? config.tariff.four_cents : config.tariff.standard_cents;
    const years = Number($('names-fee-years').value);
    $('names-fee-total').textContent = `$${(cents * years / 100).toLocaleString('en-US')} USD`;
    $('names-fee-annual').textContent = `$${cents / 100} per year · on-chain tariff v${config.tariff_version} · ${tokenLabel()}`;
  } catch (error) {
    $('names-fee-total').textContent = config ? 'Choose a valid name' : 'Check availability';
    $('names-fee-annual').textContent = '';
  }
}
window.addEventListener("neta:names-fee-refresh",fee);
function render() {
  let i = null, broken = false;
  try { i = intent(); } catch (error) { broken = true; message(error.message); }
  const open = broken || (i && i.phase !== 'complete'), pending = pendingPhases.includes(i?.phase);
  const connected = !!wallet(), ready = !!config, registration = $('nns-operation').value === 'register';
  const admin = mainnet() && ready && connected && config.admin === wallet();
  $('nns-admin').hidden = !admin;
  $('nns-admin-review').disabled = busy || !admin || !!open;
  $('nns-admin-review').textContent = config?.purchases_paused ? 'Review opening purchases' : 'Review pausing purchases';
  $('nns-admin-status').textContent = admin ? `Juno mainnet · purchases ${config.purchases_paused?'paused':'enabled'} · admin ${config.admin}` : '';
  $('nns-refresh').disabled = busy;
  $('nns-network').disabled = busy;
  $('nns-my-name').disabled = busy || !connected;
  for (const id of ['nns-edit-owned','nns-renew-owned']) $(id).disabled = busy || !!open || !window.NetaNamesAccount?.current();
  $('nns-check-name').disabled = busy;
  $('nns-reserve').disabled = busy || !connected || config?.purchases_paused === true || broken || (open && i?.phase !== 'prepared') || !registration;
  $('nns-reserve').hidden = !registration;
  $('nns-reserve').textContent = i?.phase === 'prepared' ? 'Continue registration' : 'Start registration';
  $('nns-payment').textContent = registration ? 'Buy name' : 'Renew name';
  $('nns-payment').disabled = busy || !connected || !ready || config.purchases_paused || (registration ? i?.phase !== 'committed' : !!open);
  for (const id of ['nns-publish-profile', 'nns-transfer']) $(id).disabled = busy || !connected || !ready || !!open;
  $('nns-load-profile').disabled = busy || !ready;
  $('nns-recover').disabled = busy || !pending;
  $('nns-cancel').disabled = busy || !['prepared', 'committed'].includes(i?.phase);
  $('nns-recovery').hidden = !open;
  $('nns-intent').textContent = i ? `${i.name} · ${i.phase}${i.payment_hash || i.commit_hash ? ' · ' + (i.payment_hash || i.commit_hash) : ''}` : broken ? 'Saved transaction cannot be read. Preserve browser data.' : '';
  for (const id of ['names-fee-label', 'names-fee-years', 'nns-operation']) $(id).disabled = busy || !!open;
  for (const node of document.querySelectorAll('#names-profile-form input, #names-profile-form textarea, #names-profile-form select, #names-profile-form button, #nns-transfer-form input, #nns-transfer-form select')) node.disabled = busy;
  // Publication has stricter ownership/session gates than the local preview.
  $('nns-publish-profile').disabled = busy || !connected || !ready || !!open;
  $('nns-load-profile').disabled = busy || !ready;
  $('nns-recovery-hash').disabled = busy;
  $('nns-confirm').disabled = busy || !review || !session;
  $('nns-discard').disabled = busy;
  $('nns-offer-fields').hidden = $('nns-transfer-action').value !== 'offer';
  fee();
}
async function run(fn) {
  if (busy) return;
  busy = true; render();
  const startEpoch = epoch, startVersion = formVersion;
  try { await fn(() => guard(startEpoch, startVersion)); }
  catch (error) { message(error.message); }
  finally { busy = false; render(); }
}
async function verify() {
  if (!reader) {
    const response = await fetch(manifests[chainId], {cache: 'no-store', signal: AbortSignal.timeout(12000)});
    if (!response.ok) throw Error(mainnet() ? 'Mainnet names are not open yet. The verified contract deployment is still being prepared.' : 'The reviewed UNI-7 deployment is unavailable.');
    const deployment=await response.json();
    if(deployment.chain_id!==chainId)throw Error('Selected network does not match the deployment.');
    reader = new NamesV2Reader({deployment});
  }
  config = null;
  const checked = await reader.verify();
  config = checked;
  $('nns-deployment-status').textContent = `${networkLabel()} verified · ${checked.purchases_paused ? 'purchases paused' : (mainnet()?'purchases enabled':'test purchases enabled')} · annual USD ${checked.tariff.three_cents / 100} / ${checked.tariff.four_cents / 100} / ${checked.tariff.standard_cents / 100} for 3 / 4 / 5+ characters.`;
  return checked;
}
function approvedTariff(checked) {
  if(mainnet())return; // Verified current on-chain tariffs are adjustable by the registry admin.
  if (!Object.keys(DEFAULT_TARIFF).every(key => checked.tariff[key] === DEFAULT_TARIFF[key])) throw Error('The approved USD 99 / 19 / 5 tariff is not active in this test registry yet. The admin must confirm it in the Names lab, then read the registry again.');
}
async function loadSigning() {
  if (window.NetaNamesSigning) return;
  if (!signingReady) signingReady = new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = 'assets/names-signing.js?v=5';
    script.onload = resolve; script.onerror = () => { script.remove(); signingReady = null; reject(Error('Names signing could not load. Try again.')); };
    document.head.append(script);
  });
  await signingReady;
}
async function connected(check) {
  const address = wallet();
  if (!address) throw Error('Connect Keplr using the shared header first.');
  if (!reader || !config) { await verify(); check(); }
  if (session?.owner === address) return session;
  await loadSigning(); check();
  const next = await connectNamesWallet({deployment: reader.deployment});
  try { check(); if (wallet() !== address || next.owner !== address) throw Error('Keplr account changed. Reconnect using the header.'); }
  catch (error) { next.disconnect(); throw error; }
  session?.disconnect(); session = next;
  const saved = intent();
  if (saved && ['prepared', 'commit_pending', 'committed', 'payment_pending'].includes(saved.phase)) {
    $('names-fee-label').value = saved.name.replace(/\.neta$/, '');
    $('names-fee-years').value = String(saved.years); $('nns-operation').value = 'register';
  }
  return session;
}
function showReview(text, action, check, confirmLabel = 'Confirm in Keplr') {
  check();
  const current = session, startEpoch = epoch, startVersion = formVersion;
  review = {action: async () => {
    guard(startEpoch, startVersion);
    if (session !== current || wallet() !== current.owner) throw Error('Wallet changed. Review again.');
    return action();
  }};
  $('nns-review-text').textContent = text;
  $('nns-confirm').textContent = confirmLabel;
  $('nns-review').hidden = false; $('nns-review-heading').focus();
}
function resetConnection() {
  epoch++; session?.disconnect(); session = null; clearReview();
  $('nns-owned').textContent = '';
  message(wallet() ? '' : 'Wallet disconnected. Saved transactions are preserved.');
  render();
}
window.addEventListener('neta:nns-account', render);
window.addEventListener('neta:wallet-change', resetConnection);
window.addEventListener('keplr_keystorechange', resetConnection);
window.addEventListener('storage', event => {
  if (event.key === null || event.key.startsWith('neta-nns-v2-intent:')) { formVersion++; clearReview(); render(); }
});
function route() {
  const active = document.body.dataset.workspaceView === 'relay' && ['register', 'profile'].includes(document.body.dataset.relayPanel);
  $('nns-workspace-session').hidden = !active;
  formVersion++; clearReview(); render();
}
window.addEventListener('neta:relay-panel', route);
window.addEventListener('hashchange', route);
$('nns-refresh').onclick = () => run(async check => {
  clearReview(); await verify(); check(); message(`${networkLabel()} registry ready. Use the shared header to connect Keplr.`);
});
$('nns-admin-review').onclick = () => run(async check => {
  clearReview();
  if(!mainnet())throw Error('Registry administration is available on Juno mainnet.');
  const current=await connected(check);
  const checked=await verify();check();
  const paused=!checked.purchases_paused;
  const prepared=await current.client.purchasePauseReview({owner:current.owner,paused});check();
  message('Review purchase availability below. No transaction has been sent.');
  const c=prepared.config,p=prepared.signedPrice?.snapshot;
  const rate=p?BigInt(p.usd_per_neta_12):0n;
  const price=p?`Verified price: USD ${rate/1000000000000n}.${(rate%1000000000000n).toString().padStart(12,'0')} per NETA\nObserved: ${new Date(p.observed_at*1000).toISOString()}\nPrice valid until: ${new Date(p.expires_at*1000).toISOString()}`:'Pausing does not require an available price feed.';
  showReview(`${paused?'Pause':'Open'} NNS purchases · Juno mainnet (juno-1)\nAdmin wallet: ${current.owner}\nRegistry: ${reader.deployment.registry}\nEffect: ${paused?'Disable':'Enable'} registrations and renewals for everyone.\nAnnual USD: ${c.tariff.three_cents/100} / ${c.tariff.four_cents/100} / ${c.tariff.standard_cents/100} · tariff version ${c.tariff_version}\nFee recipient: ${c.treasury}\n${price}\nReview expires: ${new Date(prepared.expires_at*1000).toISOString()}\nNETA debit: 0. Network fee only, shown in Keplr in JUNO.\n${JSON.stringify({set_purchases_paused:{paused}},null,2)}`,async()=>{
    const receipt=await current.client.setPurchasesPaused({owner:current.owner,reviewed:prepared});
    const observed=await verify();check();
    if(observed.purchases_paused!==paused)throw Error(`Transaction ${receipt.transactionHash} confirmed, but current purchase availability differs. Read the registry again; do not resend automatically.`);
    return `Purchases ${paused?'paused':'enabled'} on Juno mainnet · confirmed transaction ${receipt.transactionHash}. ${paused?'Registrations and renewals are paused.':'You can now register a name below.'}`;
  },check);
});
$('nns-my-name').onclick = () => run(async check => {
  clearReview(); const current = await connected(check);
  const result = await current.reader.nameOf(current.owner); check();
  if (result?.address !== current.owner || (result.name !== null && typeof result.name !== 'string')) throw Error('Name ownership is unavailable.');
  $('nns-owned').textContent = result.name ? `Your active ${networkLabel()} name: ${result.name}` : `This wallet has no active ${networkLabel()} name.`;
  if (result.name) {
    const record = await current.reader.identity(result.name); check();
    if (record.owner !== current.owner || record.name !== result.name) throw Error('Name ownership changed. Reload it.');
    $('nns-owned').textContent += ` · expires ${new Date(record.expires_at * 1000).toLocaleString()}`;
    $('names-profile-name').value = result.name; $('nns-transfer-name').value = result.name;
    if (!intent() || intent().phase === 'complete') { $('names-fee-label').value = result.name.replace(/\.neta$/, ''); $('nns-operation').value = 'renew'; }
  }
  message('Current name read. No transaction was sent.');
});
// Shortcuts fill the existing forms; publication/payment still needs its own review.
function manageOwned(action) {
  return run(async check => {
    clearReview();
    const owned = window.NetaNamesAccount?.current();
    if (!owned) throw Error('Reload your current name first.');
    const current = await connected(check); check();
    const saved = intent();
    if (saved && saved.phase !== 'complete') throw Error('Finish or reconcile the saved transaction before switching forms.');
    const record = await current.reader.identity(owned.name); check();
    if (record?.name !== owned.name || record.owner !== current.owner ||
        record.generation !== owned.generation || record.ownership_revision !== owned.ownership_revision ||
        record.expires_at <= now()) throw Error('Name ownership changed. Retry the name lookup.');
    let contacts;
    if (action === 'profile') {
      const result = await current.reader.profile(owned.name); check();
      if (!result?.active || result.profile?.identity.name !== owned.name ||
          result.profile.identity.owner !== current.owner ||
          result.profile.identity.generation !== record.generation ||
          result.profile.identity.ownership_revision !== record.ownership_revision) throw Error('The current profile is unavailable.');
      contacts = normalizeContacts(result.profile.contacts);
    }
    document.querySelector('[data-relay-panel="' + (action === 'profile' ? 'profile' : 'register') + '"]').click();
    $('names-profile-name').value = owned.name;
    $('nns-transfer-name').value = owned.name;
    if (action === 'profile') {
      for (const field of CONTACT_FIELDS) $('names-profile-form').elements[field].value = contacts[field];
      $('names-profile-preview').hidden = true;
      $('names-profile-bio').focus();
      message('Edit your profile below. Changes are published only after your confirmation.');
    } else {
      $('names-fee-label').value = owned.name.replace(/\.neta$/, '');
      $('nns-operation').value = 'renew';
      $('names-fee-label').dispatchEvent(new Event('input', {bubbles: true}));
      $('names-fee-years').focus();
      message('Choose the renewal term below, then review the payment.');
    }
    formVersion++; clearReview();
  });
}
$('nns-edit-owned').onclick = () => manageOwned('profile');
$('nns-renew-owned').onclick = () => manageOwned('renew');
$('nns-check-name').onclick = () => run(async check => {
  clearReview(); const name = normalizeName($('names-fee-label').value);
  await verify(); check();
  const result = await reader.resolve(name); check();
  if (result?.name !== name || typeof result.available !== 'boolean' || typeof result.active !== 'boolean' || typeof result.in_grace !== 'boolean') throw Error('Name availability is unavailable.');
  $('nns-name-result').textContent = result.available ? `${name} is available on ${networkLabel()}. It is not reserved yet.` : result.active ? `${name} is registered on ${networkLabel()} · expires ${new Date(result.expires_at * 1000).toLocaleString()}.` : `${name} is in its renewal grace period.`;
});
$('nns-reserve').onclick = () => run(async check => {
  clearReview(); const current = await connected(check);
  approvedTariff(await verify()); check();
  let saved = intent();
  if (!saved || saved.phase === 'complete') {
    saved = await current.client.prepareRegistration({owner: current.owner, name: $('names-fee-label').value, years: Number($('names-fee-years').value)}); check();
  }
  if (saved.phase !== 'prepared') throw Error('Finish or reconcile the saved registration first.');
  message('Check the registration details below. No transaction has been sent.');
  showReview(`Start registration · ${saved.name}\nOwner: ${current.owner}\nTerm: ${saved.years} year(s)\n${networkLabel()} network fee only; no ${tokenLabel()} payment yet.\nAfter confirmation, complete the purchase within 1 hour. This step does not exclusively reserve the name. Only a successful purchase secures it.\nKeep this browser for the purchase; it stores your registration secret.`, async () => {
    await current.client.commit(current.owner);
    const commitment = await current.reader.commitment(current.owner);
    const deadline = commitment?.hash === saved.hash && Number.isSafeInteger(commitment.expires_at) ? ` by ${new Date(commitment.expires_at * 1000).toLocaleString()}` : ' within 1 hour of confirmation';
    return `Registration started for ${saved.name}. Choose Buy name and complete the purchase${deadline}. The name is not exclusively reserved.`;
  }, check, 'Start registration in Keplr');
});
$('nns-payment').onclick = () => run(async check => {
  clearReview(); const operation = $('nns-operation').value, name = normalizeName($('names-fee-label').value), years = Number($('names-fee-years').value);
  const current = await connected(check); const checked = await verify(); approvedTariff(checked); check();
  let deadline = '', purchaseDeadline = null;
  if (operation === 'register') {
    const saved = intent(), commitment = await current.reader.commitment(current.owner); check();
    if (saved?.phase !== 'committed' || commitment?.hash !== saved.hash || !Number.isSafeInteger(commitment.expires_at)) throw Error('Registration confirmation is unavailable. Check the saved transaction before purchasing.');
    if (now() >= commitment.expires_at) throw Error('The 1-hour registration window expired. Cancel the saved registration before starting again.');
    purchaseDeadline = commitment.expires_at;
    deadline = `\nComplete purchase before: ${new Date(commitment.expires_at * 1000).toLocaleString()}\nThe name is not exclusively reserved.`;
  }
  const offer = mainnet() ? await current.client.snapshotQuote({operation,payer:current.owner,name,years}) : await createTestQuote({reader: current.reader, request: {operation, payer: current.owner, name, years}}); check();
  if (operation === 'register') await current.client.registrationQuote(current.owner, async () => offer);
  else {
    const record = await current.reader.identity(name);
    await validateQuote({deployment: reader.deployment, config: checked, offer, expected: {operation, payer: current.owner, owner: record.owner, name, generation: record.generation, ownership_revision: record.ownership_revision, expected_expires_at: record.expires_at, years}, now: now()});
  }
  const q = offer.quote;
  showReview(`${operation === 'register' ? 'Buy' : 'Renew'} ${q.name}\nTerm: ${q.years} year(s)\nPayer: ${q.payer}\nOwner: ${q.owner}\n${mainnet()?snapshotReview(offer):`Exact debit: ${micro(q.amount)} mock NETA\nQuote expires: ${new Date(q.expires_at * 1000).toLocaleString()}\nFictional USD 2 per mock NETA`}\nTreasury: ${reader.deployment.treasury}\nNetwork: ${networkLabel()}${deadline}\nConfirming in Keplr authorizes this ${tokenLabel()} payment.`, async () => {
    if (operation === 'register') {
      if (now() >= purchaseDeadline) throw Error('The 1-hour registration window expired. Cancel the saved registration before starting again.');
      await current.client.register(current.owner, offer);
    }
    else await current.client.renew({payer: current.owner, name, years, reviewedOffer: offer});
    return `${operation === 'register' ? 'Purchase' : 'Renewal'} confirmed · ${q.name} · ${micro(q.amount)} ${tokenLabel()} · ${q.years} year(s). Your name summary will refresh automatically.`;
  }, check, operation === 'register' ? 'Buy and confirm in Keplr' : 'Renew and confirm in Keplr');
});
$('nns-transfer-form').onsubmit = event => {
  event.preventDefault();
  const nameInput = $('nns-transfer-name').value, action = $('nns-transfer-action').value, recipientInput = $('nns-recipient').value, hours = Number($('nns-hours').value);
  run(async check => {
    clearReview(); const current = await connected(check), name = normalizeName(nameInput), record = await current.reader.identity(name); check();
    let args = {owner: current.owner, name, action}, detail;
    if (action === 'offer') {
      const recipient = validateJunoAddress(recipientInput.trim());
      if (!Number.isInteger(hours) || hours < 1 || hours > 168) throw Error('Choose 1–168 hours.');
      if (record.owner !== current.owner) throw Error('Only the current owner can offer this name.');
      args = {...args, recipient, expiresAt: Math.min(now() + hours * 3600, record.expires_at)};
      detail = `Recipient: ${recipient}\nOffer expires: ${new Date(args.expiresAt * 1000).toLocaleString()}`;
    } else {
      const offer = await current.reader.transferOffer(name); check();
      if (!offer) throw Error('No active transfer offer.');
      if (action === 'accept' ? offer.recipient !== current.owner : offer.owner !== current.owner) throw Error('This wallet cannot perform that transfer action.');
      args.offerId = offer.id; detail = `Offer ID: ${offer.id}\nCurrent owner: ${offer.owner}\nRecipient: ${offer.recipient}`;
    }
    showReview(`${action.toUpperCase()} transfer · ${name}\n${detail}\nExpiry is preserved. The old profile and proofs do not transfer.\n${networkLabel()} network fee only.`, () => current.client.transfer(args), check);
  });
};
$('nns-load-profile').onclick = () => run(async check => {
  clearReview(); const name = normalizeName($('names-profile-name').value);
  const result = await reader.profile(name); check();
  if (!result?.active || result.profile?.identity.name !== name) throw Error('No active profile for this name.');
  const contacts = normalizeContacts(result.profile.contacts);
  for (const field of CONTACT_FIELDS) $('names-profile-form').elements[field].value = contacts[field];
  $('names-profile-preview').hidden = true;
  message(`Loaded ${name} · profile revision ${result.profile.revision}. Review your edits before publishing.`);
});
$('nns-publish-profile').onclick = () => {
  const nameInput = $('names-profile-name').value, fields = Object.fromEntries(new FormData($('names-profile-form')));
  run(async check => {
    clearReview(); const name = normalizeName(nameInput), contacts = normalizeContacts(fields), current = await connected(check);
    const result = await current.reader.profile(name); check();
    if (!result?.active || result.profile?.identity.owner !== current.owner || result.profile.identity.name !== name) throw Error('This wallet must own the active name.');
    const expectedRevision = result.profile.revision;
    showReview(`Publish public contacts · ${name}\nProfile revision: ${expectedRevision}\n${JSON.stringify(contacts, null, 2)}\nThese fields will be public on ${networkLabel()}. Validator addresses are not included.`, () => current.client.updateProfile({owner: current.owner, name, contacts, expectedRevision}), check);
  });
};
$('nns-recover').onclick = () => run(async check => {
  clearReview(); const current = await connected(check), result = await current.recover($('nns-recovery-hash').value.trim().toUpperCase()); check();
  if(result.intent.action==='set-purchases-paused'&&result.result.notBroadcast!==true&&result.result.code===0){
    const observed=await verify();check();
    const expected=result.intent.payment.msg.set_purchases_paused.paused;
    message(`Exact administration transaction confirmed. Current purchases: ${observed.purchases_paused?'paused':'enabled'}.${observed.purchases_paused!==expected?' State differs from that transaction; review current configuration.':''} Nothing was resent.`);return;
  }
  message(result.result.notBroadcast ? 'No broadcast was made. Review another attempt separately.' : result.result.code === 0 ? 'Exact transaction confirmed. Nothing was resent.' : `Transaction failed on-chain (${result.result.code}). Nothing was resent; network fees may have been charged.`);
});
$('nns-cancel').onclick = () => run(async check => {
  clearReview(); const current = await connected(check), saved = intent();
  if (!['prepared', 'committed'].includes(saved?.phase)) throw Error('Check the pending transaction first.');
  showReview(`Cancel registration · ${saved.name}\nA confirmed reservation needs a separate ${networkLabel()} cancellation transaction and network fee. An unsubmitted preparation is discarded locally.`, () => current.client.cancelRegistration(current.owner), check);
});
$('nns-confirm').onclick = () => run(async () => {
  const accepted = review; clearReview();
  if (!accepted) throw Error('Review an action first.');
  const result=await accepted.action();
  window.dispatchEvent(new Event('neta:nns-updated'));
  message(typeof result==='string'?result:`Action completed on ${networkLabel()}. Your name summary refreshes automatically; use Load current profile to refresh contact fields.`);
});
$('nns-discard').onclick = () => { clearReview(); render(); };
for (const id of ['names-fee-form', 'names-profile-form', 'nns-transfer-form']) {
  for (const event of ['input', 'change', 'reset']) $(id).addEventListener(event, () => { formVersion++; clearReview(); $('nns-name-result').textContent = ''; render(); if (event === 'reset') queueMicrotask(render); });
}
function networkCopy() {
  $('nns-network-badge').textContent=mainnet()?'JUNO MAINNET · NETA':'UNI-7 · TEST NAMES';
  $('nns-network-help').textContent=mainnet()?'Register and manage a name on Juno. Purchase availability is controlled by the registry administrator.':'Register and manage a test name with mock NETA.';
  $('nns-review-network').textContent=`${networkLabel()}. Network fees are shown in Keplr in ${mainnet()?'JUNO':'JUNOX'}.`;
  $('nns-cost-title').textContent=mainnet()?'Registration cost':'Test registration cost';
  $('nns-payment-token').textContent=`${tokenLabel()} · ${networkLabel()}`;
  $('nns-price-help').textContent=mainnet()?'Paid in NETA using the Treasury price, updated about every 30 minutes. Prices may differ from the market. The exact amount and price timestamp appear before payment. Network fees are separate.':'Test quotes use a fictional USD 2 per mock NETA. Payment quotes require the original setup browser. Network fees are separate.';
  $('nns-operation').options[0].textContent=mainnet()?'Register a name':'Register a test name';
  $('nns-operation').options[1].textContent=mainnet()?'Renew a name':'Renew a test name';
  $('nns-deployment-status').textContent='Check availability to load current pricing and purchase status.';
}
$('nns-network').onchange=()=>{
  if(busy){$('nns-network').value=chainId;return;}
  chainId=$('nns-network').value;
  try {localStorage.setItem('neta-nns-network',chainId);}catch{}
  config=null;reader=null;resetConnection();networkCopy();
  $('nns-name-result').textContent='';$('nns-owned').textContent='';$('names-profile-preview').hidden=true;
  window.dispatchEvent(new Event('neta:nns-network'));
};
networkCopy();route();

// Notification links select a network/name/menu only. They never connect or sign.
const nameLink = new URLSearchParams(location.search);
if (nameLink.has('nns-name')) {
  try {
    const name = normalizeName(nameLink.get('nns-name')), selected = nameLink.get('nns-network');
    if (!Object.hasOwn(manifests, selected)) throw Error('Unknown name-link network.');
    chainId = selected; $('nns-network').value = selected;
    config = null; reader = null; resetConnection(); networkCopy();
    $('names-fee-label').value = name.replace(/\.neta$/, '');
    $('names-profile-name').value = name;
    if (nameLink.get('nns-action') === 'renew') $('nns-operation').value = 'renew';
    window.dispatchEvent(new Event('neta:nns-network'));
    run(async check => { await verify(); check(); message('Name details loaded. Connect Keplr to manage this name.'); });
  } catch(error) { message(error.message); }
}
