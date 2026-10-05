// Owner-operated, browser-local price authority. No wallet, network or storage calls.
const encode=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes)));
export function validatePricePublicKey(value) {
  const bytes=Uint8Array.from(atob(value||''),c=>c.charCodeAt(0));
  if(bytes.length!==32||bytes.every(b=>b===0)||encode(bytes)!==value)throw Error('Invalid Ed25519 public price key.');
  return value;
}
function pem(bytes) {
  return '-----BEGIN PRIVATE KEY-----\n'+encode(bytes).match(/.{1,64}/g).join('\n')+'\n-----END PRIVATE KEY-----\n';
}
export async function createPriceKey(cryptoProvider=globalThis.crypto) {
  const pair=await cryptoProvider.subtle.generateKey({name:'Ed25519'},true,['sign','verify']);
  return {publicKey:encode(await cryptoProvider.subtle.exportKey('raw',pair.publicKey)),
    privatePem:pem(await cryptoProvider.subtle.exportKey('pkcs8',pair.privateKey))};
}
export async function restorePriceKey(text,expectedPublicKey=null,cryptoProvider=globalThis.crypto) {
  try {
    if(typeof text!=='string'||text.length>4096||!/^-----BEGIN PRIVATE KEY-----\s+[A-Za-z0-9+/=\s]+-----END PRIVATE KEY-----\s*$/.test(text))throw Error();
    const body=text.replace('-----BEGIN PRIVATE KEY-----','').replace('-----END PRIVATE KEY-----','').replace(/\s/g,'');
    const bytes=Uint8Array.from(atob(body),c=>c.charCodeAt(0));
    const key=await cryptoProvider.subtle.importKey('pkcs8',bytes,{name:'Ed25519'},true,['sign']);
    const jwk=await cryptoProvider.subtle.exportKey('jwk',key);
    const publicKey=validatePricePublicKey(jwk.x.replace(/-/g,'+').replace(/_/g,'/')+'=');
    if(expectedPublicKey&&publicKey!==validatePricePublicKey(expectedPublicKey))throw Error();
    return {publicKey,privatePem:pem(await cryptoProvider.subtle.exportKey('pkcs8',key))};
  } catch {throw Error('This is not the matching Ed25519 price key. No key was changed.');}
}
