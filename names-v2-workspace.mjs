import {snapshotReview} from './names/snapshot-client.mjs';
import {NamesV2Reader} from './names-v2-reader.mjs?v=5';
import {connectNamesWallet} from './names-v2-wallet.mjs?v=6';
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
    if (!config) throw Error('Read the registry');
    const cents = length === 3 ? config.tariff.three_cents : length === 4 ? config.tariff.four_cents : config.tariff.standard_cents;
    const years = Number($('names-fee-years').value);
    $('names-fee-total').textContent = `$${(cents * years / 100).toLocaleString('en-US')} USD`;
    $('names-fee-annual').textContent = `$${cents / 100} per year · on-chain tariff v${config.tariff_version} · ${tokenLabel()}`;
  } catch (error) {
    $('names-fee-total').textContent = config ? 'Choose a valid name' : 'Read registry';
    $('names-fee-annual').textContent = '';
  }
}
window.addEventListener("neta:names-fee-refresh",fee);
function render() {
  let i = null, broken = false;
  try { i = intent(); } catch (error) { broken = true; message(error.message); }
  const open = broken || (i && i.phase !== 'complete'), pending = pendingPhases.includes(i?.phase);
  const connected = !!wallet(), ready = !!config, registration = $('nns-operation').value === 'register';
  $('nns-refresh').disabled = busy;
  $('nns-network').disabled = busy;
  $('nns-my-name').disabled = busy || !connected || !ready;
  $('nns-check-name').disabled = busy || !ready;
  $('nns-prepare').disabled = busy || !connected || !ready || config.purchases_paused || !!open || !registration;
  $('nns-reserve').disabled = busy || !session || config?.purchases_paused!==false || i?.phase !== 'prepared';
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
    const script = document.createElement('script'); script.src = 'assets/names-signing.js?v=4';
    script.onload = resolve; script.onerror = () => { script.remove(); signingReady = null; reject(Error('Names signing could not load. Try again.')); };
    document.head.append(script);
  });
  await signingReady;
}
async function connected(check) {
  const address = wallet();
  if (!address) throw Error('Connect Keplr using the shared header first.');
  if (!reader || !config) throw Error('Read the selected registry first.');
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
function showReview(text, action, check) {
  check();
  const current = session, startEpoch = epoch, startVersion = formVersion;
  review = {action: async () => {
    guard(startEpoch, startVersion);
    if (session !== current || wallet() !== current.owner) throw Error('Wallet changed. Review again.');
    await action();
  }};
  $('nns-review-text').textContent = text;
  $('nns-review').hidden = false; $('nns-review-heading').focus();
}
function resetConnection() {
  epoch++; session?.disconnect(); session = null; clearReview();
  $('nns-owned').textContent = '';
  message(wallet() ? 'Wallet connected. Load your name or choose an action.' : 'Wallet disconnected. Saved transactions are preserved.');
  render();
}
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
$('nns-check-name').onclick = () => run(async check => {
  clearReview(); const name = normalizeName($('names-fee-label').value);
  const result = await reader.resolve(name); check();
  if (result?.name !== name || typeof result.available !== 'boolean' || typeof result.active !== 'boolean' || typeof result.in_grace !== 'boolean') throw Error('Name availability is unavailable.');
  $('nns-name-result').textContent = result.available ? `${name} is available on ${networkLabel()}. It is not reserved yet.` : result.active ? `${name} is registered on ${networkLabel()} · expires ${new Date(result.expires_at * 1000).toLocaleString()}.` : `${name} is in its renewal grace period.`;
});
$('nns-prepare').onclick = () => run(async check => {
  clearReview(); const args = {name: $('names-fee-label').value, years: Number($('names-fee-years').value)};
  const current = await connected(check); approvedTariff(await verify()); check();
  await current.client.prepareRegistration({owner: current.owner, ...args}); check();
  message('Registration prepared locally. Review the reservation, then review payment separately.');
});
$('nns-reserve').onclick = () => run(async check => {
  clearReview(); const current = await connected(check), saved = intent();
  if (saved?.phase !== 'prepared') throw Error('Prepare the registration first.');
  showReview(`Reserve ${saved.name}\nOwner: ${current.owner}\nTerm: ${saved.years} year(s)\n${networkLabel()} network fee only; no ${tokenLabel()} payment yet.\nThe reservation secret stays in this browser.`, async () => { await current.client.commit(current.owner); }, check);
});
$('nns-payment').onclick = () => run(async check => {
  clearReview(); const operation = $('nns-operation').value, name = normalizeName($('names-fee-label').value), years = Number($('names-fee-years').value);
  const current = await connected(check); const checked = await verify(); approvedTariff(checked); check();
  const offer = mainnet() ? await current.client.snapshotQuote({operation,payer:current.owner,name,years}) : await createTestQuote({reader: current.reader, request: {operation, payer: current.owner, name, years}}); check();
  if (operation === 'register') await current.client.registrationQuote(current.owner, async () => offer);
  else {
    const record = await current.reader.identity(name);
    await validateQuote({deployment: reader.deployment, config: checked, offer, expected: {operation, payer: current.owner, owner: record.owner, name, generation: record.generation, ownership_revision: record.ownership_revision, expected_expires_at: record.expires_at, years}, now: now()});
  }
  const q = offer.quote;
  showReview(`${operation === 'register' ? 'Register' : 'Renew'} ${q.name}\nTerm: ${q.years} year(s)\nPayer: ${q.payer}\nOwner: ${q.owner}\n${mainnet()?snapshotReview(offer):`Exact debit: ${micro(q.amount)} mock NETA\nQuote expires: ${new Date(q.expires_at * 1000).toLocaleString()}\nFictional USD 2 per mock NETA`}\nTreasury: ${reader.deployment.treasury}\nNetwork: ${networkLabel()}`, async () => {
    if (operation === 'register') await current.client.register(current.owner, offer);
    else await current.client.renew({payer: current.owner, name, years, reviewedOffer: offer});
  }, check);
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
  await accepted.action();
  message(`Action completed on ${networkLabel()}. Use Load my name or Load current profile to refresh the result.`);
});
$('nns-discard').onclick = () => { clearReview(); render(); };
for (const id of ['names-fee-form', 'names-profile-form', 'nns-transfer-form']) {
  for (const event of ['input', 'change', 'reset']) $(id).addEventListener(event, () => { formVersion++; clearReview(); $('nns-name-result').textContent = ''; render(); if (event === 'reset') queueMicrotask(render); });
}
function networkCopy() {
  $('nns-network-badge').textContent=mainnet()?'JUNO MAINNET · NETA':'UNI-7 · TEST NAMES';
  $('nns-network-help').textContent=mainnet()?'Register and manage a name on Juno. Purchases open after contract and DAO activation.':'Register and manage a test name with mock NETA.';
  $('nns-review-network').textContent=`${networkLabel()}. Network fees are shown in Keplr in ${mainnet()?'JUNO':'JUNOX'}.`;
  $('nns-cost-title').textContent=mainnet()?'Registration cost':'Test registration cost';
  $('nns-payment-token').textContent=`${tokenLabel()} · ${networkLabel()}`;
  $('nns-price-help').textContent=mainnet()?'Paid in NETA using the Treasury price, updated about every 30 minutes. Prices may differ from the market. The exact amount and price timestamp appear before payment. Network fees are separate.':'Test quotes use a fictional USD 2 per mock NETA. Payment quotes require the original setup browser. Network fees are separate.';
  $('nns-operation').options[0].textContent=mainnet()?'Register a name':'Register a test name';
  $('nns-operation').options[1].textContent=mainnet()?'Renew a name':'Renew a test name';
  $('nns-deployment-status').textContent='Read the selected registry to check availability and activation.';
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
