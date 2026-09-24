import { Platform, useWindowDimensions } from 'react-native';

export type InputPlatform = 'mobile' | 'tablet' | 'desktop';

/**
 * Determines whether to render the fullscreen mobile entry, a centered tablet
 * modal, or the desktop right-drawer variant.
 */
export function useInputPlatform(): InputPlatform {
  const { width } = useWindowDimensions();
  if (Platform.OS !== 'web') return 'mobile';
  if (width >= 1024) return 'desktop';
  if (width >= 768) return 'tablet';
  return 'mobile';
}
