import { useEffect, useState } from 'react';
import { Dimensions } from 'react-native';

/**
 * Window width that does not update when only height changes.
 *
 * `useWindowDimensions()` re-renders on every visualViewport height tick.
 * On Android Chrome that is the keyboard animation — each tick rebuilds
 * signup TextInputs under the caret and Chromium blurs them.
 */
export function useViewportWidth(): number {
  const [width, setWidth] = useState(() => Dimensions.get('window').width);

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window: next }) => {
      setWidth((prev) => (prev === next.width ? prev : next.width));
    });
    return () => sub.remove();
  }, []);

  return width;
}
