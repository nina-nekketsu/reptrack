import { localBuildInfo } from '../utils/buildInfo';
import { createClientDiagnostics } from './clientDiagnostics';

export const clientDiagnostics = createClientDiagnostics({
  buildInfo: localBuildInfo,
});
