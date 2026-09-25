/**
 * Narrow-screen vault tab. Same four cards as the desktop Asset Vault.
 */
import Theme from "@/constants/Theme";
import { canMutateTripVaultDoc, type TripDocItem, VAULT_DOC_LIMIT_HINT } from "@/features/trips/components/trip-detail/tripDocTypes";
import {
  type EwayBillStripRow,
  type EwayFieldValues,
} from "@/features/trips/components/trip-detail/EwayBillVaultTab";
import { TripVaultCardGrid } from "@/features/trips/components/trip-detail/TripVaultCardGrid";
import { neoStyles } from "@/features/trips/components/trip-detail/TripDetailScreen.styles";
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  docs: TripDocItem[];
  canUploadTripDocs: boolean;
  tripCompleted?: boolean;
  uploadingDocId: string | null;
  vehicleId: string | null;
  onCardPress: (doc: TripDocItem) => void;
  onAddMore?: (doc: TripDocItem) => void;
  ewayStripRows?: EwayBillStripRow[];
  onViewEwayBill?: (rowId: string) => void;
  onUploadEwayBill?: (rowId?: string) => void;
  canUploadEwayBill?: boolean;
  canEditEwayBill?: boolean;
  onSaveEwayBill?: (values: EwayFieldValues[]) => Promise<boolean>;
  tripIdLabel: string;
  createdAtLabel: string;
};

function onFileSummary(doc: TripDocItem | undefined): string {
  const type = doc?.type?.trim() ?? "";
  if (!type || type === "FILES" || type === "PDF" || type === "JPG" || type === "PNG") {
    return "";
  }
  return type;
}

export const TripMobileVaultPanel = memo(function TripMobileVaultPanel({
  docs,
  canUploadTripDocs,
  tripCompleted = false,
  uploadingDocId,
  onCardPress,
  onAddMore,
  ewayStripRows = [],
  onViewEwayBill,
  onUploadEwayBill,
  canUploadEwayBill = false,
  canEditEwayBill = false,
  onSaveEwayBill,
  tripIdLabel,
  createdAtLabel,
}: Props) {
  const vehicleCard = docs.find((doc) => doc.id === "vehicle-documents");
  const driverCard = docs.find((doc) => doc.id === "driver-documents");

  return (
    <View style={styles.root}>
      {canUploadTripDocs ? (
        <Text style={[neoStyles.vaultLimitsHint, styles.hint]}>{VAULT_DOC_LIMIT_HINT}</Text>
      ) : null}
      <TripVaultCardGrid
        docs={docs}
        uploadingDocId={uploadingDocId}
        canUpload={(doc) =>
          canMutateTripVaultDoc({ doc, canUploadTripDocs, tripCompleted }) &&
          Boolean(onAddMore)
        }
        vehicleSummary={onFileSummary(vehicleCard)}
        driverSummary={onFileSummary(driverCard)}
        onOpen={onCardPress}
        onAdd={(doc) => onAddMore?.(doc)}
        ewayStripRows={ewayStripRows}
        onViewEwayBill={onViewEwayBill ?? (() => undefined)}
        onUploadEwayBill={onUploadEwayBill ?? (() => undefined)}
        canUploadEwayBill={canUploadEwayBill}
        canEditEwayBill={canEditEwayBill}
        onSaveEwayBill={onSaveEwayBill ?? (async () => false)}
        columns={2}
      />
      <View style={styles.bottomBar}>
        <Text style={styles.bottomText} numberOfLines={1}>
          Trip ID: <Text style={styles.bottomStrong}>{tripIdLabel}</Text>
        </Text>
        <Text style={styles.bottomTextEnd} numberOfLines={1}>
          Placed On: <Text style={styles.bottomStrong}>{createdAtLabel}</Text>
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    width: "100%",
    backgroundColor: Theme.screenBackground,
    paddingBottom: 8,
  },
  hint: {
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  bottomBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bottomText: {
    flex: 1,
    color: Theme.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  bottomTextEnd: {
    flex: 1,
    textAlign: "right",
    color: Theme.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  bottomStrong: {
    color: Theme.textPrimary,
    fontWeight: "800",
  },
});
