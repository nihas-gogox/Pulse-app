import Theme from '@/constants/Theme';
import { tGlobal } from '@/contexts/LanguageContext';
import { registerAppAlertImplementation } from '@/lib/appAlert';
import { platformShadow } from '@/lib/platformShadow';
import { pe } from '@/lib/platformViewStyle.util';
import { WebOverlayPortal, webFixedFill } from '@/lib/webOverlayPortal';
import { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

/**
 * Single themed alert modal for `showAppAlert`, aligned with Network profile modal styling.
 */
export function AppAlertHost() {
  const { width } = useWindowDimensions();
  const isCompact = width < 420;

  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState<string | undefined>(undefined);

  const show = useCallback((nextTitle: string, nextMessage?: string) => {
    setTitle(nextTitle);
    const trimmed = nextMessage?.trim();
    setMessage(trimmed && trimmed.length > 0 ? trimmed : undefined);
    setVisible(true);
  }, []);

  const hide = useCallback(() => setVisible(false), []);

  useEffect(() => {
    registerAppAlertImplementation(show);
    return () => registerAppAlertImplementation(null);
  }, [show]);

  if (!visible) return null;

  const overlay = (
    <View style={[styles.backdrop, webFixedFill, pe('box-none')]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={hide} accessibilityRole="button" />
      <View
        style={[styles.card, isCompact && styles.cardCompact]}
        accessibilityRole="alert"
        accessibilityViewIsModal
      >
        <View style={styles.iconWrap}>
          <Text style={styles.iconChar}>!</Text>
        </View>
        <Text style={styles.title}>{title}</Text>
        {message ? (
          <Text style={styles.body}>{message}</Text>
        ) : null}
        <Pressable
          onPress={hide}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          accessibilityRole="button"
        >
          <Text style={styles.buttonLabel}>{tGlobal('dismiss')}</Text>
        </Pressable>
      </View>
    </View>
  );

  if (Platform.OS === 'web') {
    return <WebOverlayPortal>{overlay}</WebOverlayPortal>;
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={hide}>
      {overlay}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.58)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  card: {
    alignSelf: 'center',
    width: 380,
    maxWidth: '100%',
    zIndex: 1,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: Theme.borderLight,
    backgroundColor: Theme.networkPageBackground,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 20,
    alignItems: 'stretch',
    ...platformShadow('0 16px 28px rgba(15, 23, 42, 0.18)', {
      color: Theme.shadow,
      opacity: 0.18,
      radius: 28,
      offsetY: 16,
      elevation: 8,
    }),
  },
  cardCompact: {
    width: '100%',
    borderRadius: 24,
    paddingHorizontal: 18,
  },
  iconWrap: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Theme.modalNeutralIconWash,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Theme.textPrimaryDark,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  body: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: '500',
    color: Theme.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  button: {
    marginTop: 22,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Theme.modalNeutralAccent,
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Theme.buttonMatteBlackText,
  },
  iconChar: {
    fontSize: 22,
    fontWeight: '700',
    color: Theme.modalNeutralAccent,
    includeFontPadding: false,
  },
});
