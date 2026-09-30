import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api.js';

const AuthContext = createContext(null);

// Who is signed in. The session itself lives in an httpOnly cookie the page can't read,
// so we ask the server (/api/auth/me) instead of storing anything in localStorage.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { user } = await api('/api/auth/me');
      setUser(user);
    } catch {
      setUser(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const logout = useCallback(async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, setUser, ready, refresh, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
