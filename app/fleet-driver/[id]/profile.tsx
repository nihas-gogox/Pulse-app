import { DriverProfileScreen } from "@/features/drivers/components/DriverProfileScreen";
import { useSafeBack } from "@/lib/useSafeBack";
import { useLocalSearchParams } from "expo-router";

export default function DriverProfileRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const safeBack = useSafeBack();
  const driverId = typeof id === "string" ? id : id?.[0] ?? "";
  return <DriverProfileScreen driverId={driverId} onBack={safeBack} />;
}
