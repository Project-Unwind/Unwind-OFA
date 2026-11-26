'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

export interface AuthUser {
  id: string;
  displayName: string;
  email?: string;
}

interface ApiResponse {
  success: boolean;
  message?: string;
}

interface SessionResponse extends ApiResponse {
  authenticated?: boolean;
  user?: AuthUser | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  session: null;
  loading: boolean;
  isAuthenticated: boolean;
  refreshSession: () => Promise<SessionResponse>;
  signOut: () => Promise<void>;
}

interface AuthProviderProps {
  children: ReactNode;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      try {
        const response = await fetch('/api/auth/session', {
          method: 'GET',
          credentials: 'include',
        });

        const result: SessionResponse = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.message || 'Unable to verify your session.'
          );
        }

        if (mounted) {
          setUser(
            result.authenticated ? result.user ?? null : null
          );
        }
      } catch (error: unknown) {
        console.error(
          'Unable to load OFA session:',
          error instanceof Error ? error.message : error
        );

        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadSession();

    return () => {
      mounted = false;
    };
  }, []);

  async function refreshSession(): Promise<SessionResponse> {
    setLoading(true);

    try {
      const response = await fetch('/api/auth/session', {
        method: 'GET',
        credentials: 'include',
      });

      const result: SessionResponse = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || 'Unable to refresh your session.'
        );
      }

      setUser(
        result.authenticated ? result.user ?? null : null
      );

      return result;
    } catch (error: unknown) {
      setUser(null);
      throw error;
    } finally {
      setLoading(false);
    }
  }

  async function signOut(): Promise<void> {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });

    const result: ApiResponse = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || 'Unable to sign out.'
      );
    }

    setUser(null);
  }

  const value: AuthContextValue = {
    user,
    session: null,
    loading,
    isAuthenticated: Boolean(user),
    refreshSession,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth must be used within an AuthProvider'
    );
  }

  return context;
}