#!/usr/bin/env bash
# Isolated acceptance only: no Compose up, production mounts, keys or public ports.
set -euo pipefail
test "$#" -eq 0 || { echo 'This check accepts no production paths or secrets.' >&2; exit 1; }
cd "$(dirname "${BASH_SOURCE[0]}")/.."
test -z "$(git status --porcelain --untracked-files=all)" || { echo 'Use an unchanged reviewed checkout.' >&2; exit 1; }
command -v node >/dev/null
node -e 'if(process.versions.node.split(".")[0]!=="24")process.exit(1)'
backend_check_sha=$(git rev-parse HEAD)
backend_check_image="cosmoot-backend-check:${backend_check_sha:0:12}"
backend_check_docker=(docker)
docker info >/dev/null 2>&1 || backend_check_docker=(sudo docker)

echo '[1/4] Installing the pinned test dependencies'
npm ci --prefix relay-backup --ignore-scripts --no-audit --no-fund
echo '[2/4] Running isolated authenticated process restore'
node relay-backup/drill/run.mjs
echo '[3/4] Validating Compose/Caddy and building the application image'
if [[ ${backend_check_docker[0]} == sudo ]]; then
  sudo "$(command -v node)" scripts/check-backend-deployment.mjs
else
  node scripts/check-backend-deployment.mjs
fi
"${backend_check_docker[@]}" build --file faucet/Dockerfile --tag "$backend_check_image" .
echo '[4/4] Running restore and maintenance checks in the isolated image'
backend_check_options=(--rm --network none --read-only --cap-drop ALL
  --security-opt no-new-privileges --memory 512m --cpus 1 --pids-limit 64
  --tmpfs /tmp:rw,nosuid,nodev,size=64m,mode=1777)
"${backend_check_docker[@]}" run "${backend_check_options[@]}" \
  -v "$PWD/relay-backup/drill:/app/relay-backup/drill:ro" \
  -v "$PWD/relay-personal-backup.mjs:/app/relay-personal-backup.mjs:ro" \
  "$backend_check_image" node relay-backup/drill/run.mjs
"${backend_check_docker[@]}" run "${backend_check_options[@]}" \
  -v "$PWD/faucet/test/maintenance.test.mjs:/app/faucet/test/maintenance.test.mjs:ro" \
  "$backend_check_image" node --test faucet/test/maintenance.test.mjs
echo "PASS: isolated host/image checks at $backend_check_sha; no production cutover."
