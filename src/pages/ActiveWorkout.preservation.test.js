import fs from 'fs';
import path from 'path';

describe('active workout preserved completion affordances', () => {
  function readActiveWorkoutSource() {
    return fs.readFileSync(path.join(__dirname, 'ActiveWorkout.js'), 'utf8');
  }

  test('completed exercises render the established green check indicator', () => {
    const source = readActiveWorkoutSource();
    expect(source).toMatch(/done\s*\?\s*\(\s*<span className="aw-check"[^>]*><CheckIcon \/><\/span>/s);
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

  test('claims the workout end action synchronously before persistence and exposes a busy confirm state', () => {
    const source = readActiveWorkoutSource();
    const handler = source.slice(
      source.indexOf('function handleEndWorkout()'),
      source.indexOf('function handleCloseSummary()')
    );

    expect(source).toContain('const endingRef = useRef(false)');
    expect(handler).toMatch(/if \(endingRef\.current\) return;\s*endingRef\.current = true;\s*setIsEnding\(true\)/s);
    expect(handler.indexOf("saveActiveWorkoutSession({ action: 'end'")).toBeLessThan(handler.indexOf('timer.stopAll()'));
    expect(handler).toContain('releaseEndAction()');
    expect(source).toContain('disabled={isEnding}');
    expect(source).toContain('aria-busy={isEnding}');
    expect(source).toContain("{isEnding ? 'Ending…' : 'End & Save'}");
  });

  test('keeps one end mutation and writes the local tombstone before opening the summary', () => {
    const source = readActiveWorkoutSource();
    const handler = source.slice(
      source.indexOf('function handleEndWorkout()'),
      source.indexOf('function handleCloseSummary()')
    );
    const localEnd = handler.indexOf("saveActiveWorkoutSession({ action: 'end'");
    const remotePush = handler.indexOf('pushActiveWorkoutSession(user?.id)');
    const summaryData = handler.indexOf('setSummaryData(summary)');
    const summaryOpen = handler.indexOf('setShowSummary(true)');

    expect(handler.match(/endCoachWorkout\(/g)).toHaveLength(1);
    expect(localEnd).toBeGreaterThan(-1);
    expect(remotePush).toBeGreaterThan(localEnd);
    expect(summaryData).toBeGreaterThan(remotePush);
    expect(summaryOpen).toBeGreaterThan(summaryData);
  });

  test('closes the summary and navigates immediately without timeout choreography', () => {
    const source = readActiveWorkoutSource();
    const handler = source.slice(
      source.indexOf('function handleCloseSummary()'),
      source.indexOf('function handleLogSaved(')
    );

    expect(handler).toMatch(/setShowSummary\(false\);\s*setSummaryData\(null\);\s*navigate\('\/workouts', \{ replace: true \}\)/s);
    expect(handler).not.toMatch(/setTimeout|animationend|transitionend/i);
  });
});
