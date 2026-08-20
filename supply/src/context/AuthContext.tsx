import React, { createContext, useContext, useState } from 'react';
import { UserProfile } from '../types';
import { mockUserProfiles } from '../services/mockData';
import { soundFX } from '../services/audioService';

interface AuthContextType {
  user: UserProfile;
  isAuthenticated: boolean;
  login: (email: string, password?: string) => Promise<void>;
  logout: () => void;
  switchPersona: (userId: string) => void;
  availableUsers: UserProfile[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('synchain_active_user');
    return saved ? JSON.parse(saved) : mockUserProfiles[0];
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return !!localStorage.getItem('synchain_auth_token') || true; // Default logged in for seamless demo
  });

  const login = async (email: string, _password?: string) => {
    soundFX.playClick();
    const found = mockUserProfiles.find((u) => u.email.toLowerCase() === email.toLowerCase()) || mockUserProfiles[0];
    setUser(found);
    setIsAuthenticated(true);
    localStorage.setItem('synchain_active_user', JSON.stringify(found));
    localStorage.setItem('synchain_auth_token', `synchain_mock_jwt_${btoa(found.email)}`);
    soundFX.playSuccessFanfare();
  };

  const logout = () => {
    soundFX.playClick();
    setIsAuthenticated(false);
    localStorage.removeItem('synchain_auth_token');
  };

  const switchPersona = (userId: string) => {
    const target = mockUserProfiles.find((u) => u.id === userId);
    if (target) {
      setUser(target);
      localStorage.setItem('synchain_active_user', JSON.stringify(target));
      soundFX.playAlertChime();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        login,
        logout,
        switchPersona,
        availableUsers: mockUserProfiles,
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
