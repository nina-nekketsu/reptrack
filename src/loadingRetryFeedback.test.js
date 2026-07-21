import fs from 'fs';
import path from 'path';

const read = (relativePath) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

function declarationsFor(source, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, 's'));
  return match?.[1].replace(/\s+/g, ' ').replace(/:\s*/g, ': ').trim() || '';
}

function blockFor(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) return '';
  const openIndex = source.indexOf('{', markerIndex + marker.length);
  let depth = 1;
  let cursor = openIndex + 1;
  while (cursor < source.length && depth > 0) {
    if (source[cursor] === '{') depth += 1;
    if (source[cursor] === '}') depth -= 1;
    cursor += 1;
  }
  return source.slice(openIndex + 1, cursor - 1);
}

describe('P2.2 loading and error motion contract', () => {
  test('keeps setup and auth cards inside narrow mobile viewports', () => {
    const css = read('src/App.css');
    const authCardRules = [...css.matchAll(/\.auth-card\s*\{([^}]*)\}/gs)]
      .map((match) => match[1].replace(/\s+/g, ' ').replace(/:\s*/g, ': ').trim());

    expect(authCardRules.some((rule) => (
      rule.includes('box-sizing: border-box')
      && rule.includes('width: 100%')
      && rule.includes('max-width: 400px')
    ))).toBe(true);
  });

  test('uses finite loading and error entry feedback with stable endpoints', () => {
    const css = read('src/App.css');
    const loadingRule = declarationsFor(css, '.loading-feedback');
    const errorRule = declarationsFor(css, '.error-feedback');
    const loadingKeyframes = blockFor(css, '@keyframes loading-feedback-enter');
    const errorKeyframes = blockFor(css, '@keyframes error-feedback-enter');

    expect(loadingRule).toContain('animation: loading-feedback-enter var(--motion-duration-control) var(--motion-ease-enter) 1 both');
    expect(errorRule).toContain('animation: error-feedback-enter 180ms var(--motion-ease-enter) 1 both');
    expect(loadingKeyframes).toMatch(/opacity:/);
    expect(loadingKeyframes).not.toMatch(/transform|width|height|margin|padding/);
    expect(errorKeyframes).toMatch(/opacity:/);
    expect(errorKeyframes).toMatch(/translateY\(4px\)/);
    expect(errorKeyframes).not.toMatch(/width|height|margin|padding/);
    expect(`${css}\n${read('src/press-feedback.css')}`).not.toMatch(/animation(?:-[\w-]+)?\s*:[^;{}]*\binfinite\b|transition\s*:\s*all/i);
  });

  test('makes loading, error, and retry press feedback static for reduced motion', () => {
    const appReduced = blockFor(read('src/App.css'), '@media (prefers-reduced-motion: reduce)');
    const pressReduced = blockFor(read('src/press-feedback.css'), '@media (prefers-reduced-motion: reduce)');

    expect(declarationsFor(appReduced, '.loading-feedback')).toContain('animation: none');
    expect(declarationsFor(appReduced, '.loading-feedback')).toContain('opacity: 1');
    expect(declarationsFor(appReduced, '.loading-feedback')).toContain('transform: none');
    expect(declarationsFor(appReduced, '.error-feedback')).toContain('animation: none');
    expect(declarationsFor(appReduced, '.error-feedback')).toContain('opacity: 1');
    expect(declarationsFor(appReduced, '.error-feedback')).toContain('transform: none');
    expect(pressReduced).toContain('.sync-indicator__retry');
    expect(pressReduced).toContain('.error-boundary__secondary');
  });

  test('keeps existing synchronous local actions immediate while marking real pending work', () => {
    const workouts = read('src/pages/Workouts.js');
    const activeWorkout = read('src/pages/ActiveWorkout.js');
    const exerciseLog = read('src/components/ExerciseLogModal.js');

    expect(workouts).toContain("{isStarting ? 'Starting…'");
    expect(workouts).toContain('aria-busy={isStarting}');
    expect(activeWorkout).toContain("{isEnding ? 'Ending…' : 'End & Save'}");
    expect(activeWorkout).toContain('aria-busy={isEnding}');
    expect(exerciseLog).toContain("{isSaving ? 'Saving…' : 'Done'}");
    expect(exerciseLog).toContain('aria-busy={isSaving}');
    expect(workouts).not.toMatch(/setTimeout[\s\S]{0,200}Starting…/);
    expect(activeWorkout).not.toMatch(/setTimeout[\s\S]{0,200}Ending…/);
  });
});
