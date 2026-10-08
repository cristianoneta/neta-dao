const connect=document.querySelector('#connect-wallet');
const disconnect=document.querySelector('#disconnect-wallet');
const note=document.querySelector('#wallet-note');
let revision=0;
function clear(){
  revision++;window.NETA_WALLET_STATE=null;connect.textContent='Connect Keplr';
  connect.disabled=false;disconnect.hidden=true;note.textContent='Connect to check your balance and review a swap.';
  dispatchEvent(new Event('neta:wallet-disconnected'));
}
connect.addEventListener('click',async()=>{
  const attempt=++revision;connect.disabled=true;note.textContent='Connecting to Keplr…';
  try{
    if(!window.keplr)throw Error('Open this page in a browser with Keplr installed.');
    await window.keplr.enable('juno-1');
    const signer=await window.keplr.getOfflineSignerAuto('juno-1');
    const accounts=await signer.getAccounts(),key=await window.keplr.getKey('juno-1');
    if(attempt!==revision)return;
    if(accounts.length!==1||accounts[0].address!==key.bech32Address||!/^juno1[0-9a-z]{38}$/.test(key.bech32Address))throw Error('A matching Juno account is required.');
    window.NETA_WALLET_STATE={address:key.bech32Address,signer};
    connect.textContent=key.bech32Address.slice(0,9)+'…'+key.bech32Address.slice(-5);
    disconnect.hidden=false;note.textContent='Connected on Juno mainnet. Purchases require a separate review and wallet confirmation.';
    dispatchEvent(new Event('neta:wallet-connected'));
  }catch(error){if(attempt===revision){clear();note.textContent=error.message;}}
  finally{if(attempt===revision)connect.disabled=false;}
});
disconnect.addEventListener('click',clear);
addEventListener('keplr_keystorechange',clear);
addEventListener('pagehide',clear);
