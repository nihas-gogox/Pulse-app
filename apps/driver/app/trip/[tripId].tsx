import { DriverTripHistoryDetailScreen } from "../../features/driver/components/DriverTripHistoryDetailScreen";
import { useLocalSearchParams } from "expo-router";
import { StyleSheet, View } from "react-native";

export default function TripHistoryDetailPage() {
  const params = useLocalSearchParams<{
    tripId?: string | string[];
    tab?: string | string[];
    eventId?: string | string[];
  }>();

  const id =
    typeof params.tripId === "string"
      ? params.tripId
      : Array.isArray(params.tripId)
        ? params.tripId[0]
        : "";

  const tabRaw =
    typeof params.tab === "string" ? params.tab : Array.isArray(params.tab) ? params.tab[0] : "";

  const eventIdRaw =
    typeof params.eventId === "string"
      ? params.eventId
      : Array.isArray(params.eventId)
        ? params.eventId[0]
        : "";

  const initialTab =
    tabRaw === "operations" || tabRaw === "settlement" || tabRaw === "journey"
      ? tabRaw
      : undefined;

  if (!id) {
    return <View style={styles.fill} />;
  }

  return (
    <View style={styles.fill}>
      <DriverTripHistoryDetailScreen
        tripId={id}
        initialTab={initialTab}
        initialSelectedExpenseId={eventIdRaw || null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    minHeight: 0,
    width: "100%",
  },
});
