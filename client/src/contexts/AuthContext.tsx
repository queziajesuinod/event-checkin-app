import React, { createContext, useContext, useEffect, useState } from 'react';
import { authAPI } from '@/lib/api';
import axios from 'axios';

interface User {
  id: string;
  email: string;
  name: string;
  accessToken: string;
  perfis: string[];
}

interface JwtPayload {
  id?: string;
  sub?: string;
  nome?: string;
  name?: string;
  perfil?: string;
  perfis?: string[];
}

function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;

    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const paddedBase64 = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const binary = atob(paddedBase64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const decoded = JSON.parse(new TextDecoder().decode(bytes));

    return decoded as JwtPayload;
  } catch {
    return null;
  }
}

function decodeJwtPerfis(payload: JwtPayload | null): string[] {
  if (Array.isArray(payload?.perfis)) return payload.perfis as string[];
  if (typeof payload?.perfil === 'string') return [payload.perfil];
  return [];
}

function decodeJwtNome(payload: JwtPayload | null): string | null {
  if (typeof payload?.nome === 'string' && payload.nome.trim()) return payload.nome.trim();
  if (typeof payload?.name === 'string' && payload.name.trim()) return payload.name.trim();
  return null;
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
      const parsedUser = JSON.parse(storedUser) as User & { perfil?: string };
      if (!parsedUser?.email) {
        return null;
      }

      const payload = decodeJwtPayload(storedToken);
      const decodedNome = decodeJwtNome(payload);
      const decodedPerfis = decodeJwtPerfis(payload);

      if (!Array.isArray(parsedUser.perfis)) {
        parsedUser.perfis = parsedUser.perfil ? [parsedUser.perfil] : [];
      }
      if (decodedPerfis.length > 0) {
        parsedUser.perfis = decodedPerfis;
      }
      if (decodedNome) {
        parsedUser.name = decodedNome;
      } else if (!parsedUser.name) {
        parsedUser.name = parsedUser.email;
      }

      return { user: parsedUser as User, token: storedToken };
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
      localStorage.setItem('user', JSON.stringify(storedSession.user));
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

      if (!data.accessToken) {
        throw new Error('Login failed');
      }

      const payload = decodeJwtPayload(data.accessToken);
      const decodedNome = decodeJwtNome(payload);
      const userData: User = {
        id: data.userId || data.id || payload?.sub || payload?.id || email,
        email,
        name: decodedNome || data.nome || data.name || email,
        accessToken: data.accessToken,
        perfis: decodeJwtPerfis(payload),
      };

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
