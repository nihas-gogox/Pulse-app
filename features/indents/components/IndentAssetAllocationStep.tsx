import { AlertCircle, Info, ListTodo } from "lucide-react-native";
import { memo, useMemo, useState } from "react";
import { ActivityIndicator, Switch, Text, View } from "react-native";

import Theme from "@/constants/Theme";
import { formatIndianVehicleNumber } from "@/lib/format";
import type { DriverRow } from "@/features/drivers/services/drivers.service";
import type { VehicleRow } from "@/features/vehicles/services/vehicles.service";
import { useFleetAssignmentAvailability } from "@/features/trips/hooks/useFleetAssignmentAvailability";
import {
  CreateTripDesktopEntityList,
  CreateTripDesktopListSection,
} from "@/features/trips/components/add-trip/CreateTripDesktopPickers";
import { entityInitials } from "@/features/trips/components/add-trip/CreateTripDesktopUi";
import { createTripDesktopStyles as s } from "@/features/trips/components/add-trip/createTripDesktop.styles";

export type IndentAssetAllocationStepProps = {
  orgId: string | null;
  drivers: DriverRow[];
  vehicles: VehicleRow[];
  assignDriverId: string | null;
  assignVehicleId: string | null | undefined;
  assignLater: boolean;
  onAssignLaterChange: (value: boolean) => void;
  onSelectDriver: (id: string) => void;
  onSelectVehicle: (id: string) => void;
  onAddDriver?: () => void;
  onAddVehicle?: () => void;
  compact?: boolean;
};

export const IndentAssetAllocationStep = memo(function IndentAssetAllocationStep({
  orgId,
  drivers,
  vehicles,
  assignDriverId,
  assignVehicleId,
  assignLater,
  onAssignLaterChange,
  onSelectDriver,
  onSelectVehicle,
  onAddDriver,
  onAddVehicle,
  compact = false,
}: IndentAssetAllocationStepProps) {
  const [driverListExpanded, setDriverListExpanded] = useState(!assignDriverId);
  const [vehicleListExpanded, setVehicleListExpanded] = useState(
    typeof assignVehicleId !== "string",
  );

  const fleet = useFleetAssignmentAvailability(orgId, {
    selectedDriverId: assignDriverId,
    selectedVehicleId: assignVehicleId,
  });

  const { isDriverBusy, isVehicleBusy, isLoading, driverBusySet, vehicleBusySet } =
    fleet;

  const driverOptions = useMemo(
    () =>
      drivers.map((driver) => ({
        ...driver,
        isBusy: isDriverBusy(String(driver.id)),
      })),
    [drivers, isDriverBusy, driverBusySet],
  );

  const vehicleOptions = useMemo(
    () =>
      vehicles.map((vehicle) => ({
        ...vehicle,
        isBusy: isVehicleBusy(String(vehicle.id)),
      })),
    [vehicles, isVehicleBusy, vehicleBusySet],
  );

  const assignLaterSwitchDisabled =
    !!assignDriverId && typeof assignVehicleId === "string";

  const warningLines = useMemo(() => {
    if (assignLater || isLoading) return [];
    const lines: string[] = [];
    if (driverOptions.some((d) => d.isBusy)) {
      lines.push(
        "Some drivers are on active trips — pick an available driver or use Assign later.",
      );
    }
    if (vehicleOptions.some((v) => v.isBusy)) {
      lines.push(
        "Busy vehicles are on trip — pick an available vehicle or use Assign later.",
      );
    }
    return lines;
  }, [assignLater, isLoading, driverOptions, vehicleOptions]);

  const driverListItems = useMemo(
    () =>
      driverOptions.map((driver) => ({
        id: driver.id,
        title: driver.name ?? "Driver",
        subtitle: driver.phone ?? driver.email ?? undefined,
        initials: entityInitials(driver.name ?? "DR"),
        entityType: "driver" as const,
        avatarUrl: driver.avatar_url ?? null,
        avatarSeed: driver.avatar_seed ?? null,
        disabled: driver.isBusy,
        statusLabel: driver.isBusy ? "On trip" : "Available",
        statusTone: driver.isBusy ? ("busy" as const) : ("available" as const),
      })),
    [driverOptions],
  );

  const vehicleListItems = useMemo(
    () =>
      vehicleOptions.map((vehicle) => {
        const tag =
          formatIndianVehicleNumber(vehicle.vehicle_number || "") ||
          vehicle.vehicle_number ||
          "Vehicle";
        const type = vehicle.vehicle_body_type || vehicle.vehicle_type || "—";
        return {
          id: vehicle.id,
          title: tag,
          subtitle: type,
          initials: tag.slice(0, 2).toUpperCase(),
          entityType: "vehicle" as const,
          disabled: vehicle.isBusy,
          statusLabel: vehicle.isBusy ? "On trip" : "Available",
          statusTone: vehicle.isBusy ? ("busy" as const) : ("available" as const),
        };
      }),
    [vehicleOptions],
  );

  return (
    <View style={[s.allocationStepBody, compact && s.compactAllocationStepBody]}>
      <View style={[s.allocDesktopToolbar, compact && s.compactAllocToolbar]}>
        <View style={s.sourceSummaryChip}>
          <Text style={s.sourceSummaryChipLabel}>Source</Text>
          <Text style={s.sourceSummaryChipValue}>Asset fleet</Text>
        </View>

        <View
          style={[
            s.inputBoxClean,
            s.allocAssignLaterBox,
            compact && s.compactAssignLaterBox,
          ]}
        >
          <ListTodo size={16} color={Theme.textRouteCard} strokeWidth={2} />
          <View style={s.allocAssignLaterCopy}>
            <Text style={s.allocAssignLaterTitle}>Assign later</Text>
            <Text style={s.allocAssignLaterSub}>
              Pick vehicle & driver on trip detail
            </Text>
          </View>
          <Switch
            value={assignLater}
            onValueChange={onAssignLaterChange}
            disabled={assignLaterSwitchDisabled}
            trackColor={{ false: Theme.borderLight, true: Theme.textPrimaryDark }}
            thumbColor={Theme.cardWhite}
          />
        </View>
      </View>

      {assignLaterSwitchDisabled ? (
        <Text style={s.allocAssignLaterHint}>
          Remove driver or vehicle assignment to enable assign later.
        </Text>
      ) : null}

      {assignLater ? (
        <View style={s.allocAssignLaterBanner}>
          <Info size={18} color={Theme.warning} strokeWidth={2.5} />
          <Text style={s.allocAssignLaterBannerText}>
            You have enabled{" "}
            <Text style={s.allocAssignLaterBannerStrong}>Assign Later</Text>. Driver and
            vehicle can be linked anytime after the trip is created.
          </Text>
        </View>
      ) : null}

      {!assignLater ? (
        <View style={s.allocationFleetPanel}>
          {warningLines.length > 0 ? (
            <View style={s.allocationWarnCompact}>
              <AlertCircle size={14} color={Theme.warning} strokeWidth={2.5} />
              <Text style={s.allocationWarnCompactText}>{warningLines[0]}</Text>
            </View>
          ) : null}

          {isLoading ? (
            <ActivityIndicator color={Theme.iconPrimary} style={{ marginVertical: 24 }} />
          ) : (
            <View style={compact ? s.compactStack : s.allocationColumns}>
              <CreateTripDesktopListSection
                heading="Select driver"
                count={drivers.length}
                onAddPress={onAddDriver}
                addAccessibilityLabel="Add driver"
              >
                <CreateTripDesktopEntityList
                  items={driverListItems}
                  selectedId={assignDriverId}
                  listExpanded={driverListExpanded || compact}
                  onExpandList={() => setDriverListExpanded(true)}
                  onSelect={(id) => {
                    const row = driverOptions.find((d) => d.id === id);
                    if (row?.isBusy) return;
                    onSelectDriver(id);
                    setDriverListExpanded(false);
                  }}
                  scrollMaxHeight={compact ? undefined : 280}
                  compact={compact}
                />
              </CreateTripDesktopListSection>

              <CreateTripDesktopListSection
                heading="Select vehicle"
                count={vehicles.length}
                onAddPress={onAddVehicle}
                addAccessibilityLabel="Add vehicle"
              >
                <CreateTripDesktopEntityList
                  items={vehicleListItems}
                  selectedId={
                    typeof assignVehicleId === "string" ? assignVehicleId : null
                  }
                  listExpanded={vehicleListExpanded || compact}
                  onExpandList={() => setVehicleListExpanded(true)}
                  onSelect={(id) => {
                    const row = vehicleOptions.find((v) => v.id === id);
                    if (row?.isBusy) return;
                    onSelectVehicle(id);
                    setVehicleListExpanded(false);
                  }}
                  scrollMaxHeight={compact ? undefined : 280}
                  compact={compact}
                />
              </CreateTripDesktopListSection>
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
});
