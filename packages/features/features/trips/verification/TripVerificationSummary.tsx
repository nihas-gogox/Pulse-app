import Theme from "@pulse/core/constants/Theme";
import { IdentityAvatar, useResolvedIdentity } from "../../identity";
import type { TripRow } from "@pulse/domain/features/trips/services/trips.service";
import { DistanceComparisonCard } from "./DistanceComparisonCard";
import { VerificationStatusChip } from "./VerificationStatusChip";
import { toVerificationSnapshot } from "@pulse/domain/features/trips/verification/selectors/verificationSelectors";
import { useTripVerificationPhotos } from "@pulse/domain/features/trips/verification/queries/useTripVerification";
import * as tripDocumentsService from "@pulse/domain/features/trips/services/tripDocuments.service";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useEffect, useMemo, useState } from "react";

function formatKm(v: number | null): string {
  if (v == null || !Number.isFinite(Number(v))) return "—";
  return `${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 1 })} KM`;
}

export function TripVerificationSummary({
  trip,
  onEditStart,
  onEditEnd,
}: {
  trip: TripRow;
  onEditStart?: () => void;
  onEditEnd?: () => void;
}) {
  const snapshot = toVerificationSnapshot(trip);
  const [expanded, setExpanded] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const updatedIdentity = useResolvedIdentity({
    userId: snapshot.odometerUpdatedBy,
    orgId: trip.organization_id,
    verificationState: snapshot.state,
  });
  const photosQuery = useTripVerificationPhotos(trip.id, { enabled: expanded });
  const photos = photosQuery.data ?? [];

  useEffect(() => {
    if (!expanded) return;
    photos.slice(0, 2).forEach((photo) => {
      if (photoUrls[photo.id]) return;
      void tripDocumentsService.getDocumentViewUrl(photo.storage_path).then((url) => {
        setPhotoUrls((prev) => (prev[photo.id] ? prev : { ...prev, [photo.id]: url }));
      });
    });
  }, [expanded, photos, photoUrls]);

  const updatedByLabel = useMemo(() => {
    if (updatedIdentity.data) return updatedIdentity.data.displayName;
    const id = snapshot.odometerUpdatedBy?.trim();
    if (!id) return "—";
    if (id.length <= 10) return id;
    return `${id.slice(0, 6)}...${id.slice(-4)}`;
  }, [snapshot.odometerUpdatedBy, updatedIdentity.data]);

  return (
    <View style={styles.card}>
      <Pressable style={styles.header} onPress={() => setExpanded((v) => !v)}>
        <View>
          <Text style={styles.title}>Trip Verification</Text>
          <Text style={styles.sub}>Optional operational verification</Text>
        </View>
        <View style={styles.headerRight}>
          <VerificationStatusChip state={snapshot.state} />
          <Text style={styles.expandHint}>{expanded ? "Hide" : "View"}</Text>
        </View>
      </Pressable>

      {expanded ? (
        <>
          <View style={styles.grid}>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Start Odometer</Text>
              <Text style={styles.metricValue}>{formatKm(snapshot.startOdometerKm)}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>End Odometer</Text>
              <Text style={styles.metricValue}>{formatKm(snapshot.endOdometerKm)}</Text>
            </View>
          </View>

          <DistanceComparisonCard
            odometerDistanceKm={snapshot.odometerDistanceKm}
            gpsDistanceKm={snapshot.gpsDistanceKm}
            discrepancyKm={snapshot.distanceDiscrepancyKm}
          />

          <View style={styles.auditRow}>
            <Text style={styles.auditLabel}>Updated by</Text>
            {updatedByLabel === "—" ? (
              <Text style={styles.auditValue}>—</Text>
            ) : (
              <View style={styles.updatedByUser}>
                {updatedIdentity.data ? (
                  <IdentityAvatar identity={updatedIdentity.data} size={22} />
                ) : (
                  <View style={styles.updatedByAvatarPlaceholder} />
                )}
                <Text style={styles.auditValue} numberOfLines={1}>
                  {updatedByLabel}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.auditRow}>
            <Text style={styles.auditLabel}>Updated at</Text>
            <Text style={styles.auditValue}>
              {snapshot.odometerUpdatedAt
                ? new Date(snapshot.odometerUpdatedAt).toLocaleString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—"}
            </Text>
          </View>

          <View style={styles.photosWrap}>
            <Text style={styles.metricLabel}>Odometer Photos</Text>
            {photosQuery.isLoading ? (
              <Text style={styles.photosHint}>Loading photos…</Text>
            ) : photos.length === 0 ? (
              <Text style={styles.photosHint}>No odometer photos yet</Text>
            ) : (
              <View style={styles.photoRow}>
                {photos.slice(0, 2).map((photo) => (
                  <View key={photo.id} style={styles.photoTile}>
                    {photoUrls[photo.id] ? (
                      <Image source={{ uri: photoUrls[photo.id] }} style={styles.photo} />
                    ) : (
                      <View style={[styles.photo, styles.photoPlaceholder]} />
                    )}
                    <Text style={styles.photoLabel} numberOfLines={1}>
                      {photo.document_type === "odometer_start_photo" ? "Start" : "End"}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.actions}>
            <Pressable style={styles.actionBtn} onPress={onEditStart}>
              <Text style={styles.actionBtnText}>Add/Edit Start</Text>
            </Pressable>
            <Pressable style={styles.actionBtn} onPress={onEditEnd}>
              <Text style={styles.actionBtnText}>Add/Edit End</Text>
            </Pressable>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Theme.surface,
    borderWidth: 1,
    borderColor: Theme.border,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  headerRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  expandHint: {
    color: Theme.textSecondary,
    fontSize: 11,
    fontWeight: "700",
  },
  title: {
    color: Theme.text,
    fontSize: 15,
    fontWeight: "700",
  },
  sub: {
    color: Theme.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  grid: {
    flexDirection: "row",
    gap: 10,
  },
  metric: {
    flex: 1,
    backgroundColor: Theme.whiteMuted,
    borderWidth: 1,
    borderColor: Theme.border,
    borderRadius: 10,
    padding: 10,
  },
  metricLabel: {
    color: Theme.textSecondary,
    fontSize: 11,
    fontWeight: "600",
  },
  metricValue: {
    color: Theme.text,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  auditRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2,
  },
  auditLabel: {
    color: Theme.textSecondary,
    fontSize: 11,
    fontWeight: "600",
  },
  auditValue: {
    color: Theme.text,
    fontSize: 12,
    fontWeight: "700",
  },
  updatedByUser: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "65%",
  },
  updatedByAvatarPlaceholder: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Theme.borderLight,
  },
  photosWrap: {
    gap: 6,
  },
  photosHint: {
    color: Theme.textSecondary,
    fontSize: 11,
  },
  photoRow: {
    flexDirection: "row",
    gap: 10,
  },
  photoTile: {
    width: 90,
    gap: 4,
  },
  photo: {
    width: 90,
    height: 70,
    borderRadius: 8,
    backgroundColor: Theme.whiteMuted,
  },
  photoPlaceholder: {
    borderWidth: 1,
    borderColor: Theme.border,
  },
  photoLabel: {
    color: Theme.textSecondary,
    fontSize: 10,
    fontWeight: "700",
  },
  actionBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: Theme.border,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: "center",
    backgroundColor: Theme.whiteMuted,
  },
  actionBtnText: {
    color: Theme.text,
    fontWeight: "700",
    fontSize: 12,
  },
});
