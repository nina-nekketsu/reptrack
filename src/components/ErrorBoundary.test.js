import fs from 'fs';
import path from 'path';
import { fireEvent, render, screen } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

function BrokenWorkout() {
  throw new Error('student@example.com secret-workout-note');
}

describe('ErrorBoundary', () => {
  let consoleError;

  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  test('renders healthy children unchanged', () => {
    render(
      <ErrorBoundary>
        <main aria-label="RepTrack app">Ready to train</main>
      </ErrorBoundary>
    );

    expect(screen.getByLabelText('RepTrack app')).toHaveTextContent('Ready to train');
  });

  test('renders a generic accessible recovery screen without leaking exception details', () => {
    const onReload = jest.fn();
    render(
      <ErrorBoundary onReload={onReload}>
        <BrokenWorkout />
      </ErrorBoundary>
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveAccessibleName('RepTrack needs a restart');
    expect(screen.getByRole('heading', { name: 'RepTrack needs a restart' })).toHaveFocus();
    expect(alert).toHaveTextContent('Your locally saved workout data has not been deleted.');
    expect(alert).not.toHaveTextContent('student@example.com');
    expect(alert).not.toHaveTextContent('secret-workout-note');

    fireEvent.click(screen.getByRole('button', { name: 'Reload RepTrack' }));
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  test('can retry children without clearing local workout data', () => {
    let shouldThrow = true;
    function RecoverableWorkout() {
      if (shouldThrow) throw new Error('temporary render failure');
      return <main>Workout recovered</main>;
    }

    render(
      <ErrorBoundary>
        <RecoverableWorkout />
      </ErrorBoundary>
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();

    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('Workout recovered')).toBeInTheDocument();
  });

  test('is wired around the root App render', () => {
    const source = fs.readFileSync(path.join(__dirname, '../index.js'), 'utf8');
    expect(source).toMatch(/import ErrorBoundary from ['"]\.\/components\/ErrorBoundary['"]/);
    expect(source).toMatch(/<ErrorBoundary>[\s\S]*<App \/>[\s\S]*<\/ErrorBoundary>/);
  });
});
