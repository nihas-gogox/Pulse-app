import { ChromeBelowTopNavLoadingScreen } from "@/components/chromeLoadingScreens";
import { ComplianceDetailsScreen } from "@/features/tripCompliance/screens/ComplianceDetailsScreen";
import { ROUTES } from "@/lib/routes";
import { Redirect, useLocalSearchParams } from "expo-router";
import { Suspense } from "react";

const RESERVED = new Set(["bulk-payment", "report"]);

export default function ComplianceDetailRoute() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const id = Array.isArray(tripId) ? tripId[0] : tripId;
  if (!id || RESERVED.has(id)) {
    return <Redirect href={ROUTES.COMPLIANCE} />;
  }
  return (
    <Suspense fallback={<ChromeBelowTopNavLoadingScreen variant="preparing" />}>
      <ComplianceDetailsScreen tripId={id} />
    </Suspense>
  );
}
