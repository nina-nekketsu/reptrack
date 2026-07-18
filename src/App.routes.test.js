import fs from 'fs';
import path from 'path';

const appPath = path.join(__dirname, 'App.js');
const syncIndicatorPath = path.join(__dirname, 'components', 'SyncIndicator.js');
const appSource = () => fs.readFileSync(appPath, 'utf8');
const syncIndicatorSource = () => fs.readFileSync(syncIndicatorPath, 'utf8');

describe('App route truthfulness', () => {
  test('/home and /workout are redirects, not fake product surfaces', () => {
    const source = appSource();

    expect(source).toMatch(/<Route path="\/home"\s+element=\{<Navigate to="\/today" replace \/>\}/);
    expect(source).toMatch(/<Route path="\/workout"\s+element=\{<Navigate to="\/workouts" replace \/>\}/);
    expect(source).not.toMatch(/from ['"]\.\/pages\/Home['"]/);
    expect(source).not.toMatch(/from ['"]\.\/pages\/Workout['"]/);
    expect(fs.existsSync(path.join(__dirname, 'pages', 'Home.js'))).toBe(false);
    expect(fs.existsSync(path.join(__dirname, 'pages', 'Workout.js'))).toBe(false);
  });

  test('/workout/:planId remains the concrete active-workout route', () => {
    expect(appSource()).toMatch(/<Route path="\/workout\/:planId"\s+element=\{<ActiveWorkout \/>\}/);
  });

  test('primary reachable routes point to real product pages', () => {
    const source = appSource();
    [
      ['/', 'Dashboard'],
      ['/today', 'Dashboard'],
      ['/workouts', 'Workouts'],
      ['/exercises', 'Exercises'],
      ['/history', 'History'],
      ['/progress', 'Progress'],
      ['/profile', 'Profile'],
      ['/coach', 'Coach'],
      ['/coach/settings', 'CoachSettings'],
      ['/coach/:token', 'CoachView'],
    ].forEach(([route, component]) => {
      expect(source).toMatch(new RegExp(`<Route path="${route.replace('/', '\\/')}"\\s+element=\\{<${component} \\/>\\}`));
    });
  });

  test('loading and sync error states expose honest status contracts', () => {
    const source = appSource();
    const syncSource = syncIndicatorSource();

    expect(source).toContain('Loading RepTrack...');
    expect(source).toContain('role="status"');
    expect(syncSource).toContain("state === 'error' ? 'alert' : 'status'");
    expect(syncSource).toContain('Sync error');
  });
});
