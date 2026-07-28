import { useEffect, useState } from 'react';

function readOnlineStatus() {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
}

export default function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(readOnlineStatus);

  useEffect(() => {
    const update = () => setIsOnline(readOnlineStatus());
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return isOnline;
}
