import { governanceDemoProxy } from '../../deploy/cosmoot/governance-demo-proxy.mjs';

export const onRequest = async (context) =>
  (await governanceDemoProxy(context.request)) || context.next();
