import {connectPersonalBrowser} from './relay-personal-session.mjs';
import {mountPersonalInbox} from './relay-personal-inbox.mjs';
import {PERSONAL_MAINNET_OWNER, PERSONAL_MAINNET_WASM, personalMainnetProfile} from './relay-personal-network.mjs';

// This separate, deliberately published pilot never changes the public release.
// The server independently enforces wallet signatures and its matching allowlist.
export const PERSONAL_PILOT = Object.freeze({
  deployment: Object.freeze({chainId:'juno-1',codeId:5170,
    contract:'juno1dvmms7su8zfqu4gxxmrkqhzpxr5v3sh8hzfxe8ypsgfegc22lggq5jfjx6',
    creator:PERSONAL_MAINNET_OWNER,admin:PERSONAL_MAINNET_OWNER,codeHash:PERSONAL_MAINNET_WASM,
    label:'NETA RELAY personal v0.4 · Juno mainnet'}),
  backupUrl:'https://api.cosmoot.com',
  wallets:Object.freeze([PERSONAL_MAINNET_OWNER,'juno12jc8ekvrvml9jtk5pvl4tpddj5pep5m5hd8aqt'])
});

export function assertPilotWallet(address){
  personalMainnetProfile(PERSONAL_PILOT.deployment);
  if(!PERSONAL_PILOT.wallets.includes(address))throw Error('This private pilot is limited to its two participating wallets.');
}

export function mountPersonalPilot({document=globalThis.document,keplr=globalThis.keplr,
  bundle=globalThis.NetaNamesSigning,connect=connectPersonalBrowser,mountInbox=mountPersonalInbox}={}){
  const win=document.defaultView,button=document.getElementById('pilot-connect'),
    disconnect=document.getElementById('pilot-disconnect'),wallet=document.getElementById('pilot-wallet'),
    status=document.getElementById('pilot-status'),root=document.getElementById('pilot-inbox');
  let epoch=0,pending=false,session=null,ui=null,closing=Promise.resolve(),disposed=false;
  const initial='Connect one of the two participating wallets. Connecting does not sign a transaction.';
  function reset(message=initial){
    epoch++;pending=false;
    session?.controller.invalidate();ui?.dispose();ui=null;
    const old=session;session=null;
    if(old)closing=closing.then(()=>old.disconnect()).catch(()=>{});
    root.replaceChildren();root.hidden=true;wallet.textContent='';
    button.textContent='Connect Keplr';button.removeAttribute('title');button.removeAttribute('aria-label');
    button.disabled=false;disconnect.hidden=true;status.textContent=message;
  }
  async function begin(){
    if(disposed||pending||session)return;
    const ticket=++epoch;pending=true;button.disabled=true;disconnect.hidden=false;
    status.textContent='Connecting Keplr · Juno mainnet…';
    let candidate;
    const current=()=>{if(disposed||ticket!==epoch)throw Error('Wallet connection changed. Connect again.');};
    try{
      if(!keplr?.enable||!keplr?.getOfflineSigner)throw Error('Open this page in a browser with Keplr installed.');
      if(!bundle?.createBridge)throw Error('Wallet support did not load. Reload this page.');
      await closing;current();await keplr.enable('juno-1');current();
      const owner=(await keplr.getOfflineSigner('juno-1').getAccounts())[0]?.address;current();
      assertPilotWallet(owner);
      wallet.textContent=owner;status.textContent='Checking the deployed mailbox and Juno network…';
      candidate=await connect({deployment:PERSONAL_PILOT.deployment,backupUrl:PERSONAL_PILOT.backupUrl,
        owner,keplr,bundle,assertCurrent:current});current();
      session=candidate;root.hidden=false;
      ui=mountInbox({root,controller:session.controller,authorizeBackup:session.authorizeBackup});
      button.textContent=owner.slice(0,9)+'…'+owner.slice(-6);button.title=owner;
      button.setAttribute('aria-label','Connected wallet '+owner);
      status.textContent='Connected · Juno mainnet. Continue below to authorize your encrypted backup.';
    }catch(error){
      if(candidate&&candidate!==session)await candidate.disconnect();
      if(ticket===epoch)reset(error.message);
    }finally{if(ticket===epoch){pending=false;button.disabled=!!session;}}
  }
  const changed=()=>reset('Wallet changed. Connect again; saved keys and pending actions are preserved.');
  const leave=()=>reset();
  button.onclick=()=>void begin();disconnect.onclick=()=>reset();
  win.addEventListener('keplr_keystorechange',changed);win.addEventListener('pagehide',leave);
  reset();
  return {dispose(){reset();disposed=true;button.onclick=null;disconnect.onclick=null;
    win.removeEventListener('keplr_keystorechange',changed);win.removeEventListener('pagehide',leave);}};
}
