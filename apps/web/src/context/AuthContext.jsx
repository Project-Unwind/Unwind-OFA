import {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';

const AuthContext = createContext(null);

const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:4000';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/auth/session`,
          {
            method: 'GET',
            credentials: 'include',
          }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.message || 'Unable to verify your session.'
          );
        }

        if (mounted) {
          setUser(
            result.authenticated ? result.user : null
          );
        }
      } catch (error) {
        console.error(
          'Unable to load OFA session:',
          error.message
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

    loadSession();

    return () => {
      mounted = false;
    };
  }, []);

  async function refreshSession() {
    setLoading(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/auth/session`,
        {
          method: 'GET',
          credentials: 'include',
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || 'Unable to refresh your session.'
        );
      }

      setUser(
        result.authenticated ? result.user : null
      );

      return result;
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    const response = await fetch(
      `${API_BASE_URL}/api/auth/logout`,
      {
        method: 'POST',
        credentials: 'include',
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || 'Unable to sign out.'
      );
    }

    setUser(null);
  }

  const value = {
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

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth must be used within an AuthProvider'
    );
  }

  return context;
}