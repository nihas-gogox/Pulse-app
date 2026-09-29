import { Alert, Platform } from 'react-native';

export type AppAlertOptions = {
  /** Neutral keeps the warning mark. Success uses a green check. */
  tone?: 'neutral' | 'success';
  /** When false, the action button is omitted. Tapping outside still closes it. */
  showDismiss?: boolean;
  /** Action button label. Defaults to Dismiss. */
  actionLabel?: string;
  /** Uploaded file names shown on a success confirmation. */
  fileNames?: string[];
};

export type AppAlertImplementation = (
  title: string,
  message?: string,
  options?: AppAlertOptions,
) => void;

let registeredImplementation: AppAlertImplementation | null = null;

/**
 * Registers the in-app themed alert UI (see `AppAlertHost`). When unset, falls
 * back to `window.alert` on web and `Alert.alert` on native.
 */
export function registerAppAlertImplementation(impl: AppAlertImplementation | null): void {
  registeredImplementation = impl;
}

/**
 * User-visible alert that works on native and web. When `AppAlertHost` is
 * mounted, uses the themed modal (replacing unstyled browser dialogs on web).
 */
function alertBody(title: string, message?: string, options?: AppAlertOptions): string {
  const names = (options?.fileNames ?? []).map((name) => name.trim()).filter(Boolean);
  const parts = [title];
  if (names.length > 0) parts.push(names.join('\n'));
  if (message && message.trim().length > 0) parts.push(message.trim());
  return parts.join('\n\n');
}

export function showAppAlert(
  title: string,
  message?: string,
  options?: AppAlertOptions,
): void {
  if (registeredImplementation) {
    registeredImplementation(title, message, options);
    return;
  }
  const body = alertBody(title, message, options);
  if (Platform.OS === 'web') {
    window.alert(body);
    return;
  }
  const detail = body.startsWith(title) ? body.slice(title.length).replace(/^\n+/, '') : body;
  if (detail) {
    Alert.alert(title, detail);
  } else {
    Alert.alert(title);
  }
}
