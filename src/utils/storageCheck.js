// src/utils/storageCheck.js
// Check if localStorage is available (fails in private browsing, strict tracking mode)

export function isStorageAvailable() {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

// Global flag — check once at module load
export const STORAGE_AVAILABLE = isStorageAvailable();
