import React, { createContext, useContext, useEffect, useState } from 'react';
import { authAPI } from '@/lib/api';
import axios from 'axios';

interface User {
  id: string;
  email: string;
  name: string;
  accessToken: string;
  perfil?: string;
}

function decodeJwtPerfil(token: string): string | undefined {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded.perfil;
  } catch {
    return undefined;
  }
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  hasOfflineSession: boolean;
  offlineSessionEmail: string | null;
  login: (email: string, password: string) => Promise<void>;
  loginOffline: (email?: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasOfflineSession, setHasOfflineSession] = useState(false);
  const [offlineSessionEmail, setOfflineSessionEmail] = useState<string | null>(null);

  const readStoredSession = () => {
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('authToken');
    if (!storedUser || !storedToken) {
      return null;
    }

    try {
      const parsedUser = JSON.parse(storedUser) as User;
      if (!parsedUser?.email) {
        return null;
      }
      return { user: parsedUser, token: storedToken };
    } catch {
      return null;
    }
  };

  // Load user from localStorage on mount
  useEffect(() => {
    const storedSession = readStoredSession();
    if (storedSession) {
      setUser(storedSession.user);
      setHasOfflineSession(true);
      setOfflineSessionEmail(storedSession.user.email);
    } else {
      localStorage.removeItem('user');
      localStorage.removeItem('authToken');
      setHasOfflineSession(false);
      setOfflineSessionEmail(null);
    }

    setIsLoading(false);
  }, []);

  const loginOffline = (email?: string) => {
    const storedSession = readStoredSession();
    if (!storedSession) {
      throw new Error('Nao existe sessao salva para login offline.');
    }

    if (email && storedSession.user.email.toLowerCase() !== email.toLowerCase()) {
      throw new Error('Este e-mail nao possui sessao offline salva neste dispositivo.');
    }

    setUser(storedSession.user);
    setHasOfflineSession(true);
    setOfflineSessionEmail(storedSession.user.email);
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await authAPI.login(email, password);
      const data = response.data;
      const userData: User = {
        id: data.userId || data.id || email,
        email,
        name: data.nome || data.name || email,
        accessToken: data.accessToken || '',
        perfil: decodeJwtPerfil(data.accessToken || ''),
      };

      if (!data.accessToken) {
        throw new Error('Login failed');
      }

      localStorage.setItem('authToken', data.accessToken);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      setHasOfflineSession(true);
      setOfflineSessionEmail(userData.email);
    } catch (error) {
      if (axios.isAxiosError(error) && !error.response) {
        const storedSession = readStoredSession();
        if (
          storedSession &&
          (!email || storedSession.user.email.toLowerCase() === email.toLowerCase())
        ) {
          setUser(storedSession.user);
          setHasOfflineSession(true);
          setOfflineSessionEmail(storedSession.user.email);
          return;
        }

        throw new Error(
          'Sem conexao com a internet. Use "Entrar offline" se voce ja fez login neste dispositivo.',
        );
      }
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    setUser(null);
    setHasOfflineSession(false);
    setOfflineSessionEmail(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        hasOfflineSession,
        offlineSessionEmail,
        login,
        loginOffline,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
