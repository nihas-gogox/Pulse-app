/**
 * Odometer entry — tappable readings strip, centered amount, docked keypad.
 */
import { memo, useCallback, useMemo } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import Feather from "@expo/vector-icons/Feather";

import { DecimalKeypad } from "@pulse/ui/components/mobile-input/DecimalKeypad";
import { NumericDisplay } from "@pulse/ui/components/mobile-input/NumericDisplay";
import {
  applyKeypadPress,
  type KeypadKey,
} from "@pulse/ui/components/mobile-input/keypad";
import { fullPageWizardStyles as wizard, WIZARD_ACCENT_SOFT } from "@pulse/ui/components/full-page-wizard/fullPageWizardStyles";
import Layout from "@pulse/core/constants/Layout";
import Theme from "@pulse/core/constants/Theme";

import { formatKm } from "@pulse/domain/features/trips/verification/selectors/verificationSelectors";

export type OdometerFieldId = "start" | "end";

export type OdometerKeypadFlowProps = {
  startRawValue: string;
  endRawValue: string;
  onStartRawChange: (raw: string) => void;
  onEndRawChange: (raw: string) => void;
  activeFieldId: OdometerFieldId;
  onActiveFieldChange?: (id: OdometerFieldId) => void;
  /** Optional secondary line under the field title (omit when shell already shows route). */
  contextLine?: string;
  tripDistanceKm?: number | null;
  /** Photo preview + scan banner above the readings strip. */
  bodyHeader?: React.ReactNode;
  extras?: React.ReactNode;
  /** Tighter layout when embedded in OdometerEntryShell. */
  shellMode?: boolean;
  /** Show camera badge on strip cells when a photo is attached. */
  startHasPhoto?: boolean;
  endHasPhoto?: boolean;
  /** Per-field photo URIs for strip thumbnails. */
  startPhotoUri?: string | null;
  endPhotoUri?: string | null;
  onFieldPhotoPress?: (fieldId: OdometerFieldId) => void;
};

/** Same pay keypad as FullscreenNumericEntry amount entry (equal cells, KEY_H_PAY). */
function KeypadDock({ onKey }: { onKey: (key: KeypadKey) => void }) {
  return (
    <DecimalKeypad
      onKey={onKey}
      showDecimal={false}
      variant="pay"
    />
  );
}

function rawToKm(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function formatReading(raw: string, km: number | null): string {
  if (raw.length > 0 && km != null) {
    return formatKm(km);
  }
  return "—";
}

function FieldPhotoThumb({
  uri,
  label,
  active,
  onPress,
}: {
  uri: string;
  label: string;
  active: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      style={[local.fieldThumbWrap, active && local.fieldThumbWrapActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} odometer photo`}
    >
      <Image source={{ uri }} style={local.fieldThumbImage} resizeMode="cover" />
      <Text style={[local.fieldThumbLabel, active && local.fieldThumbLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function ReadingsStrip({
  startRaw,
  endRaw,
  startKm,
  endKm,
  tripDistanceKm,
  activeFieldId,
  onActiveFieldChange,
  startHasPhoto,
  endHasPhoto,
  startPhotoUri,
  endPhotoUri,
  onFieldPhotoPress,
}: {
  startRaw: string;
  endRaw: string;
  startKm: number | null;
  endKm: number | null;
  tripDistanceKm: number | null;
  activeFieldId: OdometerFieldId;
  onActiveFieldChange?: (id: OdometerFieldId) => void;
  startHasPhoto?: boolean;
  endHasPhoto?: boolean;
  startPhotoUri?: string | null;
  endPhotoUri?: string | null;
  onFieldPhotoPress?: (fieldId: OdometerFieldId) => void;
}) {
  const cells = [
    {
      id: "start" as const,
      label: "Start",
      value: formatReading(startRaw, startKm),
      active: activeFieldId === "start",
      hasPhoto: startHasPhoto,
      selectable: onActiveFieldChange != null,
    },
    {
      id: "end" as const,
      label: "End",
      value: formatReading(endRaw, endKm),
      active: activeFieldId === "end",
      hasPhoto: endHasPhoto,
      selectable: onActiveFieldChange != null,
    },
    {
      id: "trip" as const,
      label: "Trip",
      value:
        tripDistanceKm != null && Number.isFinite(tripDistanceKm)
          ? formatKm(tripDistanceKm)
          : "—",
      active: false,
      hasPhoto: false,
      selectable: false,
    },
  ];

  return (
    <View style={local.readingsBlock}>
      {startPhotoUri?.trim() || endPhotoUri?.trim() ? (
        <View style={local.fieldThumbRow}>
          {startPhotoUri?.trim() ? (
            <FieldPhotoThumb
              uri={startPhotoUri.trim()}
              label="Start"
              active={activeFieldId === "start"}
              onPress={() => {
                onActiveFieldChange?.("start");
                onFieldPhotoPress?.("start");
              }}
            />
          ) : null}
          {endPhotoUri?.trim() ? (
            <FieldPhotoThumb
              uri={endPhotoUri.trim()}
              label="End"
              active={activeFieldId === "end"}
              onPress={() => {
                onActiveFieldChange?.("end");
                onFieldPhotoPress?.("end");
              }}
            />
          ) : null}
        </View>
      ) : null}

      <View style={local.readingsStrip}>
      {cells.map((cell, index) => {
        const Wrapper = cell.selectable ? Pressable : View;
        return (
          <Wrapper
            key={cell.id}
            style={[
              local.readingsCell,
              cell.active && local.readingsCellActive,
              index < cells.length - 1 && local.readingsCellBorder,
            ]}
            {...(cell.selectable
              ? {
                  onPress: () => onActiveFieldChange?.(cell.id as OdometerFieldId),
                  accessibilityRole: "button" as const,
                  accessibilityState: { selected: cell.active },
                }
              : {})}
          >
            <View style={local.readingsLabelRow}>
              <Text style={[local.readingsLabel, cell.active && local.readingsLabelActive]}>
                {cell.label}
              </Text>
              {cell.hasPhoto ? (
                <Feather
                  name="camera"
                  size={8}
                  color={cell.active ? Theme.primary : Theme.textMuted}
                />
              ) : null}
            </View>
            <Text
              style={[local.readingsValue, cell.active && local.readingsValueActive]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {cell.value}
            </Text>
          </Wrapper>
        );
      })}
      </View>
    </View>
  );
}

export const OdometerKeypadFlow = memo(function OdometerKeypadFlow({
  startRawValue,
  endRawValue,
  onStartRawChange,
  onEndRawChange,
  activeFieldId,
  onActiveFieldChange,
  contextLine,
  tripDistanceKm,
  bodyHeader,
  extras,
  shellMode = false,
  startHasPhoto = false,
  endHasPhoto = false,
  startPhotoUri,
  endPhotoUri,
  onFieldPhotoPress,
}: OdometerKeypadFlowProps) {
  const { width } = useWindowDimensions();
  const isDesktopKeypad = width >= Layout.wizardSteppedMaxWidth;

  const stripSelectsField = onActiveFieldChange != null;
  const activeRaw = activeFieldId === "start" ? startRawValue : endRawValue;
  const activeLabel = activeFieldId === "start" ? "Start KM" : "End KM";

  const startKm = useMemo(() => rawToKm(startRawValue), [startRawValue]);
  const endKm = useMemo(() => rawToKm(endRawValue), [endRawValue]);

  const handleKey = useCallback(
    (key: KeypadKey) => {
      const apply = activeFieldId === "start" ? onStartRawChange : onEndRawChange;
      apply(applyKeypadPress(activeRaw, key, { maxDecimalPlaces: 0 }));
    },
    [activeFieldId, activeRaw, onEndRawChange, onStartRawChange],
  );

  const amountPane = (
    <View style={[local.amountStack, shellMode && local.amountStackShell]}>
      {bodyHeader ? <View style={local.bodyHeader}>{bodyHeader}</View> : null}

      <ReadingsStrip
        startRaw={startRawValue}
        endRaw={endRawValue}
        startKm={startKm}
        endKm={endKm}
        tripDistanceKm={tripDistanceKm ?? null}
        activeFieldId={activeFieldId}
        onActiveFieldChange={onActiveFieldChange}
        startHasPhoto={startHasPhoto}
        endHasPhoto={endHasPhoto}
        startPhotoUri={startPhotoUri}
        endPhotoUri={endPhotoUri}
        onFieldPhotoPress={onFieldPhotoPress}
      />

      {!stripSelectsField || !shellMode ? (
        <View style={[local.labelBlock, shellMode && local.labelBlockShell]}>
          <Text style={local.fieldTitle}>{activeLabel}</Text>
          {contextLine && !shellMode ? (
            <Text style={local.fieldHint} numberOfLines={2}>
              {contextLine}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={local.displayWrap}>
        <NumericDisplay
          rawValue={activeRaw}
          type="distance"
          prefix=""
          suffix=" KM"
          placeholder="0"
          variant={shellMode ? "wizardCompact" : "wizard"}
        />
      </View>

      {extras ? <View style={local.extrasWrap}>{extras}</View> : null}
    </View>
  );

  if (isDesktopKeypad) {
    return (
      <View style={local.root}>
        <View style={wizard.wizardKeypadDesktopRow}>
          <View style={[wizard.wizardKeypadAmountPane, local.desktopPane]}>{amountPane}</View>
          <View style={wizard.wizardKeypadKeysPane}>
            <View style={local.keypadDockPay}>
              <KeypadDock onKey={handleKey} />
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={local.root}>
      <ScrollView
        style={local.scroll}
        contentContainerStyle={[local.scrollContent, shellMode && local.scrollContentShell]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {amountPane}
      </ScrollView>
      <View style={local.keypadDockPay}>
        <KeypadDock onKey={handleKey} />
      </View>
    </View>
  );
});

const local = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    width: "100%",
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 4,
    paddingBottom: 8,
  },
  scrollContentShell: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  /** Match FullscreenNumericEntry payBottom — keypad owns inset via PAY_KEYPAD_*. */
  keypadDockPay: {
    flexShrink: 0,
    alignSelf: "stretch",
    width: "100%",
    marginTop: "auto",
  },
  amountStack: {
    width: "100%",
    alignItems: "stretch",
    gap: 12,
    paddingHorizontal: Layout.screenPaddingHorizontal,
  },
  amountStackShell: {
    gap: 8,
    paddingTop: 0,
  },
  bodyHeader: {
    width: "100%",
    gap: 6,
  },
  readingsBlock: {
    width: "100%",
    gap: 6,
  },
  fieldThumbRow: {
    flexDirection: "row",
    gap: 8,
  },
  fieldThumbWrap: {
    width: 56,
    alignItems: "center",
    gap: 3,
    padding: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.borderLight,
    backgroundColor: Theme.cardWhite,
  },
  fieldThumbWrapActive: {
    borderColor: Theme.primary,
    backgroundColor: WIZARD_ACCENT_SOFT,
  },
  fieldThumbImage: {
    width: 48,
    height: 36,
    borderRadius: 6,
    backgroundColor: Theme.surface,
  },
  fieldThumbLabel: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: Theme.textMuted,
  },
  fieldThumbLabelActive: {
    color: Theme.primary,
  },
  desktopPane: {
    justifyContent: "flex-start",
    paddingTop: 8,
  },
  readingsStrip: {
    flexDirection: "row",
    alignItems: "stretch",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.borderLight,
    backgroundColor: Theme.cardWhite,
    overflow: "hidden",
  },
  readingsCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 8,
    paddingHorizontal: 5,
    minWidth: 0,
  },
  readingsCellActive: {
    backgroundColor: WIZARD_ACCENT_SOFT,
  },
  readingsCellBorder: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: Theme.borderLight,
  },
  readingsLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  readingsLabel: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.7,
    textTransform: "uppercase",
    color: Theme.textMuted,
    lineHeight: 11,
  },
  readingsLabelActive: {
    color: Theme.primary,
  },
  readingsValue: {
    fontSize: 11,
    fontWeight: "700",
    color: Theme.textSecondary,
    fontVariant: ["tabular-nums"],
    lineHeight: 14,
    textAlign: "center",
  },
  readingsValueActive: {
    fontSize: 12,
    fontWeight: "800",
    color: Theme.textPrimaryDark,
  },
  labelBlock: {
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 8,
  },
  labelBlockShell: {
    paddingTop: 0,
    marginTop: -4,
  },
  fieldTitle: {
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15,
    color: Theme.textPrimaryDark,
    textAlign: "center",
  },
  fieldHint: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "500",
    color: Theme.textSecondary,
    textAlign: "center",
  },
  displayWrap: {
    width: "100%",
    alignItems: "center",
    paddingVertical: 2,
  },
  extrasWrap: {
    width: "100%",
    gap: 8,
  },
});
