import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'docs/design-qa/mobile-readability');

const css = await readFile(path.join(root, 'src/pages/Exercises.css'), 'utf8');
const indexCss = await readFile(path.join(root, 'src/index.css'), 'utf8');
const timer = await readFile(path.join(root, 'src/components/SetTimer.js'), 'utf8');
const fixture = await readFile(path.join(outputDir, 'fixture.html'), 'utf8');

function cssVar(name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = indexCss.match(new RegExp(`${escaped}:\\s*(#[0-9A-Fa-f]{6})`));
  if (!match) throw new Error(`Missing ${name}`);
  return match[1];
}

function rgb(hex) {
  return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
}

function luminance(hex) {
  return rgb(hex).map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
}

function contrast(fg, bg) {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function hasRule(selector, required) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const blocks = Array.from(css.matchAll(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`, 'g')), (match) => match[1]);
  return blocks.some((block) => required.every((text) => block.includes(text)));
}

const viewports = [320, 360, 375, 390, 393, 430];
const rem = 16;
const digitClampPx = viewports.map((width) => ({
  width,
  activeDigitPx: Math.min(2.375 * rem, Math.max(1.75 * rem, width * 0.075)),
  inactiveDigitPx: Math.min(1.05 * rem, Math.max(0.9 * rem, width * 0.032)),
}));

const colors = {
  bg2: cssVar('--gym-bg-2'),
  bg1: cssVar('--gym-bg-1'),
  inkHi: cssVar('--gym-ink-hi'),
  inkMid: cssVar('--gym-ink-mid'),
  inkLow: cssVar('--gym-ink-low'),
  go: cssVar('--gym-go'),
  goDim: cssVar('--gym-go-dim'),
  rest: cssVar('--gym-rest'),
  restDim: cssVar('--gym-rest-dim'),
  danger: cssVar('--gym-danger'),
  dangerDim: cssVar('--gym-danger-dim'),
};

const checks = {
  srOnlyDefined: /\.sr-only\s*{[^}]*position:\s*absolute[^}]*width:\s*1px[^}]*height:\s*1px[^}]*overflow:\s*hidden[^}]*white-space:\s*nowrap/s.test(indexCss),
  semanticTimerHooks: timer.includes('timer-phase--exercise') && timer.includes('timer-phase--rest') && timer.includes('set-timer--alert'),
  noInkHiBackgroundOnLogZones: !/(log-sticky-top|log-timer-zone|log-tabs-wrapper|log-actions)[^{]*\{[^}]*background:\s*var\(--ink-hi\)/s.test(css),
  logZonesDark: hasRule('.modal--log .log-timer-zone', ['background: var(--bg-2)'])
    && hasRule('.log-tabs-wrapper', ['background: var(--bg-2)', 'border-color: var(--line)'])
    && hasRule('.log-actions', ['background: var(--bg-2)', 'border-top: 1px solid var(--line)']),
  modalMaxHeight92: css.includes('.modal--log { max-height: min(92dvh, 720px);')
    || css.includes('.modal--log { max-height: min(92dvh, 720px); background: var(--bg-2); }'),
  no96dvhOverride: !css.includes('min(96dvh'),
  activeDigitClamp: css.includes('font-size: clamp(1.75rem, 7.5vw, 2.375rem);')
    && digitClampPx.every(({ activeDigitPx }) => activeDigitPx >= 28 && activeDigitPx <= 38),
  inactiveDigitClamp: css.includes('font-size: clamp(0.9rem, 3.2vw, 1.05rem);'),
  inputFontSize16: hasRule('.modal--log .set-input', ['font-size: 16px']),
  mobileStepperTargets44: css.includes('grid-template-columns: 44px minmax(44px, 1fr) 44px;')
    && css.includes('min-height: 44px'),
  semanticPhaseColors: hasRule('.timer-phase--active.timer-phase--exercise', ['border-color: var(--go)', 'background: var(--go-dim)'])
    && hasRule('.timer-phase--active.timer-phase--rest', ['border-color: var(--rest)', 'background: var(--rest-dim)'])
    && hasRule('.set-timer--alert .timer-phase--active', ['border-color: var(--danger)', 'background: var(--danger-dim)']),
  modalLightFixtureAbsent: !fixture.includes('background: #fff') && !fixture.includes('background: var(--ink-hi)'),
  contrast: {
    modalSubOnBg2: contrast(colors.inkMid, colors.bg2),
    setGhostOnBg2: contrast(colors.inkLow, colors.bg2),
    setNumOnBg2: contrast(colors.inkLow, colors.bg2),
    timerLabelOnRestDim: contrast(colors.inkMid, colors.restDim),
    timerDigitOnRestDim: contrast(colors.inkHi, colors.restDim),
  },
};

const contrastVerdict = checks.contrast.modalSubOnBg2 >= 4.5
  && checks.contrast.setGhostOnBg2 >= 4.5
  && checks.contrast.setNumOnBg2 >= 4.5
  && checks.contrast.timerLabelOnRestDim >= 3
  && checks.contrast.timerDigitOnRestDim >= 3;

const booleanVerdict = Object.fromEntries(
  Object.entries(checks)
    .filter(([, value]) => typeof value === 'boolean')
    .map(([key, value]) => [key, value])
);

const report = {
  generatedAt: new Date().toISOString(),
  type: 'static-css-source-audit',
  note: 'This complements, but does not replace, browser screenshot QA.',
  digitClampPx,
  colors,
  checks,
  verdict: {
    ...booleanVerdict,
    contrast: contrastVerdict,
  },
};

await mkdir(outputDir, { recursive: true });
const reportPath = path.join(outputDir, 'mobile-readability-static-audit.json');
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

const failures = Object.entries(report.verdict)
  .filter(([, passed]) => !passed)
  .map(([name]) => name);

console.log(`Wrote ${reportPath}`);
console.log(JSON.stringify(report.verdict, null, 2));

if (failures.length) {
  console.error(`Failed static checks: ${failures.join(', ')}`);
  process.exit(1);
}
