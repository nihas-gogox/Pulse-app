import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { getDriverThemeColors } from "@pulse/ui/contexts/DriverThemeContext";

import { driverOpsEntryStyles as ops } from "@pulse/domain/features/trips/operations/shared/driverOpsEntry.styles";

type Props = {
  cancelLabel?: string;
  onCancel: () => void;
  saveLabel: string;
  onSave: () => void;
  saving?: boolean;
  saveDisabled?: boolean;
  hint?: string | null;
};

/** Footer actions shared by driver expense + odometer entry flows. */
export function DriverOpsEntryFooter({
  cancelLabel = "Cancel",
  onCancel,
  saveLabel,
  onSave,
  saving = false,
  saveDisabled = false,
  hint,
}: Props) {
  const colors = getDriverThemeColors("light");
  const disabled = saving || saveDisabled;

  return (
    <View style={ops.footer}>
      {hint ? (
        <Text style={[ops.syncHint, { color: colors.textMuted, width: "100%", marginBottom: 6 }]}>
          {hint}
        </Text>
      ) : null}
      <Pressable
        style={[ops.skipBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
        onPress={onCancel}
        disabled={saving}
      >
        <Text style={[ops.skipText, { color: colors.textMuted }]}>{cancelLabel}</Text>
      </Pressable>
      <Pressable
        style={[ops.saveBtn, { backgroundColor: colors.emeraldDark }, disabled && { opacity: 0.5 }]}
        onPress={onSave}
        disabled={disabled}
      >
        {saving ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={ops.saveText}>{saveLabel}</Text>
        )}
      </Pressable>
    </View>
  );
}
