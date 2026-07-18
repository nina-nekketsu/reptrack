import {
  CHECK_INTERVAL_MS,
  activateWaitingWorker,
  createPwaUpdateController,
  unregisterPwa,
} from './pwaUpdateController';

function createWindowMock() {
  const listeners = {};
  return {
    document: {
      visibilityState: 'visible',
      addEventListener: jest.fn((type, listener) => {
        listeners[type] = listener;
      }),
      removeEventListener: jest.fn(),
      __listeners: listeners,
    },
    location: {
      reload: jest.fn(),
    },
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    setInterval: jest.fn(() => 42),
    clearInterval: jest.fn(),
  };
}

function createNavigatorMock(registration) {
  return {
    serviceWorker: {
      register: jest.fn(() => Promise.resolve(registration)),
      getRegistrations: jest.fn(() => Promise.resolve([registration])),
    },
  };
}

describe('pwaUpdateController', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ buildId: process.env.REACT_APP_BUILD_ID || 'same-build' }),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    global.fetch.mockRestore();
  });

  test('registers the scoped service worker and schedules update checks', async () => {
    const registration = { update: jest.fn(), waiting: null, installing: null, addEventListener: jest.fn() };
    const windowRef = createWindowMock();
    const navigatorRef = createNavigatorMock(registration);
    const controller = createPwaUpdateController({
      force: true,
      windowRef,
      navigatorRef,
      publicUrl: '/reptrack',
    });

    await controller.start();

    expect(navigatorRef.serviceWorker.register).toHaveBeenCalledWith('/reptrack/service-worker.js', {
      scope: '/reptrack/',
    });
    expect(registration.update).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/^\/reptrack\/build-info\.json\?ts=/),
      expect.objectContaining({ cache: 'no-store', signal: expect.any(AbortSignal) })
    );
    expect(windowRef.setInterval).toHaveBeenCalledWith(expect.any(Function), CHECK_INTERVAL_MS);
  });

  test('checks on visibility return and the six-hour interval', async () => {
    const registration = { update: jest.fn(), waiting: null, installing: null, addEventListener: jest.fn() };
    const windowRef = createWindowMock();
    const controller = createPwaUpdateController({
      force: true,
      windowRef,
      navigatorRef: createNavigatorMock(registration),
      publicUrl: '/reptrack',
    });

    await controller.start();
    registration.update.mockClear();
    global.fetch.mockClear();

    windowRef.document.__listeners.visibilitychange();
    await Promise.resolve();
    expect(registration.update).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const intervalCallback = windowRef.setInterval.mock.calls[0][0];
    intervalCallback();
    await Promise.resolve();
    expect(registration.update).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('notifies when a waiting worker is available and activates it on reload', () => {
    const waiting = { postMessage: jest.fn() };
    const onUpdate = jest.fn();
    const registration = { waiting };

    activateWaitingWorker(registration, { onUpdate });
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ waitingWorker: waiting }));

    onUpdate.mock.calls[0][0].reload();
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  test('unregister path asks the worker to purge caches before unregistering', async () => {
    const active = { postMessage: jest.fn() };
    const registration = { active, unregister: jest.fn(() => Promise.resolve(true)) };
    const navigatorRef = createNavigatorMock(registration);

    await unregisterPwa({ navigatorRef });

    expect(active.postMessage).toHaveBeenCalledWith({ type: 'REPTRACK_SW_KILL_SWITCH' });
    expect(registration.unregister).toHaveBeenCalledTimes(1);
  });
});
