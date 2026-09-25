type TripLike = {
  trip_operational_code?: string | null;
  trip_code?: string | null;
  display_trip_id?: string | null;
  trip_number?: string | null;
};

type IndentLike = {
  indent_operational_code?: string | null;
  indent_code?: string | null;
  display_indent_id?: string | null;
  indent_number?: string | null;
};

type LineageLike = {
  indent_reference_code?: string | null;
  source_indent_code?: string | null;
  indent_operational_code?: string | null;
  indent_code?: string | null;
  display_indent_id?: string | null;
  indent_number?: string | null;
};

export function getTripOperationalDisplayCode(row: TripLike): string {
  return (
    row.trip_operational_code ??
    row.trip_code ??
    row.display_trip_id ??
    row.trip_number ??
    "—"
  );
}

export function getIndentOperationalDisplayCode(row: IndentLike): string {
  return (
    row.indent_operational_code ??
    row.indent_code ??
    row.display_indent_id ??
    row.indent_number ??
    "—"
  );
}

export function getIndentOperationalLineageCode(row: LineageLike): string | null {
  return (
    row.indent_reference_code ??
    row.source_indent_code ??
    row.indent_operational_code ??
    row.indent_code ??
    row.display_indent_id ??
    row.indent_number ??
    null
  );
}

type VehicleLike = {
  vehicle_operational_code?: string | null;
  vehicle_code?: string | null;
  vehicle_display_number?: string | null;
  vehicle_number?: string | null;
  registration_number?: string | null;
  id?: string | null;
};

type DriverLike = {
  driver_operational_code?: string | null;
  driver_code?: string | null;
  driver_display_name?: string | null;
  name?: string | null;
  phone?: string | null;
  id?: string | null;
};

export function getTripOperationalDisplay(row: TripLike): string {
  return getTripOperationalDisplayCode(row);
}

export function getIndentOperationalDisplay(row: IndentLike): string {
  return getIndentOperationalDisplayCode(row);
}

export function getVehicleOperationalDisplay(row: VehicleLike): string {
  return (
    row.vehicle_operational_code ??
    row.vehicle_code ??
    row.vehicle_display_number ??
    row.vehicle_number ??
    row.registration_number ??
    row.id ??
    "—"
  );
}

export function getDriverOperationalDisplay(row: DriverLike): string {
  return (
    row.driver_operational_code ??
    row.driver_code ??
    row.driver_display_name ??
    row.name ??
    row.phone ??
    row.id ??
    "—"
  );
}
