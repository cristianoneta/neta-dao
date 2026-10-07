import {verifiedPersonalRelease} from './relay-personal-release.mjs';
import {connectPersonalBrowser} from './relay-personal-session.mjs';
import {mountPersonalInbox} from './relay-personal-inbox.mjs';

let signingReady;
export async function loadPersonalSigning(doc = document) {
  if (globalThis.NetaNamesSigning?.createBridge) return globalThis.NetaNamesSigning;
  signingReady ||= new Promise((resolve, reject) => {
    const script = doc.createElement('script');
    script.src = 'assets/names-signing.js?v=20261006-personal-2';
    script.onload = () => resolve();
    script.onerror = () => {script.remove(); signingReady = null; reject(Error('Wallet support could not load. Try again.'));};
    doc.head.append(script);
  });
  await signingReady;
  if (!globalThis.NetaNamesSigning?.createBridge) throw Error('Wallet support is unavailable. Reload this page.');
  return globalThis.NetaNamesSigning;
}

export function mountPersonalWorkspace({root, release, connect = connectPersonalBrowser,
  wallet = () => globalThis.NetaWorkspaceWallet?.getSession(), loadSigning = loadPersonalSigning,
  mountInbox = mountPersonalInbox} = {}) {
  if (!root) throw Error('Personal workspace root required');
  const doc = root.ownerDocument, win = doc.defaultView;
  const composer = doc.getElementById('relay-composer'), compose = doc.getElementById('relay-new-message');
  const make = (tag, text) => {const e = doc.createElement(tag); e.textContent = text; return e;};
  let config, session = null, ui = null, epoch = 0, connecting = false, disposed = false;
  let closing = Promise.resolve();
  // No wallet access, provider request or crypto runtime is created by the disabled release.
  try {config = verifiedPersonalRelease(release);} catch {config = null;}
  if (!config) {root.hidden = true; return {dispose() {root.replaceChildren();}};}
  root.hidden = false;
  root.classList.add('personal-workspace');
  const status = make('p', ''), open = make('button', 'Open personal inbox'), content = make('div', '');
  status.setAttribute('role', 'status'); open.type = 'button';
  root.replaceChildren(status, open, content);
  composer.hidden = true;
  composer.dataset.personalActive = 'true';
  compose.setAttribute('aria-controls', root.id);
  compose.querySelector('small').textContent = 'ENCRYPTED PERSONAL INBOX';
  const active = () => doc.body.dataset.workspaceView === 'relay' && doc.body.dataset.relayPanel === 'inbox';
  const current = () => wallet() || {};
  function render(text) {
    if (disposed) return;
    const account = current();
    open.hidden = !!session;
    open.disabled = connecting || !active() || !account.address || account.chainId !== 'juno-1';
    status.textContent = text || (connecting ? 'Opening your personal inbox…' : session ? 'Personal inbox · Juno mainnet' :
      !account.address ? 'Connect Keplr in the header to open your personal inbox.' : account.chainId !== 'juno-1' ?
      'Reconnect Keplr in the header for Juno mainnet.' : 'Open your inbox to unlock this browser or restore an encrypted backup.');
  }
  function invalidate() {
    epoch++; connecting = false;
    // Invalidate synchronously: shared Disconnect must work even when Keplr still
    // exposes the same account, or a signature/network call has not returned.
    session?.controller.invalidate(); ui?.dispose(); ui = null;
    const previous = session; session = null; content.replaceChildren();
    if (previous) closing = closing.then(() => previous.disconnect()).catch(() => {});
    render();
  }
  async function begin() {
    if (disposed || connecting || !active()) return;
    if (session) {content.querySelector('input:not([hidden]),button:not([hidden])')?.focus(); return;}
    const owner = current().address;
    if (!owner || current().chainId !== 'juno-1') {render(); return;}
    const ticket = ++epoch;
    const assertCurrent = () => {
      if (disposed || ticket !== epoch || !active() || current().address !== owner || current().chainId !== 'juno-1')
        throw Error('Wallet or Inbox changed. Open your personal inbox again.');
    };
    connecting = true; render();
    let candidate, failure;
    try {
      await closing; assertCurrent();
      const bundle = await loadSigning(doc); assertCurrent();
      candidate = await connect({...config, owner, bundle, assertCurrent}); assertCurrent();
      session = candidate;
      ui = mountInbox({root: content, controller: session.controller, authorizeBackup: session.authorizeBackup});
      content.querySelector('input')?.focus();
    } catch (error) {
      if (candidate && candidate !== session) await candidate.disconnect();
      failure = error.message;
    } finally {if (ticket === epoch) {connecting = false; render(failure);}}
  }
  function onWallet() {invalidate();}
  function onNavigation() {if (!active()) invalidate(); else render();}
  function onCompose(event) {event.preventDefault(); void begin();}
  open.onclick = () => void begin(); compose.addEventListener('click', onCompose);
  win.addEventListener('neta:wallet-change', onWallet);
  win.addEventListener('keplr_keystorechange', onWallet);
  win.addEventListener('neta:relay-panel', onNavigation);
  win.addEventListener('hashchange', onNavigation);
  win.addEventListener('pagehide', onWallet);
  render();
  return {dispose() {
    invalidate(); disposed = true; root.replaceChildren(); root.hidden = true;
    delete composer.dataset.personalActive;
    compose.setAttribute('aria-controls', composer.id);
    compose.querySelector('small').textContent = 'PREVIEW · SEND DISABLED';
    compose.removeEventListener('click', onCompose);
    win.removeEventListener('neta:wallet-change', onWallet); win.removeEventListener('keplr_keystorechange', onWallet);
    win.removeEventListener('neta:relay-panel', onNavigation); win.removeEventListener('hashchange', onNavigation);
    win.removeEventListener('pagehide', onWallet);
  }};
}
