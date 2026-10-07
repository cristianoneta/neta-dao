import * as wire from './assets/relay-crypto/corecrypto.js';
window.NetaPersonalWireReady=wire.initWasmModule('./assets/relay-crypto/index_bg.wasm').then(()=>wire);
