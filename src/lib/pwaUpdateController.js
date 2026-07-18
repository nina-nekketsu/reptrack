import { localBuildInfo } from '../utils/buildInfo';

export const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

const listeners = new Set();
let currentUpdate = null;
let singleton = null;

function publicBase(publicUrl = process.env.PUBLIC_URL || '') {
  return publicUrl.replace(/\/$/, '');
}

function serviceWorkerScope(publicUrl) {
  const base = publicBase(publicUrl);
  return `${base || ''}/`;
}

function serviceWorkerUrl(publicUrl) {
  const base = publicBase(publicUrl);
  return `${base}/service-worker.js`;
}

function buildInfoUrl(publicUrl) {
  const base = publicBase(publicUrl);
  return `${base}/build-info.json?ts=${Date.now()}`;
}

function notify(update) {
  currentUpdate = update;
  listeners.forEach((listener) => listener(update));
}

export function subscribeToAppUpdate(listener) {
  listeners.add(listener);
  if (currentUpdate) listener(currentUpdate);
  return () => listeners.delete(listener);
}

export function activateWaitingWorker(registration, { onUpdate = notify } = {}) {
  const waitingWorker = registration?.waiting;
  if (!waitingWorker) return false;

  onUpdate({
    waitingWorker,
    reload: () => {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    },
  });
  return true;
}

function watchInstallingWorker(registration, windowRef) {
  const installingWorker = registration.installing;
  if (!installingWorker?.addEventListener) return;

  installingWorker.addEventListener('statechange', () => {
    if (installingWorker.state === 'installed') {
      activateWaitingWorker(registration, { windowRef });
    }
  });
}

async function checkBuildInfo({ publicUrl, signal, windowRef }) {
  const response = await fetch(buildInfoUrl(publicUrl), {
    cache: 'no-store',
    signal,
  });
  if (!response.ok) throw new Error('build info unavailable');

  const remote = await response.json();
  if (localBuildInfo.buildId && remote?.buildId && remote.buildId !== localBuildInfo.buildId) {
    notify({
      reload: () => windowRef.location.reload(),
    });
    return true;
  }
  return false;
}

export function createPwaUpdateController({
  force = false,
  publicUrl = process.env.PUBLIC_URL || '',
  windowRef = window,
  navigatorRef = navigator,
} = {}) {
  let registration = null;
  let intervalId = null;
  let abortController = null;
  let started = false;

  const shouldRegister = () => {
    if (!navigatorRef?.serviceWorker) return false;
    return force || process.env.NODE_ENV === 'production';
  };

  const checkNow = async () => {
    if (abortController) abortController.abort();
    abortController = new AbortController();

    if (registration?.update) {
      await registration.update();
      activateWaitingWorker(registration, { windowRef });
    }

    try {
      await checkBuildInfo({ publicUrl, signal: abortController.signal, windowRef });
    } catch (error) {
      if (error.name !== 'AbortError') {
        // Update checks are opportunistic; app use must remain unaffected.
      }
    }
  };

  const onVisibilityChange = () => {
    if (windowRef.document.visibilityState === 'visible') {
      checkNow();
    }
  };

  const start = async () => {
    if (started) return registration;
    started = true;

    if (shouldRegister()) {
      registration = await navigatorRef.serviceWorker.register(serviceWorkerUrl(publicUrl), {
        scope: serviceWorkerScope(publicUrl),
      });
      activateWaitingWorker(registration, { windowRef });
      if (registration.addEventListener) {
        registration.addEventListener('updatefound', () => watchInstallingWorker(registration, windowRef));
      }
      if (navigatorRef.serviceWorker.addEventListener) {
        let refreshing = false;
        navigatorRef.serviceWorker.addEventListener('controllerchange', () => {
          if (refreshing) return;
          refreshing = true;
          windowRef.location.reload();
        });
      }
    }

    windowRef.document.addEventListener('visibilitychange', onVisibilityChange);
    intervalId = windowRef.setInterval(checkNow, CHECK_INTERVAL_MS);
    await checkNow();
    return registration;
  };

  const stop = () => {
    if (abortController) abortController.abort();
    if (intervalId) windowRef.clearInterval(intervalId);
    windowRef.document.removeEventListener('visibilitychange', onVisibilityChange);
    started = false;
  };

  return { start, stop, checkNow };
}

export function registerPwaUpdateController(options = {}) {
  if (!singleton) singleton = createPwaUpdateController(options);
  singleton.start();
  return singleton;
}

export async function unregisterPwa({ navigatorRef = navigator } = {}) {
  if (!navigatorRef?.serviceWorker?.getRegistrations) return [];
  const registrations = await navigatorRef.serviceWorker.getRegistrations();
  await Promise.all(registrations.map(async (registration) => {
    registration.active?.postMessage?.({ type: 'REPTRACK_SW_KILL_SWITCH' });
    return registration.unregister();
  }));
  return registrations;
}
