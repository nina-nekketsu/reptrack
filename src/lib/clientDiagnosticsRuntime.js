import { localBuildInfo } from '../utils/buildInfo';
import { createClientDiagnostics } from './clientDiagnostics';

export const clientDiagnostics = createClientDiagnostics({
  buildInfo: localBuildInfo,
});

export function reportBackgroundFailure(error, { source = 'application', category = 'runtime' } = {}) {
  return clientDiagnostics.recordError(error, { source, category });
}
