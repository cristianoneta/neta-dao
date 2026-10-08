// Documentation-only PRs still report the required check; manual releases run all checks.
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function needsSourceChecks(paths) {
  return paths.some(path => !path.endsWith('.md'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let source = true;
  if (process.env.GITHUB_EVENT_NAME === 'pull_request') {
    const base = process.env.PR_BASE;
    const head = process.env.GITHUB_SHA;
    if (![base, head].every(value => /^[0-9a-f]{40}$/.test(value || '')))
      throw Error('Exact base and head commits are required.');
    const paths = execFileSync('git', ['diff', '--name-only', '-z', base, head, '--'],
      { encoding: 'utf8' }).split('\0').filter(Boolean);
    source = needsSourceChecks(paths);
  }
  appendFileSync(process.env.GITHUB_OUTPUT, `source=${source}\n`);
}
