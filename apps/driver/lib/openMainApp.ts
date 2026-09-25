/** Opens a main Pulse app page (NotDriverScreen, /terminal-website hand-off). */
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { mainAppHref } from './routes';

export function openMainApp(pathname = '/'): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const baseUrl = Constants.expoConfig?.experiments?.baseUrl;
    window.location.assign(mainAppHref(pathname, { origin: window.location.origin, baseUrl }));
    return;
  }
  void Linking.openURL(mainAppHref(pathname));
}
