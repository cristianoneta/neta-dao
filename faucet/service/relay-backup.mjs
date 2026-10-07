import {resolve} from 'node:path';
import {mkdir} from 'node:fs/promises';

// Sharing this process is an owner-approved pilot compromise, not a sandbox.
// The backup module receives no faucet adapter, mnemonic or environment group.
export async function openRelayBackup(env=process.env){
  if(!['true','false',undefined].includes(env.RELAY_BACKUP_ENABLED))throw Error('Invalid RELAY enable flag');
  if(env.RELAY_BACKUP_ENABLED!=='true')return null;
  const directory=resolve(env.RELAY_BACKUP_DIRECTORY||'/var/data/relay-backup');
  const file=resolve(directory,'relay-backup.sqlite');
  const faucetFile=resolve(env.FAUCET_DB||'/data/faucet.sqlite');
  if(file===faucetFile)throw Error('RELAY must not use the faucet database');
  const {backupServer}=await import('../../relay-backup/server.mjs');
  const {BackupStore}=await import('../../relay-backup/store.mjs');
  // Validate admission/origin configuration before creating persistent data.
  const config={origin:env.RELAY_WEB_ORIGIN||env.FAUCET_WEB_ORIGIN,
    domain:env.RELAY_BACKUP_ORIGIN||env.FAUCET_PUBLIC_ORIGIN||env.RENDER_EXTERNAL_URL,
    chain:'juno-1',contract:env.RELAY_MAILBOX_CONTRACT,
    allowedWallets:(env.RELAY_BACKUP_WALLETS||'').split(',').map(s=>s.trim()).filter(Boolean)};
  backupServer({...config,store:null});
  await mkdir(directory,{recursive:true,mode:0o700});
  const store=new BackupStore(file);
  try{return {server:backupServer({...config,store}),close:()=>store.close(),file};}
  catch(error){store.close();throw error;}
}
