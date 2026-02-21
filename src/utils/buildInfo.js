const buildId = process.env.REACT_APP_BUILD_ID || 'local';
const version = process.env.REACT_APP_BUILD_VERSION || null;
const commit = process.env.REACT_APP_BUILD_COMMIT || null;

export const localBuildInfo = {
  buildId,
  version,
  commit,
};

export function formatBuildId(label = 'Build') {
  return buildId ? `${label} ${buildId}` : 'Local build';
}
