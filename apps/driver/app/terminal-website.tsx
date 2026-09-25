/**
 * Hand-off (D20): the sign-up shell's "Pulse website" link pushes /terminal-website,
 * the main app's marketing page. The driver app opens that page instead of
 * bundling it — same destination as in the old in-app flow.
 */
import { AppLoadingSplash } from '@pulse/ui/components/AppLoadingSplash';
import { useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { openMainApp } from '../lib/openMainApp';
import { DRIVER_ROUTES } from '../lib/routes';

export default function TerminalWebsiteHandOff() {
  const router = useRouter();
  useEffect(() => {
    openMainApp('/terminal-website');
    if (Platform.OS === 'web') return; // the page is being replaced
    if (router.canGoBack()) router.back();
    else router.replace(DRIVER_ROUTES.HOME as Href);
  }, [router]);
  return <AppLoadingSplash variant="generic" />;
}
