jest.mock('./storageCheck', () => ({ STORAGE_AVAILABLE: false }));

const { saveLogs } = require('./exerciseHelpers');

describe('saveLogs without local storage', () => {
  test('returns false without claiming durability', () => {
    const setItem = jest.spyOn(Storage.prototype, 'setItem');

    try {
      expect(saveLogs({ squat: [] })).toBe(false);
      expect(setItem).not.toHaveBeenCalled();
    } finally {
      setItem.mockRestore();
    }
  });
});
