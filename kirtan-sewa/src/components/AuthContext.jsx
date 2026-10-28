import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { teamApi, userApi } from '../lib/api';
import { readStore, writeStore } from '../lib/storage';

const KEY = 'sewa.session';
const AuthContext = createContext(null);

// Tokens look like role.id.version.expiry.signature.
const valid = (s) => s?.token && Number(s.token.split('.')[3]) > Date.now() ? s : null;

/** Who is logged in on this device: a customer ("user") or a team member ("member"). */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => valid(readStore(KEY, null)));

  const login = useCallback((data) => {
    const next = { token: data.token, role: data.role, name: data.name || '' };
    writeStore(KEY, next);
    setSession(next);
  }, []);
  const logout = useCallback(() => {
    writeStore(KEY, null);
    setSession(null);
  }, []);
  // A password change gives this device a fresh token.
  const setToken = useCallback((token) => {
    setSession((s) => {
      const next = { ...s, token };
      writeStore(KEY, next);
      return next;
    });
  }, []);

  // Every call goes through here so an expired or revoked session logs out cleanly.
  const client = useMemo(() => {
    if (!session) return null;
    const raw = session.role === 'member' ? teamApi(session.token) : userApi(session.token);
    return Object.fromEntries(
      Object.entries(raw).map(([k, fn]) => [
        k,
        async (...args) => {
          try {
            return await fn(...args);
          } catch (e) {
            if (e.status === 401) logout();
            throw e;
          }
        },
      ]),
    );
  }, [session, logout]);

  const value = useMemo(
    () => ({ session, role: session?.role || null, user: session?.role === 'user' ? client : null, team: session?.role === 'member' ? client : null, login, logout, setToken }),
    [session, client, login, logout, setToken],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
