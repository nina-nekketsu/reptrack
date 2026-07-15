import { render, screen } from '@testing-library/react';
import ExerciseLogModal from './ExerciseLogModal';

jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('../context/CoachContext', () => ({ useCoach: () => ({ isOnboarded: false, coachActive: false, profile: {}, metadata: {} }) }));
jest.mock('./SetTimer', () => () => <div>Timer</div>);
jest.mock('./RecordBadges', () => () => <div>Records</div>);
jest.mock('./VolumeGraph', () => () => <div>Graph</div>);
jest.mock('./CoachFeedback', () => () => null);
jest.mock('./RestAdvisor', () => () => null);
jest.mock('../utils/buildInfo', () => ({ formatBuildId: () => 'test-build' }));

describe('ExerciseLogModal saved feedback', () => {
  beforeEach(() => {
    localStorage.clear();
    HTMLElement.prototype.scrollTo = jest.fn();
  });

  test('reopens a logged set with a visible non-color progress cue', () => {
    localStorage.setItem('activeWorkoutSession', JSON.stringify({ planId: 'push-day', startedAt: '2026-07-14T08:00:00.000Z' }));
    const logs = { bench: [
      { date: '2026-07-10T08:30:00.000Z', sets: [{ reps: 10, weight: 80 }] },
      { date: '2026-07-14T09:00:00.000Z', sets: [{ reps: 11, weight: 80 }] },
    ] };
    localStorage.setItem('exerciseLogs', JSON.stringify(logs));
    render(<ExerciseLogModal exercise={{ id: 'bench', name: 'Bench Press', muscleGroup: 'Chest' }} logs={logs} onClose={() => {}} onSaved={() => {}} stayOpenOnSave />);
    expect(screen.getByText('More reps than last time')).toBeInTheDocument();
  });
});
