import { Platform, type ViewStyle } from 'react-native';

import Theme from '../constants/Theme';
import { adaptShadowPropsForWeb } from '../lib/platformViewStyle.util';

type ElevationLevel = 0 | 1 | 2 | 3;

/** Prefer surface contrast over borders; elevation is subtle. */
export function elevation(level: ElevationLevel): ViewStyle {
  if (level === 0) {
    return {
      backgroundColor: Theme.screenBackground,
    };
  }

  const shadow1: ViewStyle = {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  };
  const shadow2: ViewStyle = {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
  };
  const shadow3: ViewStyle = {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
  };

  const configs: Record<Exclude<ElevationLevel, 0>, ViewStyle> = {
    1: {
      backgroundColor: Theme.cardWhite,
      ...Platform.select({
        ios: shadow1,
        android: { elevation: 1 },
        web: adaptShadowPropsForWeb(shadow1),
        default: {},
      }),
    },
    2: {
      backgroundColor: Theme.cardWhite,
      ...Platform.select({
        ios: shadow2,
        android: { elevation: 3 },
        web: adaptShadowPropsForWeb(shadow2),
        default: {},
      }),
    },
    3: {
      backgroundColor: Theme.cardWhite,
      ...Platform.select({
        ios: shadow3,
        android: { elevation: 8 },
        web: adaptShadowPropsForWeb(shadow3),
        default: {},
      }),
    },
  };

  return configs[level];
}

export default elevation;
