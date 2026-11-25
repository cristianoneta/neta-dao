// Public snapshots and tightly allowlisted read-only governance queries.
import paths from '../../deploy/cosmoot/snapshot-paths.json';
import { snapshotProxy } from '../../service/snapshot-proxy.mjs';

import { governanceReadProxy } from '../../deploy/cosmoot/governance-read-proxy.mjs';
import { demoGovernanceProxy } from '../../deploy/cosmoot/demo-governance-proxy.mjs';
const snapshots = snapshotProxy(paths);
export const onRequest = async (context) =>
  (await demoGovernanceProxy(context.request)) ||
  (await governanceReadProxy(context.request)) ||
  snapshots(context);
