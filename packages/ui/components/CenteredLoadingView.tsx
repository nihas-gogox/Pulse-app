/**
 * Full-screen loading — delegates to AppLoadingSplash for a calm, branded wait.
 * Use for route gates, query initial load, and Suspense fallbacks.
 */
import {
  AppLoadingSplash,
  type AppLoadingSplashVariant,
} from './AppLoadingSplash';
import type { StyleProp, ViewStyle } from 'react-native';

interface CenteredLoadingViewProps {
  message?: string;
  color?: string;
  variant?: AppLoadingSplashVariant;
  style?: StyleProp<ViewStyle>;
  useGlobalI18n?: boolean;
}

export function CenteredLoadingView({
  message,
  color,
  variant = 'generic',
  style,
  useGlobalI18n,
}: CenteredLoadingViewProps) {
  return (
    <AppLoadingSplash
      variant={variant}
      message={message}
      accentColor={color}
      style={style}
      useGlobalI18n={useGlobalI18n}
    />
  );
}
