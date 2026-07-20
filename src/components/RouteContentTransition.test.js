import React from 'react';
import fs from 'fs';
import path from 'path';
import { render, screen } from '@testing-library/react';
import RouteContentTransition, { normalizePathname } from './RouteContentTransition';

const mockLocation = {
  current: { pathname: '/today', search: '', hash: '' },
};

jest.mock('react-router-dom', () => ({
  useLocation: () => mockLocation.current,
}));

const appCssPath = path.join(__dirname, '..', 'App.css');

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

  return source.slice(openIndex + 1, cursor - 1).replace(/\s+/g, ' ');
}

let nextInstance = 0;

function IdentityProbe({ label }) {
  const [instance] = React.useState(() => {
    nextInstance += 1;
    return nextInstance;
  });

  return <button type="button">{label} instance {instance}</button>;
}

describe('route content transition identity', () => {
  beforeEach(() => {
    nextInstance = 0;
    mockLocation.current = { pathname: '/today', search: '', hash: '' };
  });

  test('normalizes only pathname presentation differences used for route identity', () => {
    expect(normalizePathname('/')).toBe('/');
    expect(normalizePathname('/today')).toBe('/today');
    expect(normalizePathname('/today/')).toBe('/today');
    expect(normalizePathname('/workout/plan-1///')).toBe('/workout/plan-1');
  });

  test('preserves the mounted route and focus for query, hash, and trailing-slash-only changes', () => {
    const { container, rerender } = render(
      <RouteContentTransition>
        <IdentityProbe label="Today" />
      </RouteContentTransition>
    );
    const initialWrapper = container.querySelector('.route-content');
    const initialButton = screen.getByRole('button', { name: 'Today instance 1' });
    initialButton.focus();

    mockLocation.current = { pathname: '/today', search: '?week=2', hash: '#sets' };
    rerender(
      <RouteContentTransition>
        <IdentityProbe label="Today" />
      </RouteContentTransition>
    );

    expect(container.querySelector('.route-content')).toBe(initialWrapper);
    expect(screen.getByRole('button', { name: 'Today instance 1' })).toBe(initialButton);
    expect(initialButton).toHaveFocus();

    mockLocation.current = { pathname: '/today/', search: '', hash: '' };
    rerender(
      <RouteContentTransition>
        <IdentityProbe label="Today" />
      </RouteContentTransition>
    );

    expect(container.querySelector('.route-content')).toBe(initialWrapper);
    expect(screen.getByRole('button', { name: 'Today instance 1' })).toBe(initialButton);
    expect(initialButton).toHaveFocus();
  });

  test('replaces one live route wrapper immediately for pathname changes and back/forward locations', () => {
    const { container, rerender } = render(
      <RouteContentTransition>
        <IdentityProbe label="Today" />
      </RouteContentTransition>
    );
    const todayWrapper = container.querySelector('.route-content');

    mockLocation.current = { pathname: '/profile', search: '', hash: '' };
    rerender(
      <RouteContentTransition>
        <IdentityProbe label="Profile" />
      </RouteContentTransition>
    );
    const profileWrapper = container.querySelector('.route-content');

    expect(profileWrapper).not.toBe(todayWrapper);
    expect(screen.getByRole('button', { name: 'Profile instance 2' })).toBeInTheDocument();
    expect(container.querySelectorAll('.route-content')).toHaveLength(1);

    mockLocation.current = { pathname: '/today', search: '', hash: '' };
    rerender(
      <RouteContentTransition>
        <IdentityProbe label="Today" />
      </RouteContentTransition>
    );

    expect(container.querySelector('.route-content')).not.toBe(profileWrapper);
    expect(screen.getByRole('button', { name: 'Today instance 3' })).toBeInTheDocument();
    expect(container.querySelectorAll('.route-content')).toHaveLength(1);
    expect(document.activeElement).toBe(document.body);
  });
});

describe('route content transition CSS', () => {
  test('uses one finite opacity and 4px entry without transitions or layout animation', () => {
    const css = fs.readFileSync(appCssPath, 'utf8');
    const routeRule = blockFor(css, '.route-content');
    const keyframes = blockFor(css, '@keyframes route-content-enter');

    expect(routeRule).toContain('animation: route-content-enter 170ms var(--motion-ease-enter) 1 both');
    expect(routeRule).not.toMatch(/transition\s*:/);
    expect(keyframes).toMatch(/from \{ opacity: 0; transform: translateY\(4px\); \}/);
    expect(keyframes).toMatch(/to \{ opacity: 1; transform: none; \}/);
    expect(keyframes).not.toMatch(/width|height|top|right|bottom|left|margin|padding/);
  });

  test('makes route content immediately visible and static for reduced motion', () => {
    const css = fs.readFileSync(appCssPath, 'utf8');
    const reducedMotion = blockFor(css, '@media (prefers-reduced-motion: reduce)');
    const routeRule = blockFor(reducedMotion, '.route-content');

    expect(routeRule).toContain('animation: none');
    expect(routeRule).toContain('opacity: 1');
    expect(routeRule).toContain('transform: none');
  });
});
