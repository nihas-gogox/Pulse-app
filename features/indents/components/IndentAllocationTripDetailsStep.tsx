import DateTimePicker from "@react-native-community/datetimepicker";
import { memo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import Theme from "@/constants/Theme";
import { fullPageWizardStyles } from "@/components/full-page-wizard";
import {
  formatIsoDateForDisplay,
  getDayAfterTomorrowIso,
  getTodayIso,
  getTomorrowIso,
  toISODate,
} from "@/lib/dateIso.util";

export type IndentAllocationTripDetailsStepProps = {
  pickupDate: string;
  onPickupDateChange: (iso: string) => void;
  pickupDateError?: string | null;
  /** Phone: chips and field sit tight under the summary. */
  compact?: boolean;
};

/**
 * Final allocation step — vehicle arrival date only.
 * Vehicle type, product type, and tons come from the indent.
 */
export const IndentAllocationTripDetailsStep = memo(
  function IndentAllocationTripDetailsStep({
    pickupDate,
    onPickupDateChange,
    pickupDateError,
    compact = false,
  }: IndentAllocationTripDetailsStepProps) {
    const [showDatePicker, setShowDatePicker] = useState(false);
    const { width } = useWindowDimensions();
    const isWide = Platform.OS === "web" && width >= 720;

    return (
      <View
        style={[
          fullPageWizardStyles.wizardStepContentFlat,
          styles.root,
          isWide && !compact && styles.rootWebWide,
          compact && styles.rootCompact,
        ]}
      >
        <View style={[styles.dateCard, compact && styles.dateCardCompact]}>
          <Text style={[styles.dateLabel, compact && styles.dateLabelCompact]}>
            Vehicle arrival date
          </Text>
          <View style={[styles.chipRow, compact && styles.chipRowCompact]}>
            {(
              [
                { label: "Today", iso: getTodayIso() },
                { label: "Tomorrow", iso: getTomorrowIso() },
                { label: "Day after", iso: getDayAfterTomorrowIso() },
              ] as const
            ).map(({ label, iso }) => {
              const isActive = pickupDate === iso;
              return (
                <Pressable
                  key={label}
                  style={[
                    styles.chip,
                    compact && styles.chipCompact,
                    isActive && styles.chipActive,
                  ]}
                  onPress={() => onPickupDateChange(iso)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      compact && styles.chipTextCompact,
                      isActive && styles.chipTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {Platform.OS === "web" ? (
            <TextInput
              style={[
                styles.input,
                compact && styles.inputCompact,
                pickupDateError ? styles.inputError : null,
              ]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Theme.placeholder}
              value={pickupDate}
              onChangeText={onPickupDateChange}
            />
          ) : (
            <>
              <TouchableOpacity
                style={[
                  fullPageWizardStyles.wizardDateTouchable,
                  pickupDateError ? styles.inputError : null,
                ]}
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.85}
              >
                <Text
                  style={
                    pickupDate
                      ? fullPageWizardStyles.wizardDateText
                      : fullPageWizardStyles.wizardDatePlaceholder
                  }
                >
                  {pickupDate
                    ? formatIsoDateForDisplay(pickupDate)
                    : "Tap to pick date"}
                </Text>
              </TouchableOpacity>
              {showDatePicker &&
                (Platform.OS === "android" ? (
                  <DateTimePicker
                    value={
                      pickupDate
                        ? new Date(`${pickupDate}T12:00:00`)
                        : new Date()
                    }
                    mode="date"
                    display="default"
                    minimumDate={new Date()}
                    onChange={(e, date) => {
                      setShowDatePicker(false);
                      if (e.type === "set" && date)
                        onPickupDateChange(toISODate(date));
                    }}
                  />
                ) : (
                  <Modal visible transparent animationType="slide">
                    <TouchableOpacity
                      style={styles.datePickerBackdrop}
                      activeOpacity={1}
                      onPress={() => setShowDatePicker(false)}
                    >
                      <View
                        style={styles.datePickerSheet}
                        onStartShouldSetResponder={() => true}
                      >
                        <View style={styles.datePickerHeader}>
                          <Text style={styles.datePickerTitle}>
                            Vehicle arrival date
                          </Text>
                          <TouchableOpacity
                            onPress={() => setShowDatePicker(false)}
                            hitSlop={12}
                          >
                            <Text style={styles.datePickerDone}>Done</Text>
                          </TouchableOpacity>
                        </View>
                        <DateTimePicker
                          value={
                            pickupDate
                              ? new Date(`${pickupDate}T12:00:00`)
                              : new Date()
                          }
                          mode="date"
                          display="spinner"
                          minimumDate={new Date()}
                          onChange={(_, date) =>
                            date && onPickupDateChange(toISODate(date))
                          }
                        />
                      </View>
                    </TouchableOpacity>
                  </Modal>
                ))}
            </>
          )}
          {pickupDateError ? (
            <Text style={styles.errorText}>{pickupDateError}</Text>
          ) : null}
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  root: {
    width: "100%",
    gap: 12,
  },
  rootWebWide: {
    maxWidth: 520,
    alignSelf: "center",
  },
  rootCompact: {
    gap: 0,
  },
  dateCard: {
    width: "100%",
    gap: 8,
    backgroundColor: Theme.cardWhite,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Theme.borderLight,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dateCardCompact: {
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  dateLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: Theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  dateLabelCompact: {
    letterSpacing: 0.3,
  },
  chipRow: {
    flexDirection: "row",
    gap: 8,
  },
  chipRowCompact: {
    gap: 6,
  },
  chip: {
    flex: 1,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Theme.borderLight,
    backgroundColor: Theme.backgroundInput,
    paddingHorizontal: 8,
  },
  chipCompact: {
    minHeight: 36,
    borderRadius: 8,
  },
  chipActive: {
    borderColor: Theme.textPrimaryDark,
    backgroundColor: Theme.textPrimaryDark,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.textRouteCard,
  },
  chipTextCompact: {
    fontSize: 12,
  },
  chipTextActive: {
    color: Theme.textOnPrimary,
  },
  input: {
    ...fullPageWizardStyles.wizardFieldInput,
  },
  inputCompact: {
    height: 40,
    minHeight: 40,
    fontSize: 15,
    lineHeight: 20,
    paddingVertical: 8,
    backgroundColor: Theme.backgroundInput,
  },
  inputError: {
    borderColor: Theme.destructive,
  },
  errorText: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "600",
    color: Theme.destructive,
  },
  datePickerBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.35)",
  },
  datePickerSheet: {
    backgroundColor: Theme.cardWhite,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  datePickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Theme.borderLight,
  },
  datePickerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Theme.textPrimaryDark,
  },
  datePickerDone: {
    fontSize: 16,
    fontWeight: "700",
    color: Theme.primary,
  },
});
