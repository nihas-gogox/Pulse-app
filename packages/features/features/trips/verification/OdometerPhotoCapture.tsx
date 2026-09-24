import Theme from "@pulse/core/constants/Theme";
import { OperationalButton } from "@pulse/ui/components/operational";
import { ExpenseBillScanOverlay } from "../operations/shared/ExpenseBillScanOverlay";
import { Image, StyleSheet, Text, View } from "react-native";

export function OdometerPhotoCapture({
  photoUri,
  busy,
  scanning = false,
  onCapture,
  onRetake,
  compact = false,
  title = "Odometer Photo",
  subtitle = "Camera-first, optional, useful for reconciliation.",
  captureLabel = "Capture photo",
  retakeLabel = "Retake",
}: {
  photoUri: string | null;
  busy?: boolean;
  scanning?: boolean;
  onCapture: () => void;
  onRetake: () => void;
  compact?: boolean;
  title?: string;
  subtitle?: string;
  captureLabel?: string;
  retakeLabel?: string;
}) {
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Text style={[styles.title, compact && styles.titleCompact]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.sub, compact && styles.subCompact]}>{subtitle}</Text>
      ) : null}
      {photoUri ? (
        <>
          <View style={styles.previewWrap}>
            <Image
              source={{ uri: photoUri }}
              style={[styles.preview, compact && styles.previewCompact]}
              resizeMode="cover"
            />
            <ExpenseBillScanOverlay visible={scanning} />
          </View>
          <OperationalButton
            intent="utility"
            label={retakeLabel}
            onPress={onRetake}
            disabled={busy}
            density="high"
            fullWidth={false}
            style={compact ? styles.actionCompact : undefined}
          />
        </>
      ) : (
        <OperationalButton
          intent="utility"
          label={captureLabel}
          onPress={onCapture}
          disabled={busy}
          density="high"
          style={compact ? styles.actionCompact : undefined}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: Theme.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Theme.border,
    padding: 12,
    gap: 8,
  },
  wrapCompact: {
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  title: {
    fontSize: 14,
    color: Theme.text,
    fontWeight: "700",
  },
  titleCompact: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: Theme.textMuted,
  },
  sub: {
    fontSize: 12,
    color: Theme.textSecondary,
  },
  subCompact: {
    fontSize: 9,
    lineHeight: 12,
    marginTop: -2,
  },
  previewWrap: {
    position: "relative",
    borderRadius: 10,
    overflow: "hidden",
  },
  preview: {
    width: "100%",
    height: 180,
    borderRadius: 10,
    backgroundColor: Theme.whiteMuted,
  },
  previewCompact: {
    height: 112,
    borderRadius: 8,
  },
  actionCompact: {
    alignSelf: "flex-start",
  },
});
