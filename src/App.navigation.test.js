import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

jest.mock('react-router-dom', () => {
  const React = require('react');
  const RouteContext = React.createContext({ path: '/', navigate: () => {} });
  const normalize = (hash) => hash.replace(/^#/, '') || '/';
  const matches = (pattern, path) => pattern === path || pattern === '*' || (pattern.includes('/:') && path.startsWith(`${pattern.split('/:')[0]}/`));

  function HashRouter({ children }) {
    const [path, setPath] = React.useState(() => normalize(globalThis.window.location.hash));
    const navigate = React.useCallback((to) => {
      globalThis.window.location.hash = to;
      setPath(to);
    }, []);
    return <RouteContext.Provider value={{ path, navigate }}>{children}</RouteContext.Provider>;
  }
  function Routes({ children }) {
    const { path } = React.useContext(RouteContext);
    const routes = React.Children.toArray(children);
    return routes.find((route) => matches(route.props.path, path))?.props.element || null;
  }
  function Route() { return null; }
  function Navigate({ to }) {
    const { navigate } = React.useContext(RouteContext);
    React.useEffect(() => navigate(to), [navigate, to]);
    return null;
  }
  return { HashRouter, Routes, Route, Navigate };
}, { virtual: true });

jest.mock('./context/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({ user: { id: 'user-1' }, loading: false, isConfigured: true }),
}));
jest.mock('./context/TimerContext', () => ({ TimerProvider: ({ children }) => children }));
jest.mock('./context/CoachContext', () => ({ CoachProvider: ({ children }) => children }));
jest.mock('./components/BottomNav', () => () => <nav aria-label="Primary">Navigation</nav>);
jest.mock('./components/SyncIndicator', () => () => null);
jest.mock('./components/UpdateBanner', () => () => null);
jest.mock('./components/RouteContentTransition', () => ({ children }) => children);
jest.mock('./pages/Dashboard', () => () => <h1>Today</h1>);
jest.mock('./pages/Workouts', () => () => <h1>Workouts</h1>);
jest.mock('./pages/Exercises', () => () => <h1>Exercises</h1>);
jest.mock('./pages/History', () => () => <h1>History</h1>);
jest.mock('./pages/Progress', () => () => <h1>Progress</h1>);
jest.mock('./pages/Profile', () => () => <h1>Profile</h1>);
jest.mock('./pages/ActiveWorkout', () => () => <h1>Active workout</h1>);
jest.mock('./pages/CoachView', () => () => <h1>Coach view</h1>);
jest.mock('./pages/Coach', () => () => <h1>Coach</h1>);
jest.mock('./pages/CoachSettings', () => () => <h1>Coach settings</h1>);

const App = require('./App').default;

describe('authenticated route fallback', () => {
  test('redirects an unknown route to Today instead of rendering an empty shell', async () => {
    window.location.hash = '#/missing-route';

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument();
    await waitFor(() => expect(window.location.hash).toBe('#/today'));
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });
});
