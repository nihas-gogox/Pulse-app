import Theme from '../constants/Theme';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

/** Consistent stack scene shell — avoids transparent/blank gaps while screens mount. */
export const routeStackScreenOptions: NativeStackNavigationOptions = {
  headerShown: false,
  contentStyle: {
    flex: 1,
    minHeight: 0,
    backgroundColor: Theme.screenBackground,
  },
};
