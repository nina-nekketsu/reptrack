import fs from 'fs';
import path from 'path';

const source = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

describe('active workout consumers use the single lifecycle mutation API', () => {
  const pageFiles = ['pages/Workouts.js', 'pages/ActiveWorkout.js'];

  test.each(pageFiles)('%s does not read or write the storage key directly', (pageFile) => {
    const contents = source(pageFile);
    expect(contents).not.toMatch(/localStorage\.(getItem|setItem|removeItem)\(['"]activeWorkoutSession['"]/);
    expect(contents).toMatch(/from ['"]\.\.\/lib\/activeWorkoutSession['"]/);
  });

  test.each(pageFiles)('%s starts and ends through saveActiveWorkoutSession', (pageFile) => {
    const contents = source(pageFile);
    expect(contents).toContain('saveActiveWorkoutSession');
    expect(contents).toContain("action: 'start'");
    expect(contents).toContain("action: 'end'");
    expect(contents).not.toContain('writeStoredActiveWorkoutSession');
    expect(contents).not.toContain('finishStoredActiveWorkoutSession');
  });

  test('ExerciseLogModal exposes only an active session to the UI', () => {
    const contents = source('components/ExerciseLogModal.js');
    expect(contents).not.toMatch(/localStorage\.(getItem|setItem|removeItem)\(['"]activeWorkoutSession['"]/);
    expect(contents).toContain('getStoredVisibleActiveWorkoutSession');
    expect(contents).not.toContain('readStoredActiveWorkoutSession');
    expect(contents).toMatch(/from ['"]\.\.\/lib\/activeWorkoutSession['"]/);
  });

  test.each(pageFiles)('%s persists lifecycle changes through the dedicated sync path', (pageFile) => {
    const contents = source(pageFile);
    expect(contents).toContain('pushActiveWorkoutSession');
  });
});
