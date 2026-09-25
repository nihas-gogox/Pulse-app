import { useLocalSearchParams } from "expo-router";
import { DriverAnalyticsFullScreen } from "@/features/drivers/components/DriverAnalyticsFullScreen";

export default function DriverAnalyticsRoute() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const driverId =
    typeof id === "string" ? id : Array.isArray(id) ? id[0] ?? "" : "";

  return <DriverAnalyticsFullScreen driverId={driverId} />;
}
