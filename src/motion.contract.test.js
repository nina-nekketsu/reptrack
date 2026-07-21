import fs from 'fs';
import path from 'path';

const SRC_ROOT = path.resolve(__dirname);

function collectCssFiles(directory = SRC_ROOT) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) return collectCssFiles(entryPath);
    return entry.isFile() && entry.name.endsWith('.css') ? [entryPath] : [];
  });
}

function readCss(relativePath) {
  return fs.readFileSync(path.join(SRC_ROOT, relativePath), 'utf8');
}

function reducedMotionCss(source) {
  const marker = '@media (prefers-reduced-motion: reduce)';
  const blocks = [];
  let searchFrom = 0;

  while (searchFrom < source.length) {
    const markerIndex = source.indexOf(marker, searchFrom);
    if (markerIndex === -1) break;

    const openIndex = source.indexOf('{', markerIndex + marker.length);
    let depth = 1;
    let cursor = openIndex + 1;

    while (cursor < source.length && depth > 0) {
      if (source[cursor] === '{') depth += 1;
      if (source[cursor] === '}') depth -= 1;
      cursor += 1;
    }

    blocks.push(source.slice(openIndex + 1, cursor - 1));
    searchFrom = cursor;
  }

  return blocks.join('\n').replace(/\s+/g, ' ');
}

function declarationsFor(source, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  return match ? match[1].replace(/\s+/g, ' ') : '';
}

describe('Motion CSS contract', () => {
  test('does not use transition: all anywhere under src', () => {
    const offenders = collectCssFiles().flatMap((filePath) => {
      const relativePath = path.relative(SRC_ROOT, filePath);
      return fs.readFileSync(filePath, 'utf8')
        .split('\n')
        .map((line, index) => ({ line, lineNumber: index + 1 }))
        .filter(({ line }) => /transition\s*:\s*all\b/i.test(line))
        .map(({ line, lineNumber }) => `${relativePath}:${lineNumber} ${line.trim()}`);
    });

    expect(offenders).toEqual([]);
  });

  test('does not leave infinite animation declarations in critical CSS', () => {
    const offenders = collectCssFiles().flatMap((filePath) => {
      const relativePath = path.relative(SRC_ROOT, filePath);
      return fs.readFileSync(filePath, 'utf8')
        .split('\n')
        .map((line, index) => ({ line, lineNumber: index + 1 }))
        .filter(({ line }) => /animation(?:-[\w-]+)?\s*:[^;{}]*\binfinite\b/i.test(line))
        .map(({ line, lineNumber }) => `${relativePath}:${lineNumber} ${line.trim()}`);
    });

    expect(offenders).toEqual([]);
  });

  test('declares the expanded semantic motion token set', () => {
    const css = readCss('index.css');
    const requiredTokens = {
      '--motion-duration-instant': '90ms',
      '--motion-duration-fast': '120ms',
      '--motion-duration-control': '160ms',
      '--motion-duration-reveal': '200ms',
      '--motion-duration-sheet': '240ms',
      '--motion-duration-celebration': '560ms',
      '--motion-ease-standard': 'cubic-bezier(.2, 0, 0, 1)',
      '--motion-ease-enter': 'cubic-bezier(.16, 1, .3, 1)',
      '--motion-ease-exit': 'cubic-bezier(.4, 0, 1, 1)',
      '--motion-ease-linear': 'linear',
      '--motion-distance-press': '1px',
      '--motion-distance-inline': '4px',
      '--motion-distance-reveal': '8px',
      '--motion-distance-sheet': '20px',
      '--motion-scale-press': '.97',
      '--motion-scale-pop-start': '.94',
      '--motion-scale-pop-overshoot': '1.03',
      '--motion-opacity-hidden': '0',
      '--motion-opacity-muted': '.64',
      '--motion-stagger-tight': '35ms',
      '--motion-stagger-standard': '55ms',
    };

    Object.entries(requiredTokens).forEach(([name, value]) => {
      expect(css).toContain(`${name}: ${value}`);
    });
  });

  test('clears animation delays in the global reduced-motion safety rule', () => {
    const reducedCss = reducedMotionCss(readCss('index.css'));

    expect(reducedCss).toContain('animation-delay: 0ms !important');
  });

  test('provides static reduced-motion alternatives for critical feedback', () => {
    const workoutsReduced = reducedMotionCss(readCss('pages/Workouts.css'));
    const navReduced = reducedMotionCss(readCss('components/BottomNav.css'));
    const exercisesReduced = reducedMotionCss(readCss('pages/Exercises.css'));
    const activeWorkoutReduced = reducedMotionCss(readCss('pages/ActiveWorkout.css'));

    expect(declarationsFor(workoutsReduced, '.active-session-banner .active-dot')).toMatch(/animation:\s*none/);
    expect(declarationsFor(workoutsReduced, '.active-session-banner .active-dot')).toMatch(/opacity:\s*1/);
    expect(declarationsFor(workoutsReduced, '.active-session-banner .active-dot')).toMatch(/transform:\s*none/);

    expect(declarationsFor(navReduced, '.nav-active-dot')).toMatch(/animation:\s*none/);
    expect(declarationsFor(navReduced, '.nav-active-dot')).toMatch(/opacity:\s*1/);
    expect(declarationsFor(navReduced, '.nav-active-dot')).toMatch(/transform:\s*none/);

    expect(declarationsFor(exercisesReduced, '.timer-phase--alert-feedback::after')).toMatch(/animation:\s*none/);
    expect(declarationsFor(exercisesReduced, '.timer-phase--alert-feedback::after')).toMatch(/opacity:\s*1/);
    expect(declarationsFor(exercisesReduced, '.timer-phase--alert-feedback::after')).toMatch(/transform:\s*none/);
    expect(declarationsFor(exercisesReduced, '.timer-phase__alert')).toMatch(/opacity:\s*1/);
    expect(declarationsFor(exercisesReduced, '.timer-phase__alert')).toMatch(/transform:\s*none/);

    expect(declarationsFor(activeWorkoutReduced, '.aw-end-overlay')).toMatch(/animation:\s*none/);
    expect(declarationsFor(activeWorkoutReduced, '.aw-end-confirm__check')).toMatch(/animation:\s*none/);
    expect(declarationsFor(activeWorkoutReduced, '.aw-end-confirm__check')).toMatch(/opacity:\s*1/);
    expect(declarationsFor(activeWorkoutReduced, '.aw-end-confirm__check')).toMatch(/transform:\s*none/);
  });

  test('removes contradictory sync and dead critical progress motion', () => {
    const allCss = collectCssFiles().map((filePath) => fs.readFileSync(filePath, 'utf8')).join('\n');
    const criticalProgressCss = [
      readCss('pages/ActiveWorkout.css'),
      readCss('pages/CoachOnboarding.css'),
      readCss('components/CoachComponents.css'),
    ].join('\n');

    expect(allCss).not.toMatch(/sync-spin|@keyframes\s+rest-pulse|@keyframes\s+alertPulse/);
    expect(criticalProgressCss).not.toMatch(/transition\s*:\s*width\b/);
  });
});
