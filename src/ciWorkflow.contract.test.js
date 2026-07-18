const fs = require('fs');
const path = require('path');

const workflowPath = path.join(__dirname, '..', '.github', 'workflows', 'ci.yml');

function readWorkflow() {
  expect(fs.existsSync(workflowPath)).toBe(true);
  return fs.readFileSync(workflowPath, 'utf8');
}

describe('GitHub Actions CI workflow contract', () => {
  test('runs a bounded test/build pipeline and deploys only verified main artifacts through the protected Pages environment', () => {
    const workflow = readWorkflow();

    expect(workflow).toMatch(/^on:\n  pull_request:\n  push:\n    branches:\n      - main$/m);
    expect(workflow).toMatch(/^permissions:\n  contents: read$/m);
    expect(workflow).toMatch(/^concurrency:\n  group: \$\{\{ github\.workflow \}\}-\$\{\{ github\.ref \}\}\n  cancel-in-progress: true$/m);
    expect(workflow).toMatch(/^  test-and-build:\n    runs-on: ubuntu-latest\n    timeout-minutes: (?:[1-9]|1[0-5])$/m);

    expect(workflow).toContain('uses: actions/checkout@v4');
    expect(workflow).toContain('uses: actions/setup-node@v4');
    expect(workflow).toMatch(/node-version: 22\n          cache: npm/);
    expect(workflow).toContain('run: npm ci');
    expect(workflow).toContain('run: npm run test:prd');
    expect(workflow).toContain('run: npm run lint');
    expect(workflow).toContain('run: CI=true npm test -- --runInBand');
    expect(workflow).toContain('run: npm audit --omit=dev --audit-level=moderate');
    expect(workflow).toContain('run: npm run build');
    expect(workflow).toContain('REACT_APP_SUPABASE_URL: ${{ secrets.REACT_APP_SUPABASE_URL }}');
    expect(workflow).toContain('REACT_APP_SUPABASE_ANON_KEY: ${{ secrets.REACT_APP_SUPABASE_ANON_KEY }}');
    expect(workflow).toContain("if: github.event_name == 'push' && github.ref == 'refs/heads/main'");
    expect(workflow).toContain('uses: actions/upload-pages-artifact@v3');
    expect(workflow).toContain('needs: test-and-build');
    expect(workflow).toMatch(/permissions:\n      pages: write\n      id-token: write/);
    expect(workflow).toMatch(/environment:\n      name: github-pages/);
    expect(workflow).toMatch(/deploy-pages:[\s\S]*steps:[\s\S]*uses: actions\/configure-pages@v5[\s\S]*uses: actions\/deploy-pages@v4/);
    expect(workflow).toContain('uses: actions/deploy-pages@v4');

    expect(workflow).not.toMatch(/\b(npm\s+run\s+deploy|npm\s+publish|gh-pages\s+-d|git\s+push|gh\s+release|firebase\s+deploy|netlify\s+deploy|vercel\s+(?:--prod|deploy)|surge)\b/i);
  });
});
