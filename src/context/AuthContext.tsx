import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types/index.ts';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (identifier: string, pass: string) => Promise<void>;
  register: (data: { email: string; password: string; username: string; displayName: string; phone?: string }) => Promise<void>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<{ message: string; resetToken?: string }>;
  resetPassword: (email: string, resetToken: string, newPass: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('aether_token'));
  const [isLoading, setIsLoading] = useState(true);

  // Validate existing token
  useEffect(() => {
    const checkAuth = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          // Token expired or invalid
          setToken(null);
          setUser(null);
          localStorage.removeItem('aether_token');
        }
      } catch (err) {
        console.error('Failed to verify session', err);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [token]);

  const login = async (identifier: string, pass: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password: pass })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Login failed');
    }
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('aether_token', data.token);
  };

  const register = async (formData: { email: string; password: string; username: string; displayName: string; phone?: string }) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Registration failed');
    }
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('aether_token', data.token);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('aether_token');
  };

  const updateProfile = async (data: Partial<User>) => {
    if (!token) throw new Error('Not authenticated');
    const res = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.error || 'Failed to update profile');
    }
    setUser(result.user);
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!token) throw new Error('Not authenticated');
    const res = await fetch('/api/auth/password', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ currentPassword, newPassword })
    });
    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.error || 'Failed to change password');
    }
  };

  const forgotPassword = async (email: string) => {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Request failed');
    return result;
  };

  const resetPassword = async (email: string, resetToken: string, newPass: string) => {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, resetToken, newPassword: newPass })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Reset failed');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        register,
        logout,
        updateProfile,
        changePassword,
        forgotPassword,
        resetPassword
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
