/**
 * Flight-style lane search — pick-only From / To / Vehicle dropdowns.
 * Typing is allowed only inside the open list, to search available options.
 * Shared by Marketplace Loads and Open Market.
 */
import Layout from "@/constants/Layout";
import Theme from "@/constants/Theme";
import {
  filterMarketplaceOptions,
  isMarketplaceLaneSelected,
  normalizeMarketplaceSearch,
  type MarketplaceLoadSearch,
  type MarketplaceSearchLane,
} from "@/features/network/utils/marketplaceSearch.util";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Flag,
  MapPin,
  Search,
  Truck,
  X,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Field = "pickup" | "drop" | "vehicle";

const FIELD_COPY: Record<
  Field,
  { label: string; menuTitle: string; placeholder: string; search: string }
> = {
  pickup: {
    label: "From",
    menuTitle: "Pickup location",
    placeholder: "Select pickup",
    search: "Search pickup",
  },
  drop: {
    label: "To",
    menuTitle: "Drop location",
    placeholder: "Select drop",
    search: "Search drop",
  },
  vehicle: {
    label: "Vehicle",
    menuTitle: "Vehicle type",
    placeholder: "Select vehicle",
    search: "Search vehicle",
  },
};

type Props = {
  visible: boolean;
  initial: MarketplaceLoadSearch | null;
  lanes: MarketplaceSearchLane[];
  lanesLoading?: boolean;
  eyebrow?: string;
  title?: string;
  onClose: () => void;
  onApply: (search: MarketplaceLoadSearch) => void;
};

export function MarketplaceSearchSheet({
  visible,
  initial,
  lanes,
  lanesLoading = false,
  eyebrow = "Marketplace",
  title = "Search live loads",
  onClose,
  onApply,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [pickup, setPickup] = useState("");
  const [drop, setDrop] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [openField, setOpenField] = useState<Field | null>(null);
  const [menuQuery, setMenuQuery] = useState("");

  useEffect(() => {
    if (!visible) return;
    const next = normalizeMarketplaceSearch(initial);
    setPickup(next.pickup);
    setDrop(next.drop);
    setVehicleType(next.vehicleType);
    setOpenField(null);
    setMenuQuery("");
  }, [visible, initial]);

  const draft = useMemo(
    () => normalizeMarketplaceSearch({ pickup, drop, vehicleType }),
    [pickup, drop, vehicleType],
  );
  const canSearch = isMarketplaceLaneSelected(lanes, draft);
  const splitRoute = width >= 640 && openField == null;

  const pickupOptions = useMemo(
    () =>
      filterMarketplaceOptions(
        lanes,
        draft,
        "pickup",
        openField === "pickup" ? menuQuery : "",
      ),
    [lanes, draft, openField, menuQuery],
  );
  const dropOptions = useMemo(
    () =>
      filterMarketplaceOptions(
        lanes,
        draft,
        "drop",
        openField === "drop" ? menuQuery : "",
      ),
    [lanes, draft, openField, menuQuery],
  );
  const vehicleOptions = useMemo(
    () =>
      filterMarketplaceOptions(
        lanes,
        draft,
        "vehicle",
        openField === "vehicle" ? menuQuery : "",
      ),
    [lanes, draft, openField, menuQuery],
  );

  const toggle = (field: Field) => {
    setMenuQuery("");
    setOpenField((current) => (current === field ? null : field));
  };

  const pick = (field: Field, label: string) => {
    setMenuQuery("");
    if (field === "pickup") {
      setPickup(label);
      setDrop("");
      setVehicleType("");
      setOpenField("drop");
      return;
    }
    if (field === "drop") {
      setDrop(label);
      setVehicleType("");
      setOpenField("vehicle");
      return;
    }
    setVehicleType(label);
    setOpenField(null);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, 18),
              maxHeight: Platform.OS === "web" ? 720 : "92%",
            },
          ]}
        >
          <View style={styles.hero}>
            <View style={styles.heroCopy}>
              <Text style={styles.sheetEyebrow}>{eyebrow}</Text>
              <Text style={styles.sheetTitle}>{title}</Text>
              <Text style={styles.sheetSub}>
                Live routes only — pick From, then To, then vehicle.
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeBtn,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Close search"
              hitSlop={Layout.touchTargetHitSlop}
            >
              <X size={18} color={Theme.textPrimaryDark} strokeWidth={2.2} />
            </Pressable>
          </View>

          <View style={styles.stepRow}>
            <StepPill
              index={1}
              label="From"
              done={Boolean(pickup)}
              current={openField === "pickup" || (!pickup && !drop)}
            />
            <View style={styles.stepLine} />
            <StepPill
              index={2}
              label="To"
              done={Boolean(drop)}
              current={Boolean(pickup) && (openField === "drop" || !drop)}
              locked={!pickup}
            />
            <View style={styles.stepLine} />
            <StepPill
              index={3}
              label="Vehicle"
              done={Boolean(vehicleType)}
              current={
                Boolean(pickup && drop) &&
                (openField === "vehicle" || !vehicleType)
              }
              locked={!pickup || !drop}
            />
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
          >
            <View style={styles.ticket}>
              <View style={splitRoute ? styles.routeRow : styles.routeStack}>
                <View style={splitRoute ? styles.routeCol : undefined}>
                  <SelectField
                    field="pickup"
                    step={1}
                    value={pickup}
                    options={pickupOptions}
                    open={openField === "pickup"}
                    menuQuery={menuQuery}
                    onToggle={() => toggle("pickup")}
                    onQuery={setMenuQuery}
                    onPick={(label) => pick("pickup", label)}
                    disabled={false}
                    lockHint=""
                  />
                </View>
                <View style={splitRoute ? styles.routeArrow : styles.railJoin}>
                  <View style={styles.arrowDisc}>
                    <ArrowRight size={14} color={Theme.primary} strokeWidth={2.4} />
                  </View>
                </View>
                <View style={splitRoute ? styles.routeCol : undefined}>
                  <SelectField
                    field="drop"
                    step={2}
                    value={drop}
                    options={dropOptions}
                    open={openField === "drop"}
                    menuQuery={menuQuery}
                    onToggle={() => toggle("drop")}
                    onQuery={setMenuQuery}
                    onPick={(label) => pick("drop", label)}
                    disabled={!pickup}
                    lockHint="Choose From first"
                  />
                </View>
              </View>

              <View style={styles.ticketDivider} />

              <SelectField
                field="vehicle"
                step={3}
                value={vehicleType}
                options={vehicleOptions}
                open={openField === "vehicle"}
                menuQuery={menuQuery}
                onToggle={() => toggle("vehicle")}
                onQuery={setMenuQuery}
                onPick={(label) => pick("vehicle", label)}
                disabled={!pickup || !drop}
                lockHint="Choose To first"
              />
            </View>

            {lanesLoading ? (
              <View style={styles.hintRow}>
                <ActivityIndicator size="small" color={Theme.primary} />
                <Text style={styles.hint}>Loading live routes…</Text>
              </View>
            ) : lanes.length === 0 ? (
              <Text style={styles.hint}>No open routes right now.</Text>
            ) : (
              <Text style={styles.hint}>
                Search is only inside each list — options come from live loads.
              </Text>
            )}
          </ScrollView>

          <Pressable
            onPress={() => {
              if (!canSearch) return;
              onApply(draft);
            }}
            disabled={!canSearch}
            style={({ pressed }) => [
              styles.searchBtn,
              !canSearch && styles.searchBtnDisabled,
              pressed && canSearch && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Search marketplace loads"
          >
            <Search size={16} color={Theme.textOnPrimary} strokeWidth={2.2} />
            <Text style={styles.searchBtnText}>Search this lane</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export function MarketplaceSearchSummaryChip({
  search,
  onPress,
}: {
  search: MarketplaceLoadSearch;
  onPress: () => void;
}) {
  const n = normalizeMarketplaceSearch(search);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.summaryChip,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel="Edit route filters"
    >
      <View style={styles.summaryIcon}>
        <MapPin size={12} color={Theme.primary} strokeWidth={2.4} />
      </View>
      <Text style={styles.summaryCity} numberOfLines={1}>
        {n.pickup}
      </Text>
      <ArrowRight size={12} color={Theme.textMuted} strokeWidth={2.4} />
      <Text style={styles.summaryCity} numberOfLines={1}>
        {n.drop}
      </Text>
      <View style={styles.summaryDot} />
      <Truck size={12} color={Theme.primary} strokeWidth={2.4} />
      <Text style={styles.summaryVehicle} numberOfLines={1}>
        {n.vehicleType}
      </Text>
    </Pressable>
  );
}

function StepPill({
  index,
  label,
  done,
  current,
  locked = false,
}: {
  index: number;
  label: string;
  done: boolean;
  current: boolean;
  locked?: boolean;
}) {
  return (
    <View
      style={[
        styles.stepPill,
        current && styles.stepPillCurrent,
        done && styles.stepPillDone,
        locked && styles.stepPillLocked,
      ]}
    >
      <View
        style={[
          styles.stepIndex,
          current && styles.stepIndexCurrent,
          done && styles.stepIndexDone,
        ]}
      >
        {done ? (
          <Check size={10} color={Theme.textOnPrimary} strokeWidth={3} />
        ) : (
          <Text
            style={[
              styles.stepIndexText,
              current && styles.stepIndexTextCurrent,
            ]}
          >
            {index}
          </Text>
        )}
      </View>
      <Text
        style={[
          styles.stepLabel,
          (current || done) && styles.stepLabelOn,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function FieldIcon({ field }: { field: Field }) {
  const color = Theme.primary;
  if (field === "pickup") return <MapPin size={15} color={color} strokeWidth={2.2} />;
  if (field === "drop") return <Flag size={15} color={color} strokeWidth={2.2} />;
  return <Truck size={15} color={color} strokeWidth={2.2} />;
}

function SelectField({
  field,
  step,
  value,
  options,
  open,
  menuQuery,
  onToggle,
  onQuery,
  onPick,
  disabled,
  lockHint,
}: {
  field: Field;
  step: number;
  value: string;
  options: { label: string; count: number }[];
  open: boolean;
  menuQuery: string;
  onToggle: () => void;
  onQuery: (text: string) => void;
  onPick: (label: string) => void;
  disabled: boolean;
  lockHint: string;
}) {
  const copy = FIELD_COPY[field];
  const noun =
    field === "pickup" ? "Pickup" : field === "drop" ? "Drop" : "Vehicle";
  return (
    <View style={styles.fieldBlock}>
      <Pressable
        onPress={disabled ? undefined : onToggle}
        disabled={disabled}
        style={({ pressed }) => [
          styles.select,
          open && styles.selectOpen,
          Boolean(value) && !open && styles.selectFilled,
          disabled && styles.selectDisabled,
          pressed && !disabled && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={
          field === "pickup"
            ? "Pickup city"
            : field === "drop"
              ? "Drop city"
              : "Vehicle type"
        }
        accessibilityState={{ disabled, expanded: open }}
      >
        <View style={styles.selectIcon}>
          <FieldIcon field={field} />
        </View>
        <View style={styles.selectCopy}>
          <Text style={styles.fieldLabel}>
            {step}. {copy.label}
          </Text>
          <Text
            style={[styles.selectValue, !value && styles.selectPlaceholder]}
            numberOfLines={1}
          >
            {disabled && !value ? lockHint || copy.placeholder : value || copy.placeholder}
          </Text>
        </View>
        <ChevronDown
          size={16}
          color={open ? Theme.primary : Theme.textMuted}
          strokeWidth={2.2}
        />
      </Pressable>
      {open ? (
        <View style={styles.dropdown}>
          <View style={styles.menuSearch}>
            <Search size={14} color={Theme.textSecondary} />
            <TextInput
              value={menuQuery}
              onChangeText={onQuery}
              placeholder={copy.search}
              placeholderTextColor={Theme.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.menuSearchInput}
              accessibilityLabel={`${copy.search} in list`}
            />
          </View>
          <ScrollView
            style={styles.menuList}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {options.length === 0 ? (
              <Text style={styles.emptyOption}>No matching live loads</Text>
            ) : (
              options.map((option) => {
                const selected = option.label === value;
                return (
                  <Pressable
                    key={`${field}-${option.label}`}
                    onPress={() => onPick(option.label)}
                    style={({ pressed }) => [
                      styles.option,
                      pressed && styles.pressed,
                      selected && styles.optionActive,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`${noun} ${option.label}, ${option.count} available`}
                  >
                    <Text
                      style={[
                        styles.optionLabel,
                        selected && styles.optionLabelActive,
                      ]}
                      numberOfLines={1}
                    >
                      {option.label}
                    </Text>
                    <View style={styles.optionMeta}>
                      <View style={styles.countPill}>
                        <Text style={styles.optionCount}>
                          {option.count} {option.count === 1 ? "load" : "loads"}
                        </Text>
                      </View>
                      {selected ? (
                        <Check size={14} color={Theme.primary} strokeWidth={2.4} />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: Theme.overlayBackdrop,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  sheet: {
    backgroundColor: Theme.cardWhite,
    borderRadius: 24,
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    overflow: "hidden",
    ...Platform.select({
      web: {
        boxShadow: `0 24px 64px ${Theme.brandBlueShadow}`,
      } as object,
      default: {
        shadowColor: Theme.shadow,
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.18,
        shadowRadius: 28,
        elevation: 16,
      },
    }),
  },
  hero: {
    backgroundColor: Theme.brandBlueSoft,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
    gap: 4,
  },
  sheetEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: Theme.primary,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
    color: Theme.textPrimaryDark,
  },
  sheetSub: {
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
    color: Theme.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Theme.cardWhite,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Theme.borderLight,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 4,
    gap: 6,
  },
  stepLine: {
    flex: 1,
    height: 1,
    backgroundColor: Theme.borderLight,
  },
  stepPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  stepPillCurrent: {},
  stepPillDone: {},
  stepPillLocked: { opacity: 0.42 },
  stepIndex: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Theme.surfaceGray,
    alignItems: "center",
    justifyContent: "center",
  },
  stepIndexCurrent: {
    backgroundColor: Theme.brandBlue,
  },
  stepIndexDone: {
    backgroundColor: Theme.primary,
  },
  stepIndexText: {
    fontSize: 10,
    fontWeight: "800",
    color: Theme.textSecondary,
  },
  stepIndexTextCurrent: {
    color: Theme.primary,
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: Theme.textMuted,
  },
  stepLabelOn: {
    color: Theme.textPrimaryDark,
  },
  body: { flexGrow: 0 },
  bodyContent: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 12,
  },
  ticket: {
    borderWidth: 1,
    borderColor: Theme.borderLight,
    borderRadius: 18,
    backgroundColor: Theme.surface,
    padding: 12,
    gap: 10,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  routeStack: {
    gap: 8,
  },
  routeCol: {
    flex: 1,
    minWidth: 0,
  },
  routeArrow: {
    paddingTop: 22,
    alignItems: "center",
  },
  railJoin: {
    alignItems: "center",
    marginVertical: -2,
  },
  arrowDisc: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Theme.cardWhite,
    borderWidth: 1,
    borderColor: Theme.borderLight,
    alignItems: "center",
    justifyContent: "center",
  },
  ticketDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Theme.borderLight,
    marginHorizontal: 2,
  },
  fieldBlock: { gap: 8 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: Theme.textMuted,
  },
  select: {
    minHeight: 64,
    borderWidth: 1,
    borderColor: Theme.borderLight,
    borderRadius: 14,
    backgroundColor: Theme.cardWhite,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  selectOpen: {
    borderColor: Theme.primary,
    backgroundColor: Theme.brandBlueWashSubtle,
  },
  selectFilled: {
    borderColor: Theme.brandBlue,
  },
  selectDisabled: { opacity: 0.55 },
  selectIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Theme.brandBlueSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  selectCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  selectValue: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
    color: Theme.textPrimaryDark,
  },
  selectPlaceholder: {
    fontWeight: "500",
    color: Theme.textMuted,
  },
  dropdown: {
    borderWidth: 1,
    borderColor: Theme.borderLight,
    borderRadius: 14,
    backgroundColor: Theme.cardWhite,
    overflow: "hidden",
  },
  menuSearch: {
    margin: 10,
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
  menuList: { maxHeight: 220 },
  option: {
    minHeight: 46,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
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
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 13,
    color: Theme.textSecondary,
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    color: Theme.textSecondary,
    paddingHorizontal: 2,
  },
  searchBtn: {
    minHeight: 50,
    marginHorizontal: 18,
    borderRadius: 16,
    backgroundColor: Theme.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  searchBtnDisabled: { opacity: 0.35 },
  searchBtnText: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
    color: Theme.textOnPrimary,
  },
  pressed: { opacity: 0.88 },
  summaryChip: {
    minHeight: 40,
    maxWidth: "100%",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: Theme.brandBlueSoft,
    borderWidth: 1,
    borderColor: Theme.brandBlue,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
  },
  summaryIcon: {
    width: 22,
    height: 22,
    borderRadius: 8,
    backgroundColor: Theme.cardWhite,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryCity: {
    fontSize: 13,
    fontWeight: "800",
    color: Theme.textPrimaryDark,
    maxWidth: 120,
  },
  summaryVehicle: {
    fontSize: 12,
    fontWeight: "700",
    color: Theme.primary,
    maxWidth: 110,
  },
  summaryDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: Theme.textMuted,
    marginHorizontal: 2,
  },
});
