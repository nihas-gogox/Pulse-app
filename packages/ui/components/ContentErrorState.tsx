/**
 * Polished load/error fallback — icon, human copy, retry, optional dev stack (accordion).
 */
import Theme from '@pulse/core/constants/Theme';
import { CONTENT_ERROR_ILLUSTRATIONS } from '@pulse/core/lib/contentErrorIllustrations';
import * as Clipboard from 'expo-clipboard';
import type { LucideIcon } from 'lucide-react-native';
import {
  AlertCircle,
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  Compass,
  Copy,
  Package,
  RefreshCw,
  Rss,
  Settings,
  Terminal,
  WifiOff,
} from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

export type ContentErrorVariant =
  | 'network'
  | 'connection'
  | 'config'
  | 'update'
  | 'workspace'
  | 'workspaceMissing'
  | 'discover'
  | 'loads'
  | 'feed'
  | 'generic';

type VariantPreset = {
  Icon: LucideIcon;
  title: string;
  message: string;
  accent: string;
};

const VARIANT_PRESETS: Record<ContentErrorVariant, VariantPreset> = {
  network: {
    Icon: WifiOff,
    title: 'Unable to load content',
    message:
      'We encountered an unexpected issue while setting up this panel. Please check your connection.',
    accent: Theme.brandBlueInk,
  },
  connection: {
    Icon: WifiOff,
    title: 'Connection error',
    message:
      "Cannot reach the server. If you're on home or office Wi‑Fi, try mobile data or a different network.",
    accent: Theme.brandBlueInk,
  },
  config: {
    Icon: Settings,
    title: 'App not configured',
    message:
      'Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env, then restart the dev server.',
    accent: Theme.warning,
  },
  update: {
    Icon: RefreshCw,
    title: 'Update available',
    message: 'A new version was deployed. Reload to continue.',
    accent: Theme.primary,
  },
  workspace: {
    Icon: Building2,
    title: 'Connection issue',
    message: "Couldn't load your workspace. Check your connection and try again.",
    accent: Theme.primary,
  },
  workspaceMissing: {
    Icon: Building2,
    title: 'No organization linked',
    message:
      "You're signed in, but we couldn't find an organization for this account yet.",
    accent: Theme.textSecondary,
  },
  discover: {
    Icon: Compass,
    title: 'Unable to load suggestions',
    message: "Discover couldn't refresh right now. Try again in a moment.",
    accent: Theme.aggregatePillText,
  },
  loads: {
    Icon: Package,
    title: 'Unable to load loads',
    message: 'The load board could not refresh. Check your connection or try again.',
    accent: Theme.primary,
  },
  feed: {
    Icon: Rss,
    title: "Couldn't load feed",
    message: 'Client updates are temporarily unavailable. Pull to refresh or try again.',
    accent: Theme.primary,
  },
  generic: {
    Icon: AlertCircle,
    title: 'Something went wrong',
    message: 'An unexpected error occurred. Please try again.',
    accent: Theme.textSecondary,
  },
};

export type ContentErrorStateProps = {
  variant: ContentErrorVariant;
  title?: string;
  message?: string;
  technicalDetails?: string | null;
  onRetry?: () => void;
  retryLabel?: string;
  retrying?: boolean;
  /** Light panels vs root / sign-in style screens */
  tone?: 'light' | 'dark';
  /** full = centered panel; inline = compact strip; embedded = flex fill */
  layout?: 'full' | 'inline' | 'embedded';
  showTechnicalDetails?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function ContentErrorState({
  variant,
  title,
  message,
  technicalDetails,
  onRetry,
  retryLabel = 'Try again',
  retrying = false,
  tone = 'light',
  layout = 'embedded',
  showTechnicalDetails = __DEV__,
  style,
}: ContentErrorStateProps) {
  const preset = VARIANT_PRESETS[variant];
  const { Icon, accent } = preset;
  const illustration = CONTENT_ERROR_ILLUSTRATIONS[variant];
  const Illustration = illustration.Component;
  const resolvedTitle = title ?? preset.title;
  const resolvedMessage = message ?? preset.message;
  const [devOpen, setDevOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const isDark = tone === 'dark';
  const canShowDev =
    showTechnicalDetails && Boolean(technicalDetails?.trim());
  const isInline = layout === 'inline';
  const useBannerLayout = false;

  const toggleDev = useCallback(() => {
    setDevOpen((v) => !v);
  }, []);

  const handleCopy = useCallback(() => {
    if (!technicalDetails) return;
    void Clipboard.setStringAsync(technicalDetails).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [technicalDetails]);

  const palette = useMemo(
    () =>
      isDark
        ? {
            bg: Theme.darkBackground,
            title: Theme.textOnDark,
            body: Theme.textOnDarkMuted,
            card: Theme.darkSurface,
            cardBorder: Theme.borderOnDark,
            btn: Theme.buttonPrimary,
            btnText: Theme.buttonPrimaryText,
            terminalBg: '#0D1117',
            terminalBorder: '#30363d',
            terminalLabel: '#8b949e',
            terminalText: '#f85149',
            devToggle: Theme.textOnDarkMuted,
          }
        : {
            bg: '#F8FAFC',
            title: Theme.textPrimaryDark,
            body: Theme.textSecondary,
            card: Theme.screenBackground,
            cardBorder: Theme.borderLight,
            btn: Theme.textPrimaryDark,
            btnText: Theme.textOnPrimary,
            terminalBg: '#0D1117',
            terminalBorder: '#1e293b',
            terminalLabel: '#94a3b8',
            terminalText: '#fda4af',
            devToggle: Theme.textMuted,
          },
    [isDark],
  );

  if (isInline) {
    return (
      <View style={[styles.inlineRoot, style]}>
        <View style={[styles.inlineInner, styles.inlineCard]}>
          <View style={[styles.inlineIconWrap, { backgroundColor: `${accent}14` }]}>
            <Icon size={18} color={accent} strokeWidth={2} />
          </View>
          <View style={styles.inlineCopy}>
            <Text style={[styles.inlineTitle, { color: palette.title }]}>
              {resolvedTitle}
            </Text>
            <Text style={[styles.inlineMessage, { color: palette.body }]}>
              {resolvedMessage}
            </Text>
          </View>
          {onRetry ? (
            <Pressable
              style={({ pressed }) => [
                styles.inlineBtn,
                { backgroundColor: palette.btn, opacity: pressed ? 0.92 : 1 },
                retrying && styles.retryBtnBusy,
              ]}
              onPress={onRetry}
              disabled={retrying}
              accessibilityRole="button"
              accessibilityLabel={retryLabel}
            >
              {retrying ? (
                <ActivityIndicator size="small" color={palette.btnText} />
              ) : (
                <>
                  <RefreshCw size={14} color={palette.btnText} />
                  <Text style={[styles.retryBtnText, { color: palette.btnText }]}>
                    {retrying ? 'Trying again…' : retryLabel}
                  </Text>
                </>
              )}
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[
        layout === 'full' ? styles.fullRoot : styles.embeddedRoot,
        { backgroundColor: palette.bg },
      ]}
      style={[{ backgroundColor: palette.bg }, style]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View
        style={[
          styles.bannerCard,
          {
            backgroundColor: palette.card,
            borderColor: palette.cardBorder,
          },
          useBannerLayout && styles.bannerCardWide,
        ]}
      >
        <View
          style={[
            styles.bannerBody,
            useBannerLayout ? styles.bannerBodyWide : styles.bannerBodyStacked,
          ]}
        >
          <View
            style={[
              styles.illusBackdrop,
              { backgroundColor: `${accent}12` },
              useBannerLayout ? styles.illusBackdropWide : styles.illusBackdropStacked,
            ]}
          >
            <Illustration
              width={useBannerLayout ? illustration.width : illustration.width * 0.85}
              height={useBannerLayout ? illustration.height : illustration.height * 0.85}
              accessibilityLabel=""
            />
          </View>

          <View style={[styles.contentCol, useBannerLayout && styles.contentColWide]}>
            <View style={styles.badgeRow}>
              <View style={[styles.iconBadge, { backgroundColor: `${accent}18` }]}>
                <Icon size={18} color={accent} strokeWidth={2} />
              </View>
              <Text style={[styles.eyebrow, { color: accent }]}>Error</Text>
            </View>

            <Text
              style={[
                styles.title,
                { color: palette.title },
                useBannerLayout && styles.titleWide,
              ]}
            >
              {resolvedTitle}
            </Text>
            <Text
              style={[
                styles.message,
                { color: palette.body },
                useBannerLayout && styles.messageWide,
              ]}
            >
              {resolvedMessage}
            </Text>

            {onRetry ? (
              <Pressable
                style={({ pressed }) => [
                  styles.retryBtn,
                  useBannerLayout && styles.retryBtnWide,
                  { backgroundColor: palette.btn, opacity: pressed ? 0.92 : 1 },
                  retrying && styles.retryBtnBusy,
                ]}
                onPress={onRetry}
                disabled={retrying}
                accessibilityRole="button"
                accessibilityLabel={retryLabel}
              >
                {retrying ? (
                  <ActivityIndicator size="small" color={palette.btnText} />
                ) : (
                  <>
                    <RefreshCw size={18} color={palette.btnText} />
                    <Text style={[styles.retryBtnText, { color: palette.btnText }]}>
                      {retrying ? 'Trying again…' : retryLabel}
                    </Text>
                  </>
                )}
              </Pressable>
            ) : null}
          </View>
        </View>

        {canShowDev ? (
          <View
            style={[
              styles.devFooter,
              { borderTopColor: palette.cardBorder },
            ]}
          >
            <Pressable
              style={styles.devToggle}
              onPress={toggleDev}
              accessibilityRole="button"
              accessibilityLabel="Technical details"
            >
              <Terminal size={14} color={palette.devToggle} />
              <Text style={[styles.devToggleText, { color: palette.devToggle }]}>
                Technical Details
              </Text>
              {devOpen ? (
                <ChevronUp size={14} color={palette.devToggle} />
              ) : (
                <ChevronDown size={14} color={palette.devToggle} />
              )}
            </Pressable>

            {devOpen ? (
              <View
                style={[
                  styles.terminal,
                  {
                    backgroundColor: palette.terminalBg,
                    borderColor: palette.terminalBorder,
                  },
                ]}
              >
                <View style={styles.terminalHeader}>
                  <View style={styles.terminalLabelRow}>
                    <View style={styles.terminalDot} />
                    <Text style={[styles.terminalType, { color: palette.terminalLabel }]}>
                      TypeError
                    </Text>
                  </View>
                  <Pressable
                    onPress={handleCopy}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Copy stack trace"
                  >
                    {copied ? (
                      <Check size={14} color="#34d399" />
                    ) : (
                      <Copy size={14} color={palette.terminalLabel} />
                    )}
                  </Pressable>
                </View>
                <ScrollView
                  style={styles.terminalScroll}
                  showsVerticalScrollIndicator
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                >
                  <Text
                    selectable
                    style={[styles.terminalBody, { color: palette.terminalText }]}
                  >
                    {technicalDetails}
                  </Text>
                </ScrollView>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fullRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  embeddedRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
    minHeight: 220,
  },
  inlineRoot: {
    marginHorizontal: 14,
    marginBottom: 10,
  },
  bannerCard: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowColor: Theme.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  bannerCardWide: {
    maxWidth: 480,
  },
  bannerBody: {
    width: '100%',
  },
  bannerBodyWide: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerBodyStacked: {
    alignItems: 'center',
  },
  illusBackdrop: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  illusBackdropWide: {
    flex: 0,
    width: 240,
    minHeight: 200,
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  illusBackdropStacked: {
    width: '100%',
    paddingTop: 20,
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  contentCol: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 10,
  },
  contentColWide: {
    flex: 1,
    alignItems: 'flex-start',
    paddingTop: 24,
    paddingRight: 24,
    minWidth: 0,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  inlineInner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: Theme.screenBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.borderLight,
  },
  inlineCard: {
    width: '100%',
  },
  inlineIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  titleWide: {
    textAlign: 'left',
    alignSelf: 'stretch',
  },
  inlineTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 320,
  },
  messageWide: {
    textAlign: 'left',
    alignSelf: 'stretch',
    maxWidth: undefined,
  },
  inlineMessage: {
    fontSize: 12,
    lineHeight: 17,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    maxWidth: 280,
    marginTop: 6,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  retryBtnWide: {
    alignSelf: 'flex-start',
    maxWidth: 220,
  },
  inlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignSelf: 'flex-start',
    width: '100%',
  },
  retryBtnBusy: {
    opacity: 0.85,
  },
  retryBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  devFooter: {
    width: '100%',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  devToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  devToggleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  terminal: {
    marginBottom: 4,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  terminalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#30363d',
  },
  terminalLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  terminalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Theme.teslaRed,
  },
  terminalType: {
    fontSize: 11,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontWeight: '600',
  },
  terminalScroll: {
    maxHeight: 200,
  },
  terminalBody: {
    fontSize: 11,
    lineHeight: 17,
    padding: 12,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
});
