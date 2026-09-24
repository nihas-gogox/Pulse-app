/**
 * Shared bordered input shell — keeps RN Web <input> backgrounds aligned with the shell.
 * Regression source: ef1dd49c set overflow:visible on all web shells, which let native
 * inputs paint past rounded corners and show white/blue strips at the edges.
 */
import { Platform, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

import Theme from '../constants/Theme';

export type PulseInputChromeOptions = {
  backgroundColor?: string;
  borderColor?: string;
  borderRadius?: number;
  minHeight?: number;
  /** When true, shell aligns content to flex-start (multiline). */
  multiline?: boolean;
};

/** iOS mobile Safari only — overflow:hidden on input wrappers can block the keyboard. */
export function pulseInputShellOverflow(): 'hidden' | 'visible' {
  if (Platform.OS !== 'web') return 'hidden';
  if (typeof navigator === 'undefined') return 'hidden';
  const ua = navigator.userAgent || '';
  const isIOS =
    /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return isIOS ? 'visible' : 'hidden';
}

export function pulseInputShellStyle({
  backgroundColor = Theme.cardWhite,
  borderColor = Theme.borderInput,
  borderRadius = 16,
  minHeight,
  multiline = false,
}: PulseInputChromeOptions = {}): ViewStyle {
  return {
    borderWidth: 1,
    borderColor,
    borderRadius,
    backgroundColor,
    flexDirection: 'row',
    alignItems: multiline ? 'flex-start' : 'center',
    position: 'relative',
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
    overflow: pulseInputShellOverflow(),
    ...(minHeight != null ? { minHeight } : null),
    ...Platform.select({
      web: { boxSizing: 'border-box' } as object,
      default: {},
    }),
  };
}

/** Inner TextInput — transparent so the shell owns border + fill. */
export function pulseInputTextStyle(
  textStyle: TextStyle,
  options?: { multiline?: boolean; hasTrailing?: boolean; minHeight?: number },
): TextStyle {
  const multiline = options?.multiline ?? false;
  const minHeight = options?.minHeight;
  return {
    flex: 1,
    minWidth: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    ...textStyle,
    ...(minHeight != null ? { minHeight } : null),
    ...(options?.hasTrailing ? { paddingRight: 4 } : null),
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        cursor: 'text',
        width: '100%',
        boxSizing: 'border-box',
        borderRadius: 0,
      } as object,
      default: {},
    }),
    ...(multiline
      ? {
          minHeight: 120,
          textAlignVertical: 'top' as const,
          paddingTop: 14,
        }
      : null),
  };
}

export const pulseInputTrailingWrap: ViewStyle = {
  flexShrink: 0,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'transparent',
};

export const pulseInputShellErrorStyle: ViewStyle = {
  borderColor: Theme.destructive,
  backgroundColor: '#fef2f2',
};

/** Trailing icon hit area (password toggle, clear, etc.). */
export function pulseInputTrailingHitSlop(paddingH = 12, paddingV = 10): ViewStyle {
  return {
    ...pulseInputTrailingWrap,
    paddingHorizontal: paddingH,
    paddingVertical: paddingV,
  };
}

export const pulseInputChromeStyles = StyleSheet.create({
  shell: pulseInputShellStyle(),
  shellError: pulseInputShellErrorStyle,
  trailing: pulseInputTrailingWrap,
});
