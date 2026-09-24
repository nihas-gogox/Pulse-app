import { Alert, Platform } from 'react-native';

export type AppAlertImplementation = (title: string, message?: string) => void;

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
export function showAppAlert(title: string, message?: string): void {
  if (registeredImplementation) {
    registeredImplementation(title, message);
    return;
  }
  if (Platform.OS === 'web') {
    const body = message && message.trim().length > 0 ? `${title}\n\n${message}` : title;
    window.alert(body);
    return;
  }
  if (message != null && message.trim().length > 0) {
    Alert.alert(title, message);
  } else {
    Alert.alert(title);
  }
}
