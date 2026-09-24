/**
 * Shown when a signed-in user is not a driver (driver extraction, Phase 3).
 * Pulse Driver is for drivers only; everyone else uses the main Pulse app.
 */
import Theme from '@pulse/core/constants/Theme';
import { useAuth } from '@pulse/domain/contexts/AuthContext';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MAIN_APP_URL } from '../lib/routes';

function openMainApp() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.assign(MAIN_APP_URL);
    return;
  }
  void Linking.openURL(MAIN_APP_URL);
}

export function NotDriverScreen() {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <Text style={styles.title}>This app is for drivers</Text>
      <Text style={styles.body}>
        Your account isn&apos;t a driver account. Use the Pulse app to manage your business.
      </Text>
      <Pressable accessibilityRole="link" onPress={openMainApp} style={[styles.button, styles.primary]}>
        <Text style={styles.primaryText}>Go to Pulse</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        disabled={signingOut}
        onPress={() => {
          setSigningOut(true);
          void signOut().finally(() => setSigningOut(false));
        }}
        style={[styles.button, styles.secondary]}
      >
        <Text style={styles.secondaryText}>{signingOut ? 'Signing out…' : 'Sign out'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: Theme.screenBackground,
  },
  title: { fontSize: 22, fontWeight: '700', color: Theme.textPrimary, marginBottom: 12 },
  body: { fontSize: 15, lineHeight: 22, color: Theme.textSecondary, marginBottom: 28 },
  button: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  primary: { backgroundColor: Theme.primary },
  primaryText: { color: Theme.screenBackground, fontSize: 16, fontWeight: '600' },
  secondary: { borderWidth: 1, borderColor: Theme.textSecondary },
  secondaryText: { color: Theme.textPrimary, fontSize: 16, fontWeight: '600' },
});
