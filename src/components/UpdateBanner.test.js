import { act, fireEvent, render, screen } from '@testing-library/react';
import UpdateBanner from './UpdateBanner';

let mockUpdateListener;
const mockUnsubscribe = jest.fn();

jest.mock('../lib/pwaUpdateController', () => ({
  subscribeToAppUpdate: (listener) => {
    mockUpdateListener = listener;
    return mockUnsubscribe;
  },
}));

describe('UpdateBanner', () => {
  beforeEach(() => {
    mockUpdateListener = null;
    mockUnsubscribe.mockClear();
  });

  test('preserves the existing update UX and activates the waiting worker', () => {
    const reload = jest.fn();
    render(<UpdateBanner />);

    expect(screen.queryByRole('button', { name: 'Reload' })).not.toBeInTheDocument();
    act(() => {
      mockUpdateListener({ reload });
    });

    expect(screen.getByText('New version available')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  test('unsubscribes on unmount', () => {
    const { unmount } = render(<UpdateBanner />);
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
