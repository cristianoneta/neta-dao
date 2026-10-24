import { execFileSync } from 'node:child_process';

// Shared local/CI entry point. Browser, Docker and pinned chain/contract execution
// remain separately named release gates; this command never deploys or signs.
for (const script of ['format:check', 'lint', 'typecheck', 'test'])
  execFileSync('npm', ['run', script], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/check-repository.mjs'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/build-personal-pilot.mjs', '--check'], {
  stdio: 'inherit'
});
execFileSync('python3', ['scripts/build_dao_directory.py', '--check'], { stdio: 'inherit' });
execFileSync('python3', ['-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_*.py'], {
  stdio: 'inherit'
});
