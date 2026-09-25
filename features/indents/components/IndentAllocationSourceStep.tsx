import { Building2, Truck } from "lucide-react-native";
import { memo } from "react";
import { Pressable, Text, View } from "react-native";

import Theme from "@/constants/Theme";
import { SupplyAllocationModeBar } from "@/features/trips/components/SupplyAllocationModeBar";
import { DesktopSectionHeading } from "@/features/trips/components/add-trip/CreateTripDesktopUi";
import { createTripDesktopStyles as s } from "@/features/trips/components/add-trip/createTripDesktop.styles";

export type IndentAllocationSourceStepProps = {
  mode: "asset" | "aggregate";
  onModeChange: (mode: "asset" | "aggregate") => void;
  compact?: boolean;
  allowedModes?: readonly ("asset" | "aggregate")[];
};

export const IndentAllocationSourceStep = memo(function IndentAllocationSourceStep({
  mode,
  onModeChange,
  compact = false,
  allowedModes = ["asset", "aggregate"],
}: IndentAllocationSourceStepProps) {
  const isAsset = mode === "asset";
  const isAggregate = mode === "aggregate";

  return (
    <View style={[s.stepBody, compact && s.compactStepBody]}>
      <View style={s.stepSection}>
        {compact ? (
          <SupplyAllocationModeBar
            variant="wizard"
            layout="stack"
            mode={isAsset ? "asset" : "aggregate"}
            onModeChange={onModeChange}
            assignLater={false}
            onAssignLaterChange={() => undefined}
            showAssignLater={false}
            allowedModes={allowedModes}
            aggregateTitle="Aggregate"
            aggregateSubtitle="Sub-assign to a network supplier"
          />
        ) : (
          <>
            <DesktopSectionHeading>Supply source *</DesktopSectionHeading>
            <View style={s.sourceModeRow}>
              {allowedModes.includes("asset") ? (
                <Pressable
                  style={[s.sourceModeCard, isAsset && s.sourceModeCardActive]}
                  onPress={() => onModeChange("asset")}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isAsset }}
                >
                  <View
                    style={[s.sourceModeIcon, isAsset && s.sourceModeIconActive]}
                  >
                    <Truck
                      size={20}
                      color={isAsset ? Theme.textOnPrimary : Theme.textRouteCard}
                      strokeWidth={2.25}
                    />
                  </View>
                  <View style={s.sourceModeCopy}>
                    <Text
                      style={[
                        s.sourceModeTitle,
                        isAsset && s.sourceModeTitleActive,
                      ]}
                    >
                      Asset
                    </Text>
                    <Text style={s.sourceModeSub}>
                      Use your own drivers and vehicles
                    </Text>
                  </View>
                </Pressable>
              ) : null}

              {allowedModes.includes("aggregate") ? (
                <Pressable
                  style={[
                    s.sourceModeCard,
                    isAggregate && s.sourceModeCardActive,
                  ]}
                  onPress={() => onModeChange("aggregate")}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isAggregate }}
                >
                  <View
                    style={[
                      s.sourceModeIcon,
                      isAggregate && s.sourceModeIconActive,
                    ]}
                  >
                    <Building2
                      size={20}
                      color={
                        isAggregate ? Theme.textOnPrimary : Theme.textRouteCard
                      }
                      strokeWidth={2.25}
                    />
                  </View>
                  <View style={s.sourceModeCopy}>
                    <Text
                      style={[
                        s.sourceModeTitle,
                        isAggregate && s.sourceModeTitleActive,
                      ]}
                    >
                      Aggregate
                    </Text>
                    <Text style={s.sourceModeSub}>
                      Sub-assign to a network supplier
                    </Text>
                  </View>
                </Pressable>
              ) : null}
            </View>
          </>
        )}
      </View>

      <View
        style={[s.sourceGuidanceBanner, compact && s.compactSourceGuidanceBanner]}
      >
        <Text
          style={[s.sourceGuidanceTitle, compact && s.compactSourceGuidanceTitle]}
        >
          Next: Allocation
        </Text>
        <Text
          style={[s.sourceGuidanceText, compact && s.compactSourceGuidanceText]}
        >
          {isAsset
            ? "Assign a fleet driver and vehicle together, or choose Assign later on the next step."
            : "Pick a partner and rate, then add tracking details — or Assign later on the next step."}
        </Text>
      </View>
    </View>
  );
});
