type WithOperationalCode = {
  trip_operational_code?: string | null;
  indent_operational_code?: string | null;
  trip_code?: string | null;
  indent_code?: string | null;
  display_trip_id?: string | null;
  display_indent_id?: string | null;
  trip_number?: string | null;
  indent_number?: string | null;
  indent_reference_code?: string | null;
};

export function selectTripOperationalReference(row: WithOperationalCode): string {
  return (
    row.trip_operational_code ??
    row.trip_code ??
    row.display_trip_id ??
    row.trip_number ??
    "—"
  );
}

export function selectIndentOperationalReference(row: WithOperationalCode): string {
  return (
    row.indent_operational_code ??
    row.indent_code ??
    row.display_indent_id ??
    row.indent_number ??
    "—"
  );
}

export function selectTripIndentLineageLabel(row: WithOperationalCode): string | null {
  return (
    row.indent_reference_code ??
    row.indent_operational_code ??
    row.indent_code ??
    row.display_indent_id ??
    row.indent_number ??
    null
  );
}
