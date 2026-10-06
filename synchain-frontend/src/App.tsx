import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { SupplyChainProvider } from './context/SupplyChainContext';
import { MainLayout } from './components/layout/MainLayout';
import { LoginForm } from './components/auth/LoginForm';
import { RegisterForm } from './components/auth/RegisterForm';
import { ForgotPasswordForm } from './components/auth/ForgotPasswordForm';
import { ResetPasswordForm } from './components/auth/ResetPasswordForm';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { Loader2 } from 'lucide-react';
import { OnboardingPage } from './components/onboarding/OnboardingPage';
import { LandingPage } from './components/landing/LandingPage';

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
      </div>
    );
  }
  
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

export function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <SupplyChainProvider>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<PublicRoute><LandingPage /></PublicRoute>} />
              <Route path="/login" element={<PublicRoute><LoginForm /></PublicRoute>} />
              <Route path="/register" element={<PublicRoute><RegisterForm /></PublicRoute>} />
              <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordForm /></PublicRoute>} />
              <Route path="/reset-password" element={<PublicRoute><ResetPasswordForm /></PublicRoute>} />
              <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
              
              {/* Protected Routes */}
              <Route path="/dashboard/*" element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              } />
            </Routes>
          </SupplyChainProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
