// Isolated loopback-only process for the synthetic operator drill. No faucet or chain.
import { BackupStore } from '../store.mjs';
import { backupServer } from '../server.mjs';

if (!process.send) throw Error('This worker requires its drill parent');
process.umask(0o077);
const [file, wallet, contract] = process.argv.slice(2);
const store = new BackupStore(file);
const server = backupServer({ store, origin: 'https://drill.example',
  domain: 'https://backup.drill.example', chain: 'juno-1', contract,
  allowedWallets: [wallet] });
server.listen(0, '127.0.0.1', () => process.send({ port: server.address().port }));
let closing = false;
function close() {
  if (closing) return;
  closing = true;
  server.closeAllConnections();
  server.close(() => { store.close(); process.exit(0); });
}
process.on('SIGTERM', close);
process.on('disconnect', close);
