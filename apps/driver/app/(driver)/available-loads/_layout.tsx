import { routeStackScreenOptions } from '@pulse/core/lib/routeStackOptions';
import { Stack } from 'expo-router';

export default function AvailableLoadsLayout() {
  return <Stack screenOptions={routeStackScreenOptions} />;
}
