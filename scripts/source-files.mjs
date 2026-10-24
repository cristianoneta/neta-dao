import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

export function sourceFiles() {
  // Reviewed runtime artifacts keep their published bytes. Their integrity/build
  // checks remain mandatory; a formatting pass must not silently repin them.
  const manifest = JSON.parse(
    readFileSync('docs/deployments/personal-pilot-artifacts-2026-10-07.json', 'utf8')
  );
  const pinned = new Set(
    Object.keys({ ...manifest.artifacts, ...manifest.existingCryptoArtifacts })
  );
  return [
    ...new Set(
      execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
        encoding: 'utf8'
      })
        .split('\0')
        .filter(
          (path) =>
            /\.(?:mjs|js)$/.test(path) &&
            !/^(assets|docs|dist|\.ci-tools)\//.test(path) &&
            !['relay-personal-pilot.js', 'dao-directory.js'].includes(path) &&
            !pinned.has(path)
        )
    )
  ].sort();
}
