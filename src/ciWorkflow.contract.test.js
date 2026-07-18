const fs = require('fs');
const path = require('path');

const workflowPath = path.join(__dirname, '..', '.github', 'workflows', 'ci.yml');

function readWorkflow() {
  expect(fs.existsSync(workflowPath)).toBe(true);
  return fs.readFileSync(workflowPath, 'utf8');
}

describe('GitHub Actions CI workflow contract', () => {
  test('runs a least-privilege bounded test and build pipeline without deployment or secrets', () => {
    const workflow = readWorkflow();

    expect(workflow).toMatch(/^on:\n  pull_request:\n  push:\n    branches:\n      - main$/m);
    expect(workflow).toMatch(/^permissions:\n  contents: read$/m);
    expect(workflow).toMatch(/^concurrency:\n  group: \$\{\{ github\.workflow \}\}-\$\{\{ github\.ref \}\}\n  cancel-in-progress: true$/m);
    expect(workflow).toMatch(/^  test-and-build:\n    runs-on: ubuntu-latest\n    timeout-minutes: (?:[1-9]|1[0-5])$/m);

    expect(workflow).toContain('uses: actions/checkout@v4');
    expect(workflow).toContain('uses: actions/setup-node@v4');
    expect(workflow).toMatch(/node-version: 20\n          cache: npm/);
    expect(workflow).toContain('run: npm ci');
    expect(workflow).toContain('run: npm run test:prd');
    expect(workflow).toContain('run: npm run lint');
    expect(workflow).toContain('run: CI=true npm test -- --runInBand');
    expect(workflow).toContain('run: npm run build');

    expect(workflow).not.toMatch(/\b(npm\s+run\s+deploy|npm\s+publish|gh-pages|git\s+push|gh\s+release|firebase\s+deploy|netlify\s+deploy|vercel\s+(?:--prod|deploy)|surge)\b/i);
    expect(workflow).not.toMatch(/\bsecrets\s*\./i);
  });
});
