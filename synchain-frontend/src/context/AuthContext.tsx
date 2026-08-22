import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { soundFX } from '../services/audioService';
import { apiService } from '../services/api';

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize Auth
  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('synchain_auth_token');
      if (token) {
        try {
          // Verify token and fetch user
          const userData = await apiService.getMe();
          // Map backend snake_case to frontend camelCase if needed, 
          // or assume api returns camelCase/we handle it here.
          const data: any = userData;
          setUser({
            ...userData,
            avatarUrl: data.avatar_url || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=64&h=64',
            accessTier: data.access_tier || 'Standard Executive',
          } as unknown as UserProfile);
          setIsAuthenticated(true);
        } catch (error) {
          console.error("Failed to verify token on load", error);
          localStorage.removeItem('synchain_auth_token');
          setIsAuthenticated(false);
        }
      }
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (email: string, password?: string) => {
    soundFX.playClick();
    try {
      const res = await apiService.login(email, password);
      localStorage.setItem('synchain_auth_token', res.access_token);
      
      const userData = await apiService.getMe();
      const data: any = userData;
      setUser({
        ...userData,
        avatarUrl: data.avatar_url || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=64&h=64',
        accessTier: data.access_tier || 'Standard Executive',
      } as unknown as UserProfile);
      
      setIsAuthenticated(true);
      soundFX.playSuccessFanfare();
    } catch (error) {
      console.error("Login failed", error);
      throw error; // Rethrow to let the UI handle the error
    }
  };

  const logout = () => {
    soundFX.playClick();
    setIsAuthenticated(false);
    setUser(null);
    localStorage.removeItem('synchain_auth_token');
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        login,
        logout,
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
