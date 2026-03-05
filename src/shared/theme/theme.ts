import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { ColorSchemeName, useColorScheme } from 'react-native';
import { darkColors, lightColors } from './colors';
import { spacing } from './spacing';
import { typography } from './typography';
import { shadow } from './shadow';
import { getProfile, ThemePreference, updateProfile, Profile } from '../storage/profile';

export type AppTheme = {
  mode: 'light' | 'dark';
  colors: typeof lightColors;
  spacing: typeof spacing;
  typography: typeof typography;
  shadow: typeof shadow;
};

type ThemeContextValue = {
  theme: AppTheme;
  preference: ThemePreference;
  setPreference: (value: ThemePreference) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function resolveMode(preference: ThemePreference, system: ColorSchemeName): 'light' | 'dark' {
  if (preference === 'system') {
    return system === 'dark' ? 'dark' : 'light';
  }
  return preference;
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    getProfile().then((profile: Profile) => setPreferenceState(profile.themePreference));
  }, []);

  const mode = resolveMode(preference, systemScheme);

  const theme = useMemo<AppTheme>(
    () => ({
      mode,
      colors: mode === 'dark' ? darkColors : lightColors,
      spacing,
      typography,
      shadow,
    }),
    [mode],
  );

  const setPreference = async (value: ThemePreference) => {
    setPreferenceState(value);
    await updateProfile({ themePreference: value });
  };

  const value = useMemo(
    () => ({
      theme,
      preference,
      setPreference,
    }),
    [theme, preference],
  );

  return React.createElement(ThemeContext.Provider, { value }, children);
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within ThemeProvider');
  }
  return context;
}