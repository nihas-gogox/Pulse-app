import { DriverBrandMark } from '../../../components/driver/DriverBrandMark';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import Theme from '@pulse/core/constants/Theme';
import {
  DRIVER_DETAIL_HORIZONTAL_PAD,
  DriverSubScreenHeader,
  driverDetailPageBackground,
} from '../../../components/driver/DriverSubScreenHeader';
import { useDriverTheme, useDriverThemeColors } from '@pulse/ui/contexts/DriverThemeContext';
import { useAuth } from '@pulse/domain/contexts/AuthContext';
import { ROUTES } from '@pulse/core/lib/routes';

export default function DriverSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { theme: uiTheme, setTheme, mapTheme, setMapTheme } = useDriverTheme();
  const isDark = uiTheme === 'dark';
  const colors = useDriverThemeColors();
  const pageBg = driverDetailPageBackground(isDark, colors.background);

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(driver)/profile');
  };
  const { signOut } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.replace(ROUTES.SIGN_IN_DIRECT);
  };

  return (
    <View style={[styles.root, { backgroundColor: pageBg }]}>
      <DriverSubScreenHeader title="Settings" subtitle="Appearance & app info" onBack={handleBack} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingHorizontal: DRIVER_DETAIL_HORIZONTAL_PAD,
          paddingBottom: insets.bottom + 80,
          paddingTop: 16,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              setTimeout(() => setRefreshing(false), 400);
            }}
            tintColor={colors.emerald}
          />
        }
      >
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionEyebrow, { color: colors.textMuted }]}>Appearance</Text>
          <View style={[styles.themeRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>Theme</Text>
            <View style={[styles.themeToggle, { backgroundColor: colors.whiteMuted, borderColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.themeToggleHalf, uiTheme === 'light' && { backgroundColor: colors.emerald }]}
                onPress={() => setTheme('light')}
                activeOpacity={0.8}
                accessibilityLabel="Light theme"
                accessibilityState={{ selected: uiTheme === 'light' }}
              >
                <FontAwesome name="sun-o" size={18} color={uiTheme === 'light' ? colors.textOnPrimary : colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.themeToggleHalf, uiTheme === 'dark' && { backgroundColor: colors.emerald }]}
                onPress={() => setTheme('dark')}
                activeOpacity={0.8}
                accessibilityLabel="Dark theme"
                accessibilityState={{ selected: uiTheme === 'dark' }}
              >
                <FontAwesome name="moon-o" size={18} color={uiTheme === 'dark' ? colors.textOnPrimary : colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={[styles.themeRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>Map style</Text>
            <View style={[styles.mapThemeToggle, { backgroundColor: colors.whiteMuted, borderColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.mapToggleThird, mapTheme === 'light' && { backgroundColor: colors.emerald }]}
                onPress={() => setMapTheme('light')}
                activeOpacity={0.8}
                accessibilityLabel="Light Map"
              >
                <FontAwesome name="sun-o" size={14} color={mapTheme === 'light' ? colors.textOnPrimary : colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.mapToggleThird, mapTheme === 'auto' && { backgroundColor: colors.emerald }]}
                onPress={() => setMapTheme('auto')}
                activeOpacity={0.8}
                accessibilityLabel="Auto Map"
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: mapTheme === 'auto' ? colors.textOnPrimary : colors.textMuted }}>Auto</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.mapToggleThird, mapTheme === 'dark' && { backgroundColor: colors.emerald }]}
                onPress={() => setMapTheme('dark')}
                activeOpacity={0.8}
                accessibilityLabel="Dark Map"
              >
                <FontAwesome name="moon-o" size={14} color={mapTheme === 'dark' ? colors.textOnPrimary : colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionEyebrow, { color: colors.textMuted }]}>About</Text>
          <View style={[styles.row, { borderTopColor: colors.border }]}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>App</Text>
            <DriverBrandMark color={colors.textMuted} style={{ marginBottom: 0 }} />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.signOutBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={handleSignOut}
          activeOpacity={0.8}
        >
          <FontAwesome name="sign-out" size={20} color={Theme.negative} />
          <Text style={[styles.signOutText, { color: Theme.negative }]}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  section: {
    borderRadius: 28,
    borderWidth: 1,
    marginBottom: 18,
    overflow: 'hidden',
  },
  sectionEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  themeToggle: {
    flexDirection: 'row',
    width: 88,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'stretch',
  },
  themeToggleHalf: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapThemeToggle: {
    flexDirection: 'row',
    width: 130,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'stretch',
  },
  mapToggleThird: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    borderRadius: 28,
    borderWidth: 1,
    marginTop: 8,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
