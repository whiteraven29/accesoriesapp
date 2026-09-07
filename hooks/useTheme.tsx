import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { ColorScheme, Palette, palettes } from '../constants/theme';
import { STORAGE_KEYS, storage } from '../utils/storage';

type ThemePreference = ColorScheme | 'system';

interface ThemeContextValue {
  /** Resolved scheme actually in use. */
  scheme: ColorScheme;
  /** What the user picked; 'system' follows the device. */
  preference: ThemePreference;
  colors: Palette;
  setPreference: (preference: ThemePreference) => void;
  toggleScheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    let active = true;
    storage.get(STORAGE_KEYS.colorScheme).then(saved => {
      if (active && (saved === 'light' || saved === 'dark' || saved === 'system')) {
        setPreferenceState(saved);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const setPreference = (next: ThemePreference) => {
    setPreferenceState(next);
    void storage.set(STORAGE_KEYS.colorScheme, next);
  };

  const scheme: ColorScheme =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  const value = useMemo<ThemeContextValue>(
    () => ({
      scheme,
      preference,
      colors: palettes[scheme],
      setPreference,
      toggleScheme: () => setPreference(scheme === 'dark' ? 'light' : 'dark'),
    }),
    [scheme, preference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
}
