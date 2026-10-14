import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { soundFX } from '../services/audioService';
import { apiService } from '../services/api';

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<UserProfile>;
  completeOnboarding: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const mapUser = (userData: UserProfile): UserProfile => {
    const data: any = userData || {};
    return {
      ...userData,
      name: data.name || 'User',
      email: data.email || '',
      role: data.role || 'Operations Lead',
      avatarUrl: data.avatar_url || data.avatarUrl || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=64&h=64',
      accessTier: data.access_tier || data.accessTier || 'Standard Executive',
      department: data.department || 'Operations',
      onboarding_completed: Boolean(data.onboarding_completed),
    } as unknown as UserProfile;
  };

  // Initialize Auth
  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('synchain_auth_token');
      if (token) {
        try {
          // Verify token and fetch user
          const userData = await apiService.getMe();
          setUser(mapUser(userData));
          setIsAuthenticated(true);
        } catch (error: any) {
          console.error("Failed to verify token on load", error);
          // Only clear credentials on confirmed 401. 
          // Timeouts/Network errors should keep the session (attempted recovery on next request).
          if (error.response?.status === 401) {
            localStorage.removeItem('synchain_auth_token');
            setIsAuthenticated(false);
          } else {
            // Keep token, but mark as unauthenticated for this session 
            // unless a successful call happens later.
            setIsAuthenticated(false);
          }
        }
      }
      setIsLoading(false);
    };

    initializeAuth();

    const handleAuthExpired = () => {
      setUser(null);
      setIsAuthenticated(false);
    };
    window.addEventListener('synchain_auth_expired', handleAuthExpired);
    return () => window.removeEventListener('synchain_auth_expired', handleAuthExpired);
  }, []);

  const login = async (email: string, password?: string) => {
    soundFX.playClick();
    try {
      const res = await apiService.login(email, password);
      localStorage.setItem('synchain_auth_token', res.access_token);
      
      const userData = await apiService.getMe();
      const mappedUser = mapUser(userData);
      setUser(mappedUser);
      
      setIsAuthenticated(true);
      soundFX.playSuccessFanfare();
      return mappedUser;
    } catch (error) {
      console.error("Login failed", error);
      throw error; // Rethrow to let the UI handle the error
    }
  };

  const completeOnboarding = () => {
    setUser((currentUser) => currentUser ? { ...currentUser, onboarding_completed: true } : currentUser);
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
        completeOnboarding,
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
