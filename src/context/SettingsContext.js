'use client';

import { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext();

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState({
    model: 'meta-llama/llama-3.3-70b-instruct',
    openRouterKey: '',
    serperKey: '',
    discordToken: '',
    discordChannel: '',
    applicantName: '',
    applicantEmail: ''
  });

  // Load from localStorage on mount
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('researcher_settings') : null;
    if (saved) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSettings(prev => ({ ...prev, ...JSON.parse(saved) }));
      } catch (e) {
        console.error('Failed to parse settings');
      }
    }
  }, []);

  // Save to localStorage when settings change
  useEffect(() => {
    localStorage.setItem('researcher_settings', JSON.stringify(settings));
  }, [settings]);

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSetting }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
