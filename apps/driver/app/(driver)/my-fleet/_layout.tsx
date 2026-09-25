import { routeStackScreenOptions } from '@pulse/core/lib/routeStackOptions';
import { Stack } from 'expo-router';

export default function MyFleetLayout() {
  return <Stack screenOptions={routeStackScreenOptions} />;
}
