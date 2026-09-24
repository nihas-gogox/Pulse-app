// Driver modal stack (D20). Same screen options as the main app's (modals) layout.
import { routeStackScreenOptions } from '@pulse/core/lib/routeStackOptions';
import { Stack } from 'expo-router';

export default function DriverModalsLayout() {
  return (
    <Stack screenOptions={{ ...routeStackScreenOptions, presentation: 'modal' }}>
      <Stack.Screen name="language-settings" />
    </Stack>
  );
}
