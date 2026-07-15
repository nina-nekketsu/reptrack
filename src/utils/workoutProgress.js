function hasPositiveNumericValue(value) {
  if (value === null || value === undefined) return false;
  const text = String(value).trim();
  if (text === '') return false;
  const number = Number(text);
  return Number.isFinite(number) && number > 0;
}

export function isDropsetChild(set = {}) {
  return set.dropSetChild === true || set.setType === 'dropset_child';
}

export function countMeaningfulSets(sets = []) {
  return sets.filter((set) => {
    if (!set || isDropsetChild(set)) return false;
    return hasPositiveNumericValue(set.reps) || hasPositiveNumericValue(set.weight);
  }).length;
}

export function countCompletedSets(sets = []) {
  return sets.filter((set) => {
    if (!set || !set.done || isDropsetChild(set)) return false;
    return hasPositiveNumericValue(set.reps) || hasPositiveNumericValue(set.weight);
  }).length;
}

export function getExerciseProgressState(setsDone, prescribedSets, isMarkedDone = false) {
  const targetSets = Math.max(1, Number(prescribedSets) || 1);
  const completedSets = Math.max(0, Number(setsDone) || 0);
  const remainingSets = Math.max(targetSets - completedSets, 0);

  if (isMarkedDone) return 'done';
  if (completedSets >= targetSets) return 'ready';
  if (completedSets > 0 && remainingSets === 1) return 'almost';
  if (completedSets > 0) return 'partial';
  return 'idle';
}
