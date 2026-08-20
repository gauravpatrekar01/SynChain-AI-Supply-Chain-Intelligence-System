import React, { useState, useEffect } from 'react';
import {
  Search,
  Bell,
  Volume2,
  VolumeX,
  Palette,
  Check,
  ChevronDown,
  Activity,
  Cpu,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useSupplyChain } from '../../context/SupplyChainContext';
import { soundFX } from '../../services/audioService';
import { AppTheme } from '../../types';

interface TopNavbarProps {
  onToggleSidebar?: () => void;
  onNavigate: (pageId: string) => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({ onNavigate }) => {
  const { user, switchPersona, availableUsers } = useAuth();
  const { theme, setTheme, settings, updateSettings } = useTheme();
  const {
    health,
    unreadAlertsCount,
    setIsNotificationDrawerOpen,
    setIsCommandPaletteOpen,
  } = useSupplyChain();

  const [currentTime, setCurrentTime] = useState<string>('');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isThemeOpen, setIsThemeOpen] = useState(false);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZoneName: 'short',
        })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleSound = () => {
    const newSound = !settings.soundEnabled;
    updateSettings({ soundEnabled: newSound });
    if (newSound) soundFX.playClick();
  };

  const themeOptions: Array<{ id: AppTheme; label: string; color: string }> = [
    { id: 'space', label: 'Deep Space (Dark)', color: 'bg-blue-600' },
    { id: 'cyber', label: 'Cyber Neon (Purple)', color: 'bg-purple-600' },
    { id: 'matrix', label: 'Matrix (Emerald)', color: 'bg-emerald-600' },
    { id: 'light', label: 'Enterprise Light', color: 'bg-slate-200' },
  ];

  return (
    <header className="sticky top-0 z-30 h-16 w-full glass-panel border-b border-white/10 px-4 lg:px-6 flex items-center justify-between gap-4">
      {/* Left side: System Status & Live Clock */}
      <div className="flex items-center gap-4 lg:gap-6 min-w-0">
        {/* Realtime AI Status Pill */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono-telemetry shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-semibold text-emerald-300">AI NEURAL CORE:</span>
          <span>{health.score}% NOMINAL</span>
          <span className="text-emerald-500/60">•</span>
          <span className="text-emerald-400/80">{health.latencyMs}ms</span>
        </div>

        {/* Live Clock & Weather Telemetry */}
        <div className="hidden md:flex items-center gap-3 text-xs text-slate-400 font-mono-telemetry border-l border-white/10 pl-4">
          <span className="text-slate-200 font-medium">{currentTime}</span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-300">Austin 28°C ☀️ | Rotterdam 19°C ⛅ | Shanghai 30°C 🌧️</span>
        </div>
      </div>

      {/* Right side: Search, Sound, Theme, Notifications, User */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Search Command Palette Trigger */}
        <button
          onClick={() => {
            soundFX.playClick();
            setIsCommandPaletteOpen(true);
          }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-500/40 text-xs text-slate-300 hover:text-white transition-all cursor-pointer shadow-sm group"
        >
          <Search className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
          <span className="hidden sm:inline">Search AI command...</span>
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono-telemetry bg-black/40 text-slate-400 rounded border border-white/10">
            Ctrl+K
          </kbd>
        </button>

        {/* Audio Toggle */}
        <button
          onClick={toggleSound}
          title={settings.soundEnabled ? 'Mute AI sound synthesis' : 'Unmute sound synthesis'}
          className={`p-2 rounded-xl border transition-all cursor-pointer ${
            settings.soundEnabled
              ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20'
              : 'bg-white/5 border-white/10 text-slate-500 hover:text-slate-300'
          }`}
        >
          {settings.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>

        {/* Theme Picker Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              soundFX.playClick();
              setIsThemeOpen(!isThemeOpen);
              setIsProfileOpen(false);
            }}
            title="Switch Theme"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/40 text-slate-300 hover:text-purple-400 transition-all cursor-pointer"
          >
            <Palette className="w-4 h-4" />
          </button>

          {isThemeOpen && (
            <div className="absolute right-0 mt-2 w-52 rounded-2xl glass-dropdown border border-purple-500/30 p-2 shadow-2xl z-50">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Theme Presets
              </div>
              {themeOptions.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setTheme(t.id);
                    setIsThemeOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-left transition-all cursor-pointer ${
                    theme === t.id
                      ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`w-3 h-3 rounded-full ${t.color}`} />
                    <span>{t.label}</span>
                  </div>
                  {theme === t.id && <Check className="w-3.5 h-3.5 text-purple-400" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notification Drawer Trigger */}
        <button
          onClick={() => {
            soundFX.playClick();
            setIsNotificationDrawerOpen(true);
          }}
          className="relative p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-500/40 text-slate-300 hover:text-white transition-all cursor-pointer"
        >
          <Bell className="w-4 h-4" />
          {unreadAlertsCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-lg shadow-rose-500/50 animate-pulse">
              {unreadAlertsCount}
            </span>
          )}
        </button>

        {/* User Profile & Persona Switcher */}
        <div className="relative">
          <button
            onClick={() => {
              soundFX.playClick();
              setIsProfileOpen(!isProfileOpen);
              setIsThemeOpen(false);
            }}
            className="flex items-center gap-2.5 p-1.5 pr-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-500/40 transition-all cursor-pointer"
          >
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="w-7 h-7 rounded-lg object-cover ring-1 ring-blue-400/50"
            />
            <div className="hidden lg:block text-left">
              <p className="text-xs font-semibold text-slate-100 leading-tight">{user.name}</p>
              <p className="text-[10px] text-blue-400 leading-tight">{user.role}</p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-2xl glass-dropdown border border-blue-500/30 p-2 shadow-2xl z-50">
              <div className="px-3 py-2 border-b border-white/10 mb-1">
                <p className="text-xs font-semibold text-white">{user.name}</p>
                <p className="text-[11px] text-slate-400">{user.email}</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-medium border border-blue-400/30">
                    {user.accessTier}
                  </span>
                </div>
              </div>

              <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Switch Demo Persona
              </div>

              {availableUsers.map((persona) => (
                <button
                  key={persona.id}
                  onClick={() => {
                    switchPersona(persona.id);
                    setIsProfileOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all cursor-pointer ${
                    user.id === persona.id
                      ? 'bg-blue-600/20 border border-blue-500/30'
                      : 'hover:bg-white/5'
                  }`}
                >
                  <img
                    src={persona.avatarUrl}
                    alt={persona.name}
                    className="w-6 h-6 rounded-md object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-100 truncate">{persona.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">{persona.role}</p>
                  </div>
                  {user.id === persona.id && <UserCheck className="w-4 h-4 text-blue-400" />}
                </button>
              ))}

              <div className="border-t border-white/10 mt-2 pt-2">
                <button
                  onClick={() => {
                    soundFX.playClick();
                    setIsProfileOpen(false);
                    onNavigate('settings');
                  }}
                  className="w-full px-3 py-2 rounded-xl text-xs text-slate-300 hover:text-white hover:bg-white/5 text-left transition-all cursor-pointer flex items-center gap-2"
                >
                  <Cpu className="w-3.5 h-3.5 text-slate-400" />
                  System Settings & API Gateway
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
