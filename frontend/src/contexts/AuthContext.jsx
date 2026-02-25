import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const session = API.init();
    if (session) {
      setToken(session.token);
      API.getMe()
        .then(u => { setUser(u); setToken(API.token); })
        .catch(() => { API.clearSession(); })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await API.login(email, password);
    setUser(data.user);
    setToken(data.token);
    return data;
  }, []);

  const register = useCallback(async (email, password, displayName) => {
    const data = await API.register(email, password, displayName);
    setUser(data.user);
    setToken(data.token);
    return data;
  }, []);

  const logout = useCallback(() => {
    API.clearSession();
    setUser(null);
    setToken(null);
  }, []);

  const updateUser = useCallback((updates) => {
    setUser(prev => prev ? { ...prev, ...updates } : prev);
  }, []);

  const forgotPassword = useCallback(async (email) => {
    return API.forgotPassword(email);
  }, []);

  return (
    <AuthContext.Provider value={{
      user, token, isLoading,
      login, register, logout, updateUser, forgotPassword,
      isSuperadmin: user?.globalRole === 'superadmin',
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
