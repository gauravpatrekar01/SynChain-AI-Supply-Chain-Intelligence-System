import React from 'react';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { SupplyChainProvider } from './context/SupplyChainContext';
import { MainLayout } from './components/layout/MainLayout';

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SupplyChainProvider>
          <MainLayout />
        </SupplyChainProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
