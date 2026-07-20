import fs from 'fs';
import path from 'path';

const CSS_PATH = path.resolve(__dirname, 'press-feedback.css');
const pressCss = fs.existsSync(CSS_PATH) ? fs.readFileSync(CSS_PATH, 'utf8') : '';

const PRESS_TARGETS = [
  '.btn-primary',
  '.btn-secondary',
  '.btn-danger',
  '.plan-start-btn',
  '.timer-btn',
  '.timer-action-btn',
  '.timer-rest-picker',
  '.timer-settings-toggle',
  '.timer-toggle',
  '.timer-rest-option',
  '.set-done-btn',
  '.aw-bottom-bar__next',
  '.sheet-actions > button',
  '.sheet-close',
  '.nav-tab',
];

const PRESS_GROUP = `:is( ${PRESS_TARGETS.join(', ')} )`;
const ENABLED_ACTIVE = `${PRESS_GROUP}:active:not(:disabled):not([aria-busy="true"])`;
const INERT_GROUP = `${PRESS_GROUP}:disabled, ${PRESS_GROUP}[aria-busy="true"]`;
const INERT_ACTIVE = `${PRESS_GROUP}:is(:disabled, [aria-busy="true"]):active`;

function normalized(source) {
  return source.replace(/\s+/g, ' ').trim();
}

function declarationsFor(source, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = normalized(source).match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  return match ? match[1] : '';
}

function reducedMotionCss(source) {
  const marker = '@media (prefers-reduced-motion: reduce)';
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

describe('Unified press feedback CSS contract', () => {
  test('covers every approved high-frequency target with tokenized press and release timing', () => {
    expect(pressCss).not.toBe('');

    PRESS_TARGETS.forEach((selector) => {
      expect(pressCss).toContain(selector);
    });

    const releaseDeclarations = declarationsFor(pressCss, PRESS_GROUP);
    const pressDeclarations = declarationsFor(pressCss, ENABLED_ACTIVE);

    expect(releaseDeclarations).toMatch(/transition-property:\s*transform/);
    expect(releaseDeclarations).toMatch(/transition-duration:\s*var\(--motion-duration-fast\)/);
    expect(releaseDeclarations).toMatch(/transition-timing-function:\s*var\(--motion-ease-standard\)/);
    expect(pressDeclarations).toMatch(/transition-duration:\s*var\(--motion-duration-instant\)/);
    expect(pressDeclarations).toMatch(/transform:\s*translateY\(var\(--motion-distance-press\)\) scale\(var\(--motion-scale-press\)\)/);
  });

  test('suppresses pressed transforms for disabled and busy controls', () => {
    expect(declarationsFor(pressCss, INERT_GROUP)).toMatch(/transform:\s*none/);
    expect(declarationsFor(pressCss, INERT_ACTIVE)).toMatch(/transform:\s*none/);
  });

  test('removes transform feedback under reduced motion while leaving static color and border feedback available', () => {
    const reducedCss = reducedMotionCss(pressCss);
    const reducedReleaseDeclarations = declarationsFor(reducedCss, PRESS_GROUP);
    const reducedPressDeclarations = declarationsFor(reducedCss, ENABLED_ACTIVE);

    expect(reducedReleaseDeclarations).toMatch(/transition-property:\s*background-color, border-color, color/);
    expect(reducedPressDeclarations).toMatch(/transform:\s*none/);
    expect(reducedCss).not.toMatch(/scale\(|translate[XY]?\(/);
  });

  test('does not change target geometry or animate inputs and timer digits', () => {
    expect(pressCss).not.toMatch(/\b(?:min-|max-)?(?:width|height)\s*:|\bpadding(?:-[\w-]+)?\s*:|\bmargin(?:-[\w-]+)?\s*:/);
    expect(pressCss).not.toMatch(/\binput\b|\.timer-(?:display|phase)/);
    expect(pressCss).not.toMatch(/transition\s*:\s*all\b|\binfinite\b|\banimation\s*:/);
    expect(pressCss).not.toMatch(/:active[^,{]*:focus-visible|:focus-visible[^,{]*:active/);
  });
});
