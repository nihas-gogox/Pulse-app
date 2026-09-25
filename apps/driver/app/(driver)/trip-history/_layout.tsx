/**
 * Trip history segment — list only. Trip detail moved to the root-level
 * app/driver-trip/[tripId] route so it renders outside the driver Tabs
 * (the tab bar no longer needs to be hidden here, and the History tab's
 * own re-tap-to-reset behavior works correctly since Trip Detail no
 * longer lives inside this nested stack).
 */
import { routeStackScreenOptions } from "@pulse/core/lib/routeStackOptions";
import { Stack } from "expo-router";

export default function TripHistoryLayout() {
  return (
    <Stack screenOptions={routeStackScreenOptions}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
