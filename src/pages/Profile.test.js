import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Profile from './Profile';
import { DATA_EXPORT_SCHEMA_VERSION } from '../lib/dataTransfer';

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: null, signOut: jest.fn(), syncing: false, syncError: null, syncData: jest.fn() }),
}));
jest.mock('../lib/supabase', () => ({ isConfigured: false }));
jest.mock('../lib/coachShare', () => ({
  getCoachShare: jest.fn(),
  enableCoachShare: jest.fn(),
  disableCoachShare: jest.fn(),
  rotateCoachToken: jest.fn(),
}));

describe('Profile data and privacy controls', () => {
  beforeEach(() => {
    localStorage.clear();
    URL.createObjectURL = jest.fn(() => 'blob:reptrack-export');
    URL.revokeObjectURL = jest.fn();
  });

  test('shows sectioned data and privacy controls with storage explanation', () => {
    render(<Profile />);

    expect(screen.getByRole('heading', { name: 'Data & privacy' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export data' })).toBeInTheDocument();
    expect(screen.getByLabelText('Choose RepTrack export')).toBeInTheDocument();
    expect(screen.getByText(/stored on this device/i)).toBeInTheDocument();
  });

  test('downloads a versioned JSON export', () => {
    localStorage.setItem('exercises', JSON.stringify([{ id: 'squat', name: 'Squat' }]));
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<Profile />);

    fireEvent.click(screen.getByRole('button', { name: 'Export data' }));

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    click.mockRestore();
  });

  test('previews an import before applying it additively', async () => {
    const snapshot = {
      app: 'RepTrack',
      schemaVersion: DATA_EXPORT_SCHEMA_VERSION,
      data: {
        exercises: [{ id: 'bench', name: 'Bench Press' }],
        workoutPlans: [],
        exerciseLogs: {},
        settings: {},
        coach: {},
      },
    };
    const file = {
      name: 'reptrack-export.json',
      text: jest.fn().mockResolvedValue(JSON.stringify(snapshot)),
    };
    render(<Profile />);

    fireEvent.change(screen.getByLabelText('Choose RepTrack export'), { target: { files: [file] } });

    expect(await screen.findByText(/1 exercise will be added/i)).toBeInTheDocument();
    expect(localStorage.getItem('exercises')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Import additively' }));

    await waitFor(() => expect(JSON.parse(localStorage.getItem('exercises'))).toEqual([{ id: 'bench', name: 'Bench Press' }]));
    expect(screen.getByRole('status')).toHaveTextContent('Import complete');
  });
});
