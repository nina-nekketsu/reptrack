import { act, render, screen } from '@testing-library/react';
import CoachView from './CoachView';

const mockGetCoachData = jest.fn();

jest.mock('react-router-dom', () => ({
  useParams: () => ({ token: 'coach-token' }),
}));

jest.mock('../lib/coachShare', () => ({
  getCoachData: (...args) => mockGetCoachData(...args),
}));

jest.mock('../lib/supabase', () => ({ isConfigured: true }));

function deferred() {
  let resolve;
  const promise = new Promise((next) => { resolve = next; });
  return { promise, resolve };
}

describe('CoachView loading and error feedback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('announces the real load and enters the resulting error once', async () => {
    const request = deferred();
    mockGetCoachData.mockReturnValue(request.promise);
    render(<CoachView />);

    const loading = screen.getByRole('status');
    expect(loading).toHaveTextContent('Loading athlete data…');
    expect(loading).toHaveClass('loading-feedback');

    await act(async () => request.resolve(null));

    const error = await screen.findByRole('alert');
    expect(error).toHaveClass('error-feedback');
    expect(error).toHaveTextContent('This link is invalid or sharing has been disabled by the athlete.');
  });

  test('keeps honest empty states instead of replacing them with skeletons', async () => {
    mockGetCoachData.mockResolvedValue({
      exercises: [],
      last_session: {},
      prs: [],
      volume_history: [],
      synced_at: null,
    });
    render(<CoachView />);

    expect(await screen.findByText('No exercises logged yet.')).toBeInTheDocument();
    expect(screen.getByText('No sessions recorded yet.')).toBeInTheDocument();
    expect(screen.getByText('No PRs yet — keep grinding.')).toBeInTheDocument();
    expect(screen.getByText('Not enough sessions to draw a graph yet.')).toBeInTheDocument();
    expect(document.querySelector('[class*="skeleton"]')).not.toBeInTheDocument();
  });
});
