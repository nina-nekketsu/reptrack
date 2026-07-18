const test = require('node:test');
const assert = require('node:assert/strict');

const {
  checkCleanTree,
  checkOriginMainProvenance,
  runPredeployChecks,
} = require('./check-clean');

function fakeGit(responses) {
  const calls = [];
  const git = (args) => {
    calls.push(args.join(' '));
    const key = args.join(' ');
    const response = responses[key];
    if (response instanceof Error) throw response;
    return response || '';
  };
  git.calls = calls;
  return git;
}

function withoutConsoleError(callback) {
  const original = console.error;
  console.error = () => {};
  try {
    return callback();
  } finally {
    console.error = original;
  }
}

test('clean tree check fails when git reports modified or untracked files', () => {
  const git = fakeGit({ 'status --porcelain': ' M package.json\n?? scripts/new.js' });

  assert.equal(withoutConsoleError(() => checkCleanTree({ git })), false);
  assert.deepEqual(git.calls, ['status --porcelain']);
});

test('origin/main provenance requires HEAD to be reachable from origin/main', () => {
  const git = fakeGit({
    'rev-parse HEAD': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'rev-parse --verify origin/main': 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    'merge-base --is-ancestor aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa origin/main': new Error('not ancestor'),
  });

  assert.equal(withoutConsoleError(() => checkOriginMainProvenance({ git })), false);
  assert.deepEqual(git.calls, [
    'rev-parse HEAD',
    'rev-parse --verify origin/main',
    'merge-base --is-ancestor aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa origin/main',
  ]);
});

test('predeploy git gate passes only when clean and already present on origin/main', () => {
  const git = fakeGit({
    'status --porcelain': '',
    'rev-parse HEAD': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'rev-parse --verify origin/main': 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    'merge-base --is-ancestor aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa origin/main': '',
  });

  assert.equal(runPredeployChecks({ git }), true);
});
