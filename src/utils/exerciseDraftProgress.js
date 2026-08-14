export function isDropsetChildRow(row = {}) {
  return row.dropSetChild === true || row.setType === 'dropset_child';
}

export function isWarmupSetRow(row = {}) {
  return row.warmup === true || row.setType === 'warmup';
}

export function isPrimarySet(row = {}) {
  return !isWarmupSetRow(row) && !isDropsetChildRow(row);
}

export function isMeaningfulSetRow(row = {}) {
  return Number(row.reps) > 0 || Number(row.weight) > 0;
}

export function isActionablePrimarySet(row = {}) {
  if (!isPrimarySet(row) || row.automaticPlaceholder === true) return false;
  return row.planned === true || isMeaningfulSetRow(row);
}

export function deriveExerciseDraftProgress({ exerciseId, rows = [], prescribedSets = 0 }) {
  const primaryRows = rows.filter(isPrimarySet);
  const meaningfulRows = primaryRows.filter(isMeaningfulSetRow);
  const targetRows = primaryRows.filter((row) => (
    row.automaticPlaceholder !== true
    && (row.planned === true || isMeaningfulSetRow(row))
  ));
  const completedPrimarySets = targetRows.filter((row) => (
    row.done === true && isMeaningfulSetRow(row)
  )).length;
  const prescribedTarget = Math.max(0, Number(prescribedSets) || 0);
  const targetPrimarySets = rows.length === 0 ? prescribedTarget : targetRows.length;

  return {
    exerciseId,
    completedPrimarySets,
    targetPrimarySets,
    meaningfulPrimarySets: meaningfulRows.length,
    isExplicitlyComplete: targetPrimarySets > 0 && completedPrimarySets >= targetPrimarySets,
    updatedAt: Date.now(),
  };
}

export function getAnchorSetIndex(rows = []) {
  const firstIncomplete = rows.findIndex((row) => (
    isActionablePrimarySet(row) && row.done !== true
  ));
  if (firstIncomplete >= 0) return firstIncomplete;

  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (isActionablePrimarySet(rows[index]) && rows[index].done === true) return index;
  }

  return rows.findIndex(isPrimarySet);
}

export function getAnchorContextIndex(rows = [], anchorIndex = getAnchorSetIndex(rows)) {
  for (let index = anchorIndex - 1; index >= 0; index -= 1) {
    if (isActionablePrimarySet(rows[index]) && rows[index].done === true) return index;
  }
  return -1;
}

export function getAnchorScrollTop({
  anchorOffsetTop,
  anchorHeight = 0,
  contextOffsetTop,
  containerHeight = Number.POSITIVE_INFINITY,
  stickyOffset = 8,
}) {
  const contextAvailable = Number.isFinite(contextOffsetTop);
  const contextSpan = (Number(anchorOffsetTop) || 0) + (Number(anchorHeight) || 0)
    - (Number(contextOffsetTop) || 0) + stickyOffset;
  const contextFits = contextAvailable && contextSpan <= containerHeight;
  const targetOffset = contextFits ? contextOffsetTop : anchorOffsetTop;
  return Math.max(0, (Number(targetOffset) || 0) - stickyOffset);
}
