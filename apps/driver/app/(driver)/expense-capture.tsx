import { useRouter } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

import { LoadingIndicator } from "@pulse/ui/components/LoadingIndicator";
import { useDriverThemeColors } from "@pulse/ui/contexts/DriverThemeContext";
import { useOptionalDriverTripOps } from "../../contexts/DriverTripOpsContext";
import { ROUTES } from "@pulse/core/lib/routes";

/**
 * Legacy entry: expense always opens for the active trip (no general chooser).
 */
export default function DriverExpenseCaptureRoute() {
  const router = useRouter();
  const colors = useDriverThemeColors();
  const tripOps = useOptionalDriverTripOps();

  useEffect(() => {
    if (tripOps?.hasTargetTrip) {
      tripOps.openTripExpense();
      return;
    }
    tripOps?.openExpense?.();
    router.replace(ROUTES.DRIVER_ROOT as never);
  }, [router, tripOps]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <LoadingIndicator color={colors.emerald} />
    </View>
  );
}
