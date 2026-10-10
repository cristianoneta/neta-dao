import * as wire from './assets/relay-crypto/corecrypto.js';
import {trackPersonalStorage,ownedPersonalCrypto} from './relay-personal-runtime-storage.mjs';
window.NetaPersonalStorageDrained=trackPersonalStorage();
window.NetaPersonalWireReady=wire.initWasmModule('./assets/relay-crypto/index_bg.wasm').then(()=>({...wire,CoreCrypto:ownedPersonalCrypto(wire.CoreCrypto)}));
