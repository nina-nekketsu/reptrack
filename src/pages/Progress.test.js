import { render, screen } from '@testing-library/react';
import Progress from './Progress';

describe('Progress analytics surface', () => {
  beforeEach(() => localStorage.clear());

  test('renders real e1RM PRs and weekly muscle-group volume', () => {
    localStorage.setItem('exercises', JSON.stringify([
      { id: 'bench', name: 'Bench Press', muscleGroup: 'Chest', type: 'Strength' },
      { id: 'row', name: 'Row', muscleGroup: 'Back', type: 'Strength' },
    ]));
    localStorage.setItem('exerciseLogs', JSON.stringify({
      bench: [{ date: new Date().toISOString(), sets: [{ weight: 100, reps: 6 }], totalVolume: 600 }],
      row: [{ date: new Date().toISOString(), sets: [{ weight: 80, reps: 10 }], totalVolume: 800 }],
    }));

    render(<Progress />);

    expect(screen.getByRole('heading', { name: 'Progress' })).toBeInTheDocument();
    expect(screen.getByText('Bench Press')).toBeInTheDocument();
    expect(screen.getByText(/120 kg e1RM/)).toBeInTheDocument();
    expect(screen.getByText('Chest')).toBeInTheDocument();
    expect(screen.getByText('Back')).toBeInTheDocument();
  });

  test('renders an honest empty state', () => {
    render(<Progress />);
    expect(screen.getByText('No progress data yet')).toBeInTheDocument();
  });
});
