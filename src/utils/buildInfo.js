const buildId = process.env.REACT_APP_BUILD_ID || null;
const version = process.env.REACT_APP_BUILD_VERSION || null;
const commit = process.env.REACT_APP_BUILD_COMMIT || null;
const builtAtRaw = process.env.REACT_APP_BUILD_TIME || null;

const builtAtDate = builtAtRaw ? new Date(builtAtRaw) : null;
const hasValidDate = builtAtDate instanceof Date && !Number.isNaN(builtAtDate.getTime());
const displayId = commit ? commit.slice(0, 8) : buildId;

export const localBuildInfo = {
  buildId,
  version,
  commit,
  builtAt: hasValidDate ? builtAtDate : null,
  displayId,
};

export function formatBuildId(label = 'Build') {
  if (!displayId) {
    return 'Local build';
  }

  const dateLabel = hasValidDate
    ? builtAtDate.toLocaleDateString('nl-NL', {
        day: 'numeric',
        month: 'short',
      })
    : null;

  const suffix = dateLabel ? ` · ${dateLabel}` : '';
  return `${label} ${displayId}${suffix}`;
}
