// Bundled into the reviewed Pages artifact; only public snapshot paths are proxied.
import paths from '../../deploy/cosmoot/snapshot-paths.json';
import { snapshotProxy } from '../../service/snapshot-proxy.mjs';

export const onRequest = snapshotProxy(paths);
