export function createClientSetId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `set-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ensureSetIdentity(set = {}, index = 0) {
  return {
    ...set,
    clientSetId: set.clientSetId || createClientSetId(),
    setIndex: Number.isFinite(Number(set.setIndex)) ? Number(set.setIndex) : index,
  };
}

export function normalizeSetIdentities(sets = []) {
  return sets.map((set, index) => ensureSetIdentity(set, index));
}

export function getSetFingerprint(set = {}) {
  return [
    set.clientSetId || '',
    set.reps ?? '',
    set.weight ?? '',
    set.setType || 'normal',
    set.setIndex ?? '',
  ].join('|');
}
