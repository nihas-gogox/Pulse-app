/**
 * Driver app theme: light or dark. Toggled from profile; persisted to AsyncStorage.
 * All driver screens use useDriverThemeColors() for backgrounds, surfaces, text, etc.
 */
import React, { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Theme from '@pulse/core/constants/Theme';

const STORAGE_KEY = 'driver_theme';
const MAP_STORAGE_KEY = 'driver_map_theme';
export type DriverThemeMode = 'light' | 'dark';
export type MapThemeMode = 'light' | 'dark' | 'auto';
const DEFAULT_THEME: DriverThemeMode = 'light';
const DEFAULT_MAP_THEME: MapThemeMode = 'auto';

type DriverThemeContextType = {
  theme: DriverThemeMode;
  setTheme: (mode: DriverThemeMode) => void;
  isDark: boolean;
  mapTheme: MapThemeMode;
  setMapTheme: (mode: MapThemeMode) => void;
};

const DriverThemeContext = createContext<DriverThemeContextType | undefined>(undefined);

export function useDriverTheme() {
  const ctx = useContext(DriverThemeContext);
  if (!ctx) throw new Error('useDriverTheme must be used within DriverThemeProvider');
  return ctx;
}

/** Returns all driver UI colors for the current theme (light or dark). */
export function useDriverThemeColors() {
  const { theme } = useDriverTheme();
  return useMemo(() => getDriverThemeColors(theme), [theme]);
}

export function getDriverThemeColors(mode: DriverThemeMode) {
  const isDark = mode === 'dark';
  return {
    background: isDark ? Theme.driverBackground : Theme.screenBackground,
    surface: isDark ? Theme.driverSurface : Theme.surface,
    surfaceElevated: isDark ? Theme.driverSurfaceElevated : Theme.surfaceLight,
    border: isDark ? Theme.driverBorder : Theme.borderLight,
    borderSubtle: isDark ? Theme.driverBorderSubtle : Theme.borderLight,
    text: isDark ? Theme.textOnDark : Theme.textPrimary,
    textMuted: isDark ? Theme.driverTextMuted : Theme.textMuted,
    textOnPrimary: Theme.textOnPrimary,
    primary: Theme.driverPrimary,
    emerald: Theme.driverEmerald,
    emeraldDark: Theme.driverEmeraldDark,
    gold: Theme.driverGold,
    tabBarBg: isDark ? Theme.driverTabBarBg : Theme.surface,
    tabInactive: isDark ? Theme.driverTabInactive : Theme.textMuted,
    overlay: Theme.driverOverlay,
    overlayLight: Theme.driverOverlayLight,
    overlayHeavy: Theme.driverOverlayHeavy,
    whiteMuted: isDark ? Theme.driverWhiteMuted : Theme.surfaceGray,
    whiteMutedStrong: isDark ? Theme.driverWhiteMutedStrong : Theme.surfaceBorder,
    emeraldBorder: isDark ? Theme.driverEmeraldBorder : Theme.positiveMuted,
    emeraldMuted: isDark ? Theme.driverEmeraldMuted : Theme.positiveMuted,
    emeraldMutedText: Theme.driverEmerald,
    emeraldMutedText2: Theme.driverEmerald,
    emeraldBorderSoft: isDark ? Theme.driverEmeraldBorderSoft : Theme.positive,
    negativeMuted: Theme.negativeMuted,
    positiveMutedDark: isDark ? Theme.positiveMutedDark : Theme.positiveMuted,
    positiveMutedDarkBorder: isDark ? Theme.positiveMutedDarkBorder : Theme.positive,
    borderLight: isDark ? Theme.driverBorderLight : Theme.borderMedium,
    inputBg: isDark ? Theme.driverSurface : Theme.screenBackground,
    placeholder: isDark ? Theme.driverPlaceholder : Theme.placeholder,
  };
}

export function DriverThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<DriverThemeMode>(DEFAULT_THEME);
  const [mapTheme, setMapThemeState] = useState<MapThemeMode>(DEFAULT_MAP_THEME);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fallback = setTimeout(() => {
      if (!cancelled) setHydrated(true);
    }, 3_000);

    Promise.all([
      AsyncStorage.getItem(STORAGE_KEY),
      AsyncStorage.getItem(MAP_STORAGE_KEY),
    ])
      .then(([storedTheme, storedMap]) => {
        clearTimeout(fallback);
        if (cancelled) return;
        if (storedTheme === 'light' || storedTheme === 'dark') setThemeState(storedTheme);
        if (storedMap === 'light' || storedMap === 'dark' || storedMap === 'auto') setMapThemeState(storedMap as MapThemeMode);
        setHydrated(true);
      })
      .catch(() => {
        clearTimeout(fallback);
        if (!cancelled) setHydrated(true);
      });

    return () => {
      cancelled = true;
      clearTimeout(fallback);
    };
  }, []);

  const setTheme = (mode: DriverThemeMode) => {
    setThemeState(mode);
    AsyncStorage.setItem(STORAGE_KEY, mode);
  };

  const setMapTheme = (mode: MapThemeMode) => {
    setMapThemeState(mode);
    AsyncStorage.setItem(MAP_STORAGE_KEY, mode);
  };

  const value = useMemo(
    () => ({
      theme: hydrated ? theme : DEFAULT_THEME,
      setTheme,
      isDark: (hydrated ? theme : DEFAULT_THEME) === 'dark',
      mapTheme: hydrated ? mapTheme : DEFAULT_MAP_THEME,
      setMapTheme,
    }),
    [theme, mapTheme, hydrated]
  );

  return (
    <DriverThemeContext.Provider value={value}>
      {children}
    </DriverThemeContext.Provider>
  );
}
