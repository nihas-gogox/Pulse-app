/**
 * App language (i18n). All user-visible text is loaded from locale JSON files.
 * Use t(key) via useLanguage() for dynamic, translatable UI. No hardcoded English in UI.
 *
 * Priority 1 – India: en, hi, ta, te, kn, ml, mr, bn, gu, pa, or
 * Priority 2 – Southeast Asia: id, th, vi, ms, fil, my
 * Default fallback: English. RTL-ready for future (e.g. Arabic).
 */

export const SUPPORTED_LOCALES = [
  "en",
  "hi",
  "ta",
  "te",
  "kn",
  "ml",
  "mr",
  "bn",
  "gu",
  "pa",
  "or",
  "id",
  "th",
  "vi",
  "ms",
  "fil",
  "my",
  "zh",
  "ko",
  "si",
  "ne",
  "ar",
] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "en";

/** Region for grouping in language picker. */
export type LocaleRegion = "india" | "southeast_asia" | "other";

export interface LocaleOption {
  value: AppLocale;
  label: string;
  labelNative: string;
  region: LocaleRegion;
}

/** All locales with English label, native label, and region. Used in Language Settings UI. */
export const LOCALE_OPTIONS: LocaleOption[] = [
  // Priority 1 – India
  { value: "en", label: "English", labelNative: "English", region: "india" },
  { value: "hi", label: "Hindi", labelNative: "हिन्दी", region: "india" },
  { value: "ta", label: "Tamil", labelNative: "தமிழ்", region: "india" },
  { value: "te", label: "Telugu", labelNative: "తెలుగు", region: "india" },
  { value: "kn", label: "Kannada", labelNative: "ಕನ್ನಡ", region: "india" },
  { value: "ml", label: "Malayalam", labelNative: "മലയാളം", region: "india" },
  { value: "mr", label: "Marathi", labelNative: "मराठी", region: "india" },
  { value: "bn", label: "Bengali", labelNative: "বাংলা", region: "india" },
  { value: "gu", label: "Gujarati", labelNative: "ગુજરાતી", region: "india" },
  { value: "pa", label: "Punjabi", labelNative: "ਪੰਜਾਬੀ", region: "india" },
  { value: "or", label: "Odia", labelNative: "ଓଡ଼ିଆ", region: "india" },
  // Priority 2 – Southeast Asia
  { value: "id", label: "Indonesian", labelNative: "Bahasa Indonesia", region: "southeast_asia" },
  { value: "th", label: "Thai", labelNative: "ไทย", region: "southeast_asia" },
  { value: "vi", label: "Vietnamese", labelNative: "Tiếng Việt", region: "southeast_asia" },
  { value: "ms", label: "Malay", labelNative: "Bahasa Melayu", region: "southeast_asia" },
  { value: "fil", label: "Filipino", labelNative: "Tagalog", region: "southeast_asia" },
  { value: "my", label: "Burmese", labelNative: "ဗမာစာ", region: "southeast_asia" },
  // Other (Mandarin, Korean, Sinhala, Nepali, Arabic — for Singapore, China, Korea, Sri Lanka, Nepal, UAE, etc.)
  { value: "zh", label: "Chinese (Mandarin)", labelNative: "中文", region: "other" },
  { value: "ko", label: "Korean", labelNative: "한국어", region: "other" },
  { value: "si", label: "Sinhala", labelNative: "සිංහල", region: "other" },
  { value: "ne", label: "Nepali", labelNative: "नेपाली", region: "other" },
  { value: "ar", label: "Arabic", labelNative: "العربية", region: "other" },
];

/** Translation bundles loaded from /locales/{locale}.json. English is fallback. */
const localeBundles: Record<AppLocale, Record<string, string>> = {
  en: require("@/locales/en.json"),
  hi: require("@/locales/hi.json"),
  ta: require("@/locales/ta.json"),
  te: require("@/locales/te.json"),
  kn: require("@/locales/kn.json"),
  ml: require("@/locales/ml.json"),
  mr: require("@/locales/mr.json"),
  bn: require("@/locales/bn.json"),
  gu: require("@/locales/gu.json"),
  pa: require("@/locales/pa.json"),
  or: require("@/locales/or.json"),
  id: require("@/locales/id.json"),
  th: require("@/locales/th.json"),
  vi: require("@/locales/vi.json"),
  ms: require("@/locales/ms.json"),
  fil: require("@/locales/fil.json"),
  my: require("@/locales/my.json"),
  zh: require("@/locales/zh.json"),
  ko: require("@/locales/ko.json"),
  si: require("@/locales/si.json"),
  ne: require("@/locales/ne.json"),
  ar: require("@/locales/ar.json"),
};

export function getTranslation(key: string, locale: AppLocale): string {
  const bundle = localeBundles[locale];
  const enBundle = localeBundles.en;
  if (!enBundle) return key;
  // If bundle is empty or missing, fall back to English
  if (!bundle || Object.keys(bundle).length === 0) return enBundle[key] ?? key;
  return bundle[key] ?? enBundle[key] ?? key;
}

export function isSupportedLocale(code: string): code is AppLocale {
  return SUPPORTED_LOCALES.includes(code as AppLocale);
}

/** Map device language code (e.g. from expo-localization) to AppLocale. Returns null if unsupported. */
export function deviceLanguageToLocale(deviceLanguageCode: string | undefined): AppLocale | null {
  if (!deviceLanguageCode || typeof deviceLanguageCode !== "string") return null;
  const code = deviceLanguageCode.toLowerCase().slice(0, 2);
  // Map common codes (some devices use 3-letter or region suffixes)
  const map: Record<string, AppLocale> = {
    en: "en",
    hi: "hi",
    ta: "ta",
    te: "te",
    kn: "kn",
    ml: "ml",
    mr: "mr",
    bn: "bn",
    gu: "gu",
    pa: "pa",
    or: "or",
    id: "id",
    th: "th",
    vi: "vi",
    ms: "ms",
    tl: "fil", // Filipino/Tagalog
    fil: "fil",
    my: "my",
    zh: "zh",
    ko: "ko",
    si: "si",
    ne: "ne",
    ar: "ar",
  };
  return map[code] ?? (isSupportedLocale(code) ? (code as AppLocale) : null);
}

/**
 * Get preferred locale: 1) stored (passed in), 2) device language (if expo-localization available), 3) English.
 * Call from LanguageContext on first load when no stored value.
 */
export function getDefaultLocale(stored: string | null): AppLocale {
  if (stored && isSupportedLocale(stored)) return stored;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- optional native module, guarded by try/catch
    const { getLocales } = require("expo-localization");
    const device = getLocales?.()?.[0]?.languageCode;
    const mapped = deviceLanguageToLocale(device);
    if (mapped) return mapped;
  } catch {
    // expo-localization not installed or getLocales unavailable
  }
  return DEFAULT_LOCALE;
}
