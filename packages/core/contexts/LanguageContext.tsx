/**
 * App language (i18n). Persisted to AsyncStorage (@pulse/locale); use t(key) for global translations.
 * Default order: 1) User selected (stored), 2) Device language (expo-localization if available), 3) English.
 * To sync with backend: when API supports users.language_preference, persist setLocale() there too.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  type AppLocale,
  DEFAULT_LOCALE,
  getDefaultLocale,
  getTranslation,
  LOCALE_OPTIONS,
} from "../lib/i18n";

const STORAGE_KEY = "@pulse/locale";

type LanguageContextType = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  t: (key: string) => string;
  localeOptions: typeof LOCALE_OPTIONS;
  hydrated: boolean;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}

/** Safe for boot shells / global hosts that may render before the provider tree mounts. */
export function useOptionalLanguage() {
  const ctx = useContext(LanguageContext);
  return useMemo(
    () => ({
      locale: ctx?.locale ?? DEFAULT_LOCALE,
      setLocale: ctx?.setLocale ?? (() => {}),
      t: (key: string) => (ctx ? ctx.t(key) : tGlobal(key)),
      localeOptions: ctx?.localeOptions ?? LOCALE_OPTIONS,
      hydrated: ctx?.hydrated ?? true,
    }),
    [ctx],
  );
}

/** Translation function for use outside components (e.g. in non-React code). Prefer useLanguage().t inside components. */
let globalLocale: AppLocale = DEFAULT_LOCALE;
export function setGlobalLocale(locale: AppLocale) {
  globalLocale = locale;
}
export function tGlobal(key: string): string {
  return getTranslation(key, globalLocale);
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(DEFAULT_LOCALE);
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
        const next = getDefaultLocale(stored);
        setLocaleState(next);
        setGlobalLocale(next);
        if (!stored) void AsyncStorage.setItem(STORAGE_KEY, next);
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

  const setLocale = useCallback((next: AppLocale) => {
    setLocaleState(next);
    setGlobalLocale(next);
    AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const t = useCallback(
    (key: string) => getTranslation(key, hydrated ? locale : DEFAULT_LOCALE),
    [locale, hydrated]
  );

  const value = useMemo(
    () => ({
      locale: hydrated ? locale : DEFAULT_LOCALE,
      setLocale,
      t,
      localeOptions: LOCALE_OPTIONS,
      hydrated,
    }),
    [locale, setLocale, t, hydrated]
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}
