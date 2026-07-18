const fs = require('fs');
const os = require('os');
const path = require('path');
const { writeEnvFile } = require('../scripts/write-build-info');

describe('build metadata environment writer', () => {
  test('preserves existing configuration while replacing generated build metadata', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'reptrack-build-info-'));
    const envFile = path.join(directory, '.env.production.local');
    fs.writeFileSync(
      envFile,
      [
        'REACT_APP_SUPABASE_URL=https://example.supabase.co',
        'REACT_APP_SUPABASE_ANON_KEY=public-anon-value',
        'REACT_APP_BUILD_ID=old-build',
        'REACT_APP_BUILD_TIME=old-time',
        '',
      ].join('\n'),
      'utf8'
    );

    fs.chmodSync(envFile, 0o700);

    writeEnvFile(envFile, {
      buildId: 'new-build',
      commit: 'abcdef1234567890',
      version: '1.2.3',
      builtAt: '2026-07-18T00:00:00.000Z',
    });

    const result = fs.readFileSync(envFile, 'utf8');
    expect(result).toContain('REACT_APP_SUPABASE_URL=https://example.supabase.co');
    expect(result).toContain('REACT_APP_SUPABASE_ANON_KEY=public-anon-value');
    expect(result).toContain('REACT_APP_BUILD_ID=new-build');
    expect(result).toContain('REACT_APP_BUILD_COMMIT=abcdef1234567890');
    expect(result).toContain('REACT_APP_BUILD_VERSION=1.2.3');
    expect(result).toContain('REACT_APP_BUILD_TIME=2026-07-18T00:00:00.000Z');
    expect(result).not.toContain('REACT_APP_BUILD_ID=old-build');
    expect(result).not.toContain('REACT_APP_BUILD_TIME=old-time');
    expect(fs.statSync(envFile).mode & 0o777).toBe(0o600);
  });
});
