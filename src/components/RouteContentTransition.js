import { useLocation } from 'react-router-dom';

export function normalizePathname(pathname) {
  const normalized = (pathname || '/').replace(/\/+$/, '');
  return normalized || '/';
}

function RouteContentTransition({ children }) {
  const { pathname } = useLocation();
  const routePathname = normalizePathname(pathname);

  return (
    <div className="route-content" key={routePathname}>
      {children}
    </div>
  );
}

export default RouteContentTransition;
