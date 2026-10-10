# Personal mailbox storage lifetime

The manual release of PR #278 failed `browser-personal-browser.mjs` after an
explicit key rotation: the persisted generation-2 identity fingerprint did not
match its descriptor. The same source tree had passed PR CI. Local baseline
runs passed too, so the exact intermittent stack is not claimed as reproduced.

## Verified gaps and correction

CoreCrypto 10.5.3 `CoreCrypto.new()` first creates an FFI object and then wraps it.
The temporary object retains a native reference until garbage collection, even
when the returned wrapper is explicitly destroyed. A small subclass releases the
temporary reference immediately after the new wrapper acquires its own reference.
The pinned vendor JavaScript and WASM bytes remain unchanged.

Its relaxed-idb VFS commits to IndexedDB on a separate asynchronous queue. A
resolved crypto transaction or destroyed JS handle is not a persistence barrier.
The disposable runtime now tracks its `core-crypto` transactions from startup,
waits for completion and queued follow-up transactions, and propagates write
aborts before checkpoint capture, restoration or removal of the runtime frame.
Read-only preload aborts used by the VFS are allowed. No fixed sleep is used as
a substitute for transaction completion. A fresh runtime is still required to
avoid reusing cached pages after restoration.

The controller waits at every existing quiescence boundary. Concurrent wallet
invalidation and disconnect paths share one release operation, keeping the device
lock through storage teardown. Failed writes cannot produce a new encrypted
message backup or authorize a broadcast. Explicit recovery first settles and
closes the failed runtime, then loads the authenticated saved snapshot and
reconciles the existing transaction journals. No key reset or implicit rotation
is introduced. Public mainnet messaging remains disabled.

`Database.close()` is deliberately not used: the pinned WASM FFI implementation
is a documented no-op. Relevant upstream source:

- [CoreCrypto 10.5.3 wrapper](https://github.com/wireapp/core-crypto/tree/v10.5.3/crypto-ffi)
- [WASM Database close](https://github.com/wireapp/core-crypto/blob/v10.5.3/crypto-ffi/src/database/mod.rs)
- [relaxed-idb 0.2.0](https://docs.rs/crate/sqlite-wasm-vfs/0.2.0/source/src/relaxed_idb.rs)

## Evidence and limits

- A real browser test retains finalizer targets to prevent GC from hiding leaked
  references. The previous source leaves one native handle alive after teardown;
  the corrected runtime leaves zero.
- A real IndexedDB test holds a writer and queues another from its completion.
  Closing the runtime must keep its frame alive until both finish. A write abort
  rejects the barrier. These regressions run inside the existing browser CI job.
- Node tests cover the queued-write barrier, write aborts, explicit constructor
  ownership, and refusal to save/upload after a storage failure.
- The full synthetic browser integration covers fresh-browser encrypted backup
  restoration, interrupted operations, generation 2 through 4, retained old-key
  reads, current replies, backup errors, exact signed attempts and wallet changes.

Local integration and 273 Node tests pass. Full CI and a separate manual release
remain required. No real wallet action or deployed contract change was performed.
The identified lifetime races are directly tested; the original intermittent
fingerprint error itself was not reproduced verbatim locally.
