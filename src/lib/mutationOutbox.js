export const MUTATION_OUTBOX_STORAGE_KEY = 'reptrackMutationOutboxV1';

const ACTIONABLE_STATUSES = new Set(['pending', 'failed', 'syncing']);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sanitizeText(value, fallback) {
  const text = typeof value === 'string' && value.trim() ? value.trim() : fallback;
  return text
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/(token|secret|password|api[_-]?key)\s*[=:]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .slice(0, 240);
}

function sanitizeError(error) {
  const sanitized = {
    message: sanitizeText(error?.message, 'Mutation failed'),
  };
  if (typeof error?.code === 'string' || typeof error?.code === 'number') {
    sanitized.code = sanitizeText(String(error.code), 'UNKNOWN').slice(0, 80);
  }
  return sanitized;
}

function isStoredOperation(value) {
  return Boolean(
    value
    && typeof value === 'object'
    && typeof value.id === 'string'
    && typeof value.kind === 'string'
    && typeof value.idempotencyKey === 'string'
    && ACTIONABLE_STATUSES.has(value.status)
  );
}

export function createMutationOutbox({
  storage = typeof localStorage === 'undefined' ? null : localStorage,
  now = Date.now,
} = {}) {
  let sequence = 0;
  let operations = [];
  let flushPromise = null;
  const listeners = new Set();

  function notify() {
    const snapshot = clone(operations);
    listeners.forEach((listener) => {
      try { listener(snapshot); } catch { /* isolate observer failures */ }
    });
  }

  function persist() {
    if (storage) {
      try {
        storage.setItem(MUTATION_OUTBOX_STORAGE_KEY, JSON.stringify(operations));
      } catch {
        // The in-memory queue remains usable when browser storage is unavailable.
      }
    }
    notify();
  }

  function load() {
    if (!storage) return [];
    try {
      const raw = storage.getItem(MUTATION_OUTBOX_STORAGE_KEY);
      if (raw === null) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error('Invalid mutation outbox');
      const valid = parsed.filter(isStoredOperation).map((operation) => ({
        ...operation,
        status: operation.status === 'syncing' ? 'pending' : operation.status,
        attempts: Number.isInteger(operation.attempts) && operation.attempts >= 0
          ? operation.attempts
          : 0,
        lastError: operation.lastError || null,
      }));
      if (valid.length !== parsed.length || parsed.some((item) => item.status === 'syncing')) {
        operations = valid;
        persist();
      }
      return valid;
    } catch {
      operations = [];
      persist();
      return [];
    }
  }

  operations = load();

  function listPending() {
    return clone(operations);
  }

  function pendingCount() {
    return operations.length;
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('Subscriber must be a function');
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function enqueue({ kind, entityId = null, idempotencyKey, payload = null } = {}) {
    if (typeof kind !== 'string' || !kind.trim()) {
      throw new TypeError('Mutation kind is required');
    }
    if (typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
      throw new TypeError('Mutation idempotencyKey is required');
    }

    const timestamp = now();
    const existingIndex = operations.findIndex(
      (operation) => operation.idempotencyKey === idempotencyKey
    );

    if (existingIndex >= 0) {
      operations[existingIndex] = {
        ...operations[existingIndex],
        kind,
        entityId,
        payload: clone(payload),
        status: 'pending',
        lastError: null,
        updatedAt: timestamp,
      };
      persist();
      return clone(operations[existingIndex]);
    }

    sequence += 1;
    const operation = {
      id: `mutation-${timestamp}-${sequence}`,
      kind,
      entityId,
      idempotencyKey,
      payload: clone(payload),
      status: 'pending',
      attempts: 0,
      lastError: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    operations.push(operation);
    persist();
    return clone(operation);
  }

  function retry(id) {
    const index = operations.findIndex((operation) => operation.id === id);
    if (index < 0) return null;
    operations[index] = {
      ...operations[index],
      status: 'pending',
      lastError: null,
      updatedAt: now(),
    };
    persist();
    return clone(operations[index]);
  }

  async function runFlush(executor) {
    if (typeof executor !== 'function') {
      throw new TypeError('Mutation executor is required');
    }

    const ids = operations
      .filter((operation) => operation.status === 'pending')
      .map((operation) => operation.id);
    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    for (const id of ids) {
      const index = operations.findIndex((operation) => operation.id === id);
      if (index < 0 || operations[index].status !== 'pending') continue;

      processed += 1;
      operations[index] = {
        ...operations[index],
        status: 'syncing',
        attempts: operations[index].attempts + 1,
        updatedAt: now(),
      };
      persist();

      try {
        await executor(clone(operations[index]));
        const completedIndex = operations.findIndex((operation) => operation.id === id);
        if (completedIndex >= 0 && operations[completedIndex].status === 'syncing') {
          operations = operations.filter((operation) => operation.id !== id);
        }
        succeeded += 1;
      } catch (error) {
        const failedIndex = operations.findIndex((operation) => operation.id === id);
        if (failedIndex >= 0 && operations[failedIndex].status === 'syncing') {
          operations[failedIndex] = {
            ...operations[failedIndex],
            status: 'failed',
            lastError: sanitizeError(error),
            updatedAt: now(),
          };
        }
        failed += 1;
      }
      persist();
    }

    return { processed, succeeded, failed, pending: operations.length };
  }

  function flush(executor) {
    if (flushPromise) return flushPromise;
    flushPromise = runFlush(executor).finally(() => {
      flushPromise = null;
    });
    return flushPromise;
  }

  return {
    enqueue,
    flush,
    isFlushing: () => Boolean(flushPromise),
    listPending,
    pendingCount,
    retry,
    subscribe,
  };
}
