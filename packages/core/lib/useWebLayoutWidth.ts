import { useEffect, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

/**
 * On web, `useWindowDimensions()` can lag or disagree with the real CSS viewport
 * when devtools are docked or the window is resized. Use `max(RN width, innerWidth)`
 * so “desktop” chrome (Live Ops sidebar, etc.) matches what you see in the browser.
 */
export function useWebLayoutWidth(): number {
  const { width } = useWindowDimensions();
  const [innerW, setInnerW] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onResize = () => setInnerW(window.innerWidth);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (Platform.OS !== 'web') return width;
  return Math.max(width, innerW || 0);
}
