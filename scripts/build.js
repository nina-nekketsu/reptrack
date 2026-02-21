const { spawn } = require('child_process');
const { generateBuildMetadata } = require('./build-metadata');

const metadata = generateBuildMetadata();

const env = {
  ...process.env,
  REACT_APP_BUILD_ID: metadata.buildId,
  REACT_APP_BUILD_COMMIT: metadata.commit,
  REACT_APP_BUILD_VERSION: metadata.version,
};

const runner = spawn('react-scripts', ['build'], {
  env,
  stdio: 'inherit',
});

runner.on('close', (code) => {
  process.exit(code);
});

runner.on('error', (err) => {
  console.error('Failed to run react-scripts build:', err);
  process.exit(1);
});
