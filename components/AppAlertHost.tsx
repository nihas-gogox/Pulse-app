import Theme from '@/constants/Theme';
import { tGlobal } from '@/contexts/LanguageContext';
import { registerAppAlertImplementation, type AppAlertOptions } from '@/lib/appAlert';
import { platformShadow } from '@/lib/platformShadow';
import { pe } from '@/lib/platformViewStyle.util';
import { WebOverlayPortal, webFixedFill } from '@/lib/webOverlayPortal';
import { Check } from 'lucide-react-native';
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
  const [tone, setTone] = useState<NonNullable<AppAlertOptions['tone']>>('neutral');
  const [showDismiss, setShowDismiss] = useState(true);
  const [actionLabel, setActionLabel] = useState<string | undefined>(undefined);
  const [fileNames, setFileNames] = useState<string[]>([]);

  const show = useCallback((nextTitle: string, nextMessage?: string, options?: AppAlertOptions) => {
    setTitle(nextTitle);
    const trimmed = nextMessage?.trim();
    setMessage(trimmed && trimmed.length > 0 ? trimmed : undefined);
    setTone(options?.tone === 'success' ? 'success' : 'neutral');
    setShowDismiss(options?.showDismiss !== false);
    setActionLabel(options?.actionLabel?.trim() || undefined);
    setFileNames(
      (options?.fileNames ?? []).map((name) => name.trim()).filter((name) => name.length > 0),
    );
    setVisible(true);
  }, []);

  const hide = useCallback(() => setVisible(false), []);

  useEffect(() => {
    registerAppAlertImplementation(show);
    return () => registerAppAlertImplementation(null);
  }, [show]);

  useEffect(() => {
    if (!visible || showDismiss) return;
    const timer = setTimeout(() => setVisible(false), 2800);
    return () => clearTimeout(timer);
  }, [visible, showDismiss, title, message, fileNames]);

  if (!visible) return null;

  const isSuccess = tone === 'success';

  const overlay = (
    <View style={[styles.backdrop, webFixedFill, pe('box-none')]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={hide} accessibilityRole="button" />
      <View
        style={[styles.card, isCompact && styles.cardCompact]}
        accessibilityRole="alert"
        accessibilityViewIsModal
      >
        <View style={[styles.iconWrap, isSuccess && styles.iconWrapSuccess]}>
          {isSuccess ? (
            <Check size={26} color={Theme.success} strokeWidth={2.75} />
          ) : (
            <Text style={styles.iconChar}>!</Text>
          )}
        </View>
        <Text style={styles.title}>{title}</Text>
        {fileNames.length > 0 ? (
          <View style={styles.fileList}>
            {fileNames.map((name, index) => (
              <Text
                key={`${name}-${index}`}
                style={styles.fileName}
                numberOfLines={2}
              >
                {name}
              </Text>
            ))}
          </View>
        ) : null}
        {message ? (
          <Text style={styles.body}>{message}</Text>
        ) : null}
        {showDismiss ? (
          <Pressable
            onPress={hide}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            accessibilityRole="button"
          >
            <Text style={styles.buttonLabel}>{actionLabel ?? tGlobal('dismiss')}</Text>
          </Pressable>
        ) : null}
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
    paddingBottom: 22,
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
  iconWrapSuccess: {
    backgroundColor: Theme.positiveMuted,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Theme.textPrimaryDark,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  fileList: {
    marginTop: 12,
    gap: 4,
    alignItems: 'center',
  },
  fileName: {
    fontSize: 15,
    fontWeight: '700',
    color: Theme.textPrimaryDark,
    textAlign: 'center',
    lineHeight: 21,
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
