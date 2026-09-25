import { Platform } from 'react-native';

import { isIgnorableSupabaseAuthLockError } from './supabaseAuthLock.util';

const SUPPRESSED_WARN_PREFIXES = [
  '"shadow*" style props are deprecated',
  '"textShadow*" style props are deprecated',
  'props.pointerEvents is deprecated',
  'Require cycle:',
  'No route named "add-commodity-type"',
  '@supabase/gotrue-js: Lock "lock:sb-',
  'was not released within',
  '`useNativeDriver` is not supported because the native animated module is missing',
  'Reduced motion setting is enabled on this device',
] as const;

let installed = false;

/** Mute known RN Web / Metro dev noise in the browser console (web only). */
export function installDevConsoleFilters(): void {
  if (!__DEV__ || Platform.OS !== 'web' || installed) return;
  if (typeof console === 'undefined') return;
  installed = true;

  const originalWarn = console.warn.bind(console);
  const originalError = console.error?.bind(console);
  const shouldSuppress = (text: string) =>
    SUPPRESSED_WARN_PREFIXES.some((prefix) => text.includes(prefix)) ||
    isIgnorableSupabaseAuthLockError(new Error(text));

  console.warn = (...args: unknown[]) => {
    const text = args
      .map((arg) => {
        if (typeof arg === 'string') return arg;
        if (arg instanceof Error) return arg.message;
        if (arg != null && typeof arg === 'object' && 'message' in arg) {
          return String((arg as { message: unknown }).message);
        }
        return '';
      })
      .join(' ');
    if (shouldSuppress(text)) {
      return;
    }
    originalWarn(...args);
  };

  if (originalError) {
    console.error = (...args: unknown[]) => {
      const text = args
        .map((arg) => (typeof arg === 'string' ? arg : ''))
        .join(' ');
      if (shouldSuppress(text)) {
        return;
      }
      originalError(...args);
    };
  }
}
