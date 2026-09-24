/**
 * Separate Pickup / Drop / Vehicle filters. Each chip opens the same
 * available-option list for that field (drop and vehicle stay cascade-narrowed).
 */
import Layout from "@/constants/Layout";
import Theme from "@/constants/Theme";
import {
  filterMarketplaceOptions,
  normalizeMarketplaceSearch,
  type MarketplaceLoadSearch,
  type MarketplaceSearchLane,
} from "@/features/network/utils/marketplaceSearch.util";
import { Check, ChevronDown, Flag, MapPin, Search, Truck, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Field = "pickup" | "drop" | "vehicle";

const FIELD_META: Record<
  Field,
  {
    label: string;
    listTitle: string;
    placeholder: string;
    search: string;
    noun: string;
    a11y: string;
  }
> = {
  pickup: {
    label: "Pickup",
    listTitle: "Pickup locations",
    placeholder: "Select pickup",
    search: "Search pickup",
    noun: "Pickup",
    a11y: "Pickup city",
  },
  drop: {
    label: "Drop",
    listTitle: "Drop locations",
    placeholder: "Select drop",
    search: "Search drop",
    noun: "Drop",
    a11y: "Drop city",
  },
  vehicle: {
    label: "Vehicle",
    listTitle: "Vehicle types",
    placeholder: "Select vehicle",
    search: "Search vehicle",
    noun: "Vehicle",
    a11y: "Vehicle type",
  },
};

type Props = {
  lanes: MarketplaceSearchLane[];
  value: MarketplaceLoadSearch | null;
  onChange: (next: MarketplaceLoadSearch) => void;
  autoOpenFirst?: boolean;
  /** Full-width rows so selected cities stay readable on a phone. */
  stacked?: boolean;
};

export function MarketplaceLaneFilters({
  lanes,
  value,
  onChange,
  autoOpenFirst = false,
  stacked = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const draft = normalizeMarketplaceSearch(value);
  const [openField, setOpenField] = useState<Field | null>(null);
  const [menuQuery, setMenuQuery] = useState("");

  useEffect(() => {
    if (!autoOpenFirst) return;
    if (!draft.pickup) setOpenField("pickup");
  }, [autoOpenFirst, draft.pickup]);

  const options = useMemo(
    () =>
      openField
        ? filterMarketplaceOptions(lanes, draft, openField, menuQuery)
        : [],
    [lanes, draft, openField, menuQuery],
  );

  const pickupLocked = false;
  const dropLocked = !draft.pickup;
  const vehicleLocked = !draft.pickup || !draft.drop;

  const open = (field: Field, locked: boolean) => {
    if (locked) return;
    setMenuQuery("");
    setOpenField(field);
  };

  const pick = (field: Field, label: string) => {
    setMenuQuery("");
    if (field === "pickup") {
      onChange({ pickup: label, drop: "", vehicleType: "" });
      setOpenField("drop");
      return;
    }
    if (field === "drop") {
      onChange({ pickup: draft.pickup, drop: label, vehicleType: "" });
      setOpenField("vehicle");
      return;
    }
    onChange({
      pickup: draft.pickup,
      drop: draft.drop,
      vehicleType: label,
    });
    setOpenField(null);
  };

  const clearField = (field: Field) => {
    if (field === "pickup") {
      onChange({ pickup: "", drop: "", vehicleType: "" });
      return;
    }
    if (field === "drop") {
      onChange({ pickup: draft.pickup, drop: "", vehicleType: "" });
      return;
    }
    onChange({ pickup: draft.pickup, drop: draft.drop, vehicleType: "" });
  };

  const copy = openField ? FIELD_META[openField] : null;

  return (
    <View style={[styles.bar, stacked && styles.barStacked]}>
      <FilterChip
        field="pickup"
        value={draft.pickup}
        locked={pickupLocked}
        open={openField === "pickup"}
        stacked={stacked}
        onOpen={() => open("pickup", pickupLocked)}
        onClear={() => clearField("pickup")}
      />
      <FilterChip
        field="drop"
        value={draft.drop}
        locked={dropLocked}
        open={openField === "drop"}
        stacked={stacked}
        onOpen={() => open("drop", dropLocked)}
        onClear={() => clearField("drop")}
      />
      <FilterChip
        field="vehicle"
        value={draft.vehicleType}
        locked={vehicleLocked}
        open={openField === "vehicle"}
        stacked={stacked}
        onOpen={() => open("vehicle", vehicleLocked)}
        onClear={() => clearField("vehicle")}
      />

      <Modal
        visible={openField != null}
        transparent
        animationType="fade"
        onRequestClose={() => setOpenField(null)}
      >
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setOpenField(null)}
          />
          <View
            style={[
              styles.sheet,
              stacked && styles.sheetMobile,
              {
                paddingBottom: Math.max(insets.bottom, 14),
                marginTop: stacked ? Math.max(insets.top, 12) : undefined,
              },
            ]}
          >
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{copy?.listTitle}</Text>
              <Pressable
                onPress={() => setOpenField(null)}
                style={styles.sheetClose}
                accessibilityRole="button"
                accessibilityLabel="Close list"
                hitSlop={Layout.touchTargetHitSlop}
              >
                <X size={16} color={Theme.textPrimaryDark} strokeWidth={2.2} />
              </Pressable>
            </View>
            <View style={styles.menuSearch}>
              <Search size={14} color={Theme.textSecondary} />
              <TextInput
                value={menuQuery}
                onChangeText={setMenuQuery}
                placeholder={copy?.search}
                placeholderTextColor={Theme.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.menuSearchInput}
                accessibilityLabel={`${copy?.search ?? "Search"} in list`}
              />
            </View>
            <ScrollView
              style={styles.menuList}
              keyboardShouldPersistTaps="handled"
            >
              {options.length === 0 ? (
                <Text style={styles.emptyOption}>No matching live loads</Text>
              ) : (
                options.map((option) => {
                  const selected =
                    openField === "pickup"
                      ? option.label === draft.pickup
                      : openField === "drop"
                        ? option.label === draft.drop
                        : option.label === draft.vehicleType;
                  return (
                    <Pressable
                      key={`${openField}-${option.label}`}
                      onPress={() => openField && pick(openField, option.label)}
                      style={({ pressed }) => [
                        styles.option,
                        pressed && styles.pressed,
                        selected && styles.optionActive,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`${copy?.noun} ${option.label}, ${option.count} available`}
                    >
                      <Text
                        style={[
                          styles.optionLabel,
                          selected && styles.optionLabelActive,
                        ]}
                        numberOfLines={2}
                      >
                        {option.label}
                      </Text>
                      <View style={styles.optionMeta}>
                        <View style={styles.countPill}>
                          <Text style={styles.optionCount}>
                            {option.count}{" "}
                            {option.count === 1 ? "load" : "loads"}
                          </Text>
                        </View>
                        {selected ? (
                          <Check
                            size={14}
                            color={Theme.primary}
                            strokeWidth={2.4}
                          />
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function FieldIcon({ field }: { field: Field }) {
  const color = Theme.primary;
  if (field === "pickup") return <MapPin size={14} color={color} strokeWidth={2.3} />;
  if (field === "drop") return <Flag size={14} color={color} strokeWidth={2.3} />;
  return <Truck size={14} color={color} strokeWidth={2.3} />;
}

function FilterChip({
  field,
  value,
  locked,
  open,
  stacked,
  onOpen,
  onClear,
}: {
  field: Field;
  value: string;
  locked: boolean;
  open: boolean;
  stacked: boolean;
  onOpen: () => void;
  onClear: () => void;
}) {
  const meta = FIELD_META[field];
  return (
    <View
      style={[
        styles.chip,
        stacked && styles.chipStacked,
        open && styles.chipOpen,
        locked && styles.chipLocked,
      ]}
    >
      <Pressable
        onPress={onOpen}
        disabled={locked}
        style={styles.chipMain}
        accessibilityRole="button"
        accessibilityLabel={meta.a11y}
        accessibilityState={{ disabled: locked, expanded: open }}
      >
        <View style={styles.chipIcon}>
          <FieldIcon field={field} />
        </View>
        <View style={styles.chipCopy}>
          <Text style={styles.chipLabel}>{meta.label}</Text>
          <Text
            style={[styles.chipValue, !value && styles.chipPlaceholder]}
            numberOfLines={stacked ? 2 : 1}
          >
            {locked
              ? field === "drop"
                ? "Choose pickup first"
                : "Choose drop first"
              : value || meta.placeholder}
          </Text>
        </View>
        <ChevronDown size={14} color={Theme.textMuted} strokeWidth={2.2} />
      </Pressable>
      {value ? (
        <Pressable
          onPress={onClear}
          style={styles.chipClear}
          accessibilityRole="button"
          accessibilityLabel={`Clear ${meta.label}`}
          hitSlop={6}
        >
          <X size={12} color={Theme.textSecondary} strokeWidth={2.4} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    flexWrap: Platform.OS === "web" ? "nowrap" : "wrap",
    alignItems: "stretch",
    gap: 10,
    width: "100%",
  },
  barStacked: {
    flexDirection: "column",
    flexWrap: "nowrap",
    gap: 8,
  },
  chip: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: Platform.OS === "web" ? 0 : 200,
    minWidth: Platform.OS === "web" ? 0 : 180,
    minHeight: 68,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Theme.borderLight,
    backgroundColor: Theme.cardWhite,
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 6,
  },
  chipStacked: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: "auto",
    width: "100%",
    minWidth: 0,
    minHeight: 60,
  },
  chipOpen: {
    borderColor: Theme.primary,
    backgroundColor: Theme.brandBlueWashSubtle,
  },
  chipLocked: { opacity: 0.5 },
  chipMain: {
    flex: 1,
    minWidth: 0,
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    gap: 8,
  },
  chipIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Theme.brandBlueSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  chipCopy: {
    flex: 1,
    minWidth: 0,
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 2,
  },
  chipLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: Theme.textMuted,
  },
  chipValue: {
    fontSize: 13,
    fontWeight: "700",
    color: Theme.textPrimaryDark,
    lineHeight: 17,
  },
  chipPlaceholder: {
    fontWeight: "500",
    color: Theme.textMuted,
  },
  chipClear: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  backdrop: {
    flex: 1,
    backgroundColor: Theme.overlayBackdrop,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  sheet: {
    width: "100%",
    maxWidth: 480,
    maxHeight: "80%",
    alignSelf: "center",
    backgroundColor: Theme.cardWhite,
    borderRadius: 18,
    overflow: "hidden",
    ...Platform.select({
      web: { boxShadow: `0 16px 40px ${Theme.brandBlueShadow}` } as object,
      default: {
        shadowColor: Theme.shadow,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.14,
        shadowRadius: 20,
        elevation: 12,
      },
    }),
  },
  sheetMobile: {
    maxWidth: "100%",
    maxHeight: "88%",
  },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Theme.textPrimaryDark,
  },
  sheetClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  menuSearch: {
    marginHorizontal: 12,
    marginBottom: 8,
    minHeight: 40,
    borderWidth: 1,
    borderColor: Theme.borderInput,
    borderRadius: 10,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Theme.surface,
  },
  menuSearchInput: {
    flex: 1,
    minHeight: 40,
    fontSize: 14,
    color: Theme.textPrimaryDark,
  },
  menuList: { maxHeight: 360 },
  option: {
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  optionActive: { backgroundColor: Theme.brandBlueSoft },
  optionLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: Theme.textPrimaryDark,
  },
  optionLabelActive: { color: Theme.primary },
  optionMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  countPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: Theme.surfaceGray,
  },
  optionCount: {
    fontSize: 11,
    fontWeight: "700",
    color: Theme.textSecondary,
  },
  emptyOption: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 13,
    color: Theme.textSecondary,
  },
  pressed: { opacity: 0.88 },
});
