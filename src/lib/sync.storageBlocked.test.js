jest.mock('./supabase', () => ({ supabase: null }));
jest.mock('./clientDiagnosticsRuntime', () => ({
  clientDiagnostics: { incrementSyncFailure: jest.fn() },
}));

describe('sync storage safety', () => {
  test('loads when reading localStorage throws', () => {
    const getItem = jest.spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => { throw new Error('storage blocked'); });
    jest.resetModules();

    expect(() => require('./sync')).not.toThrow();

    getItem.mockRestore();
  });
});
