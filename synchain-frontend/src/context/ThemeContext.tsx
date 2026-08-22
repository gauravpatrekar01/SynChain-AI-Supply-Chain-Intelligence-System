import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppTheme, SystemSettings } from '../types';
import { soundFX } from '../services/audioService';

interface ThemeContextType {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  settings: SystemSettings;
  updateSettings: (partial: Partial<SystemSettings>) => void;
}

const defaultSettings: SystemSettings = {
  theme: 'space',
  soundEnabled: true,
  animationsEnabled: true,
  liveTelemetryStream: true,
  soundVolume: 0.3,
  realtimeRefreshIntervalSec: 5,
  fastApiBackendUrl: 'http://localhost:8000/api/v1',
  useLiveBackend: false,
  enableNeuralBackground: true,
  autoRunAISimulation: false,
  riskAlertThresholdPct: 75,
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SystemSettings>(() => {
    const saved = localStorage.getItem('synchain_settings');
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  });

  const setTheme = (theme: AppTheme) => {
    updateSettings({ theme });
    soundFX.playClick();
  };

  const updateSettings = (partial: Partial<SystemSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...partial };
      localStorage.setItem('synchain_settings', JSON.stringify(updated));
      return updated;
    });
  };

  useEffect(() => {
    soundFX.setEnabled(settings.soundEnabled);
    soundFX.setVolume(settings.soundVolume);

    // Update body class for themes
    const root = document.documentElement;
    root.classList.remove('theme-space', 'theme-cyber', 'theme-matrix', 'theme-light', 'dark');

    if (settings.theme === 'light') {
      root.classList.add('theme-light');
    } else {
      root.classList.add('dark');
      if (settings.theme === 'cyber') root.classList.add('theme-cyber');
      else if (settings.theme === 'matrix') root.classList.add('theme-matrix');
      else root.classList.add('theme-space');
    }
  }, [settings]);

  return (
    <ThemeContext.Provider value={{ theme: settings.theme, setTheme, settings, updateSettings }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};
