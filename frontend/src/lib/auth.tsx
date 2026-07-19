import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  loginRequest,
  logoutRequest,
  meRequest,
  type User,
} from '@/api/auth';
import { getToken, setToken } from '@/api/client';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Re-reads /auth/me — call after edits that may touch the current user. */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Restore the session: /auth/me; on 401 the api client silently
    // retries through the refresh-token cookie.
    if (!getToken()) {
      setIsLoading(false);
      return;
    }
    meRequest()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await loginRequest(email, password);
    setToken(result.accessToken);
    setUser(result.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } catch {
      // clearing local state is enough for the client side
    }
    setToken(null);
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setUser(await meRequest());
    } catch {
      // keep the current session state; a hard 401 is handled globally
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
