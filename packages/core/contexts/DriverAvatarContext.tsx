/**
 * Persisted avatar seed for driver app (reference: Visual Verification / Select Avatar Node).
 * Ensures avatar image is never blank; default 'driver-1'.
 */
import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'driver_avatar_seed';
const DEFAULT_SEED = 'driver-1';

type DriverAvatarContextType = {
  avatarSeed: string;
  setAvatarSeed: (seed: string) => void;
  /** Local preview after pick/upload — cleared when profile.avatar_url resolves. */
  previewUri: string | null;
  setPreviewUri: (uri: string | null) => void;
};

const DriverAvatarContext = createContext<DriverAvatarContextType | undefined>(undefined);

export function useDriverAvatar() {
  const ctx = useContext(DriverAvatarContext);
  if (!ctx) throw new Error('useDriverAvatar must be used within DriverAvatarProvider');
  return ctx;
}

export function useOptionalDriverAvatar() {
  return useContext(DriverAvatarContext);
}

export function DriverAvatarProvider({ children }: { children: ReactNode }) {
  const [avatarSeed, setAvatarSeedState] = useState(DEFAULT_SEED);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fallback = setTimeout(() => {
      if (!cancelled) setHydrated(true);
    }, 3_000);

    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        clearTimeout(fallback);
        if (cancelled) return;
        if (stored) setAvatarSeedState(stored);
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

  const setAvatarSeed = (seed: string) => {
    setAvatarSeedState(seed);
    AsyncStorage.setItem(STORAGE_KEY, seed);
  };

  return (
    <DriverAvatarContext.Provider
      value={{
        avatarSeed: hydrated ? avatarSeed : DEFAULT_SEED,
        setAvatarSeed,
        previewUri,
        setPreviewUri,
      }}
    >
      {children}
    </DriverAvatarContext.Provider>
  );
}
