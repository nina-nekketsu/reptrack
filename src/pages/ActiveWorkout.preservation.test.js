import fs from 'fs';
import path from 'path';

describe('active workout preserved completion affordances', () => {
  function readActiveWorkoutSource() {
    return fs.readFileSync(path.join(__dirname, 'ActiveWorkout.js'), 'utf8');
  }

  test('completed exercises render the established green check indicator', () => {
    const source = readActiveWorkoutSource();
    expect(source).toMatch(/done\s*\?\s*\(\s*<span className="aw-check"[^>]*>✓<\/span>/s);
  });

  test('uses the approved thumb-zone next action and three-step end flow', () => {
    const source = readActiveWorkoutSource();

    expect(source).not.toContain('className="aw-end-btn"');
    expect(source).toContain('className="aw-bottom-bar"');
    expect(source).toContain('Log next:');
    expect(source).toContain('setShowWorkoutMenu(true)');
    expect(source).toContain('setShowEndConfirm(true)');
  });

  test('marks only the first incomplete row next and does not hide missing exercises', () => {
    const source = readActiveWorkoutSource();

    expect(source).toContain('aw-exercise-row--next');
    expect(source).toContain('Unknown exercise (removed?)');
    expect(source).toContain('Edit plan');
  });

  test('keeps the persistent navigation from covering the workout action bar', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../components/BottomNav.js'),
      'utf8'
    );

    expect(source).toContain("if (/^\\/workout\\/[^/]+$/.test(location.pathname)) return null");
  });

  test('allows workout stat cards to shrink at the 320px viewport', () => {
    const css = fs.readFileSync(path.join(__dirname, 'ActiveWorkout.css'), 'utf8');

    expect(css).toMatch(/\.aw-stat\s*\{[^}]*min-width:\s*0/s);
  });
});
