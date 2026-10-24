import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';

const SiteContext = createContext(null);

export function SiteProvider({ children }) {
  const [site, setSite] = useState(null);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      setSite(await api.site());
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return <SiteContext.Provider value={{ site, error, refresh }}>{children}</SiteContext.Provider>;
}

export const useSite = () => useContext(SiteContext);
