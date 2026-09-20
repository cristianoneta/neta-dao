#!/usr/bin/env bash
set -euo pipefail

contract="${1:?contract directory name required}"
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cargo_root="${CARGO_HOME:-${HOME}/.cargo}"
rustup_root="${RUSTUP_HOME:-${HOME}/.rustup}"

# Rust embeds source locations in panic messages. Normalize machine-specific
# paths so reviewed local and CI builds are byte-for-byte comparable.
export RUSTFLAGS="-C target-feature=-bulk-memory,-reference-types,-multivalue -C link-arg=-s --remap-path-prefix=${repo_root}=/workspace --remap-path-prefix=${cargo_root}=/cargo --remap-path-prefix=${rustup_root}=/rustup"

cargo build -j 1 --locked --release --target wasm32-unknown-unknown \
  --manifest-path "${repo_root}/contracts/${contract}/Cargo.toml"
