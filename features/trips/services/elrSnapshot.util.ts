/**
 * Electronic lorry receipt built from the trip detail the user already has.
 * Optional party fields are omitted when the trip does not carry them.
 */

export type ElrParty = {
  name: string;
  address?: string;
  city?: string;
  state?: string;
  pin?: string;
  gstin?: string;
  /** Set only when the operator marked the party registered or unregistered. */
  gstStatus?: "registered" | "unregistered";
};

export type ElrSnapshot = {
  tripId: string;
  lrNumber: string;
  generatedAt: string;
  workspaceId?: string;
  generatedBy?: string;
  consignor: ElrParty;
  consignee?: ElrParty;
  transporter: ElrParty;
  vehicle: {
    id?: string;
    registrationNumber: string;
    type?: string;
  };
  driver?: {
    name?: string;
    phone?: string;
    license?: string;
  };
  route: {
    origin: string;
    destination: string;
  };
  cargo?: {
    description?: string;
    quantity?: number;
    unit?: string;
    weight?: number;
    weightUnit?: "kg" | "tons";
    weightTons?: number;
    hsn?: string;
  };
  commercial?: {
    freight?: number;
    freightBasis?: string;
    goodsValue?: number;
    sourceDocument?: {
      type: "tax_invoice" | "bill_of_supply" | "delivery_challan" | "other";
      number: string;
      date: string;
    };
  };
  references?: {
    orderNumber?: string;
    ewayBillNumber?: string;
  };
  trip: {
    tripId: string;
    tripNumber: string;
    indentId?: string;
    tripDate: string;
  };
};

/** Fields the trip detail screen can pass without a second fetch. */
export type ElrTripSource = {
  tripId: string;
  tripNumber?: string | null;
  organizationId?: string | null;
  viewerOrganizationId?: string | null;
  transporterName?: string | null;
  clientId?: string | null;
  clientName?: string | null;
  /** Authoritative assignment. A plate without this id is not a vehicle assignment. */
  vehicleId?: string | null;
  vehicleRegistration?: string | null;
  /**
   * Only for replacing an unfinished receipt that already printed a registration.
   * A new E-LR still requires vehicleId.
   */
  allowRegistrationWithoutAssignment?: boolean;
  driverId?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  origin?: string | null;
  destination?: string | null;
  pickupDate?: string | null;
  loadType?: string | null;
  loadTons?: number | null;
  freight?: number | null;
  freightBasis?: string | null;
  indentId?: string | null;
  /** Indent row id, used only to look up an order reference. */
  indentRecordId?: string | null;
  /** Raw `trips.status`. Generate is offered only after loading. */
  tripStatus?: string | null;
  generatedAt?: string;
};

export type ElrBuildResult =
  | { ok: true; snapshot: ElrSnapshot }
  | { ok: false; missing: string[] };

const ELR_KIND = "e_lr";

export function elrNumberFromTripNumber(tripNumber: string): string {
  return `ELR-${tripNumber.trim()}`;
}

export function canGenerateElrForTrip(
  viewerOrganizationId: string | null | undefined,
  tripOrganizationId: string | null | undefined,
): boolean {
  const viewer = (viewerOrganizationId ?? "").trim();
  const tripOrg = (tripOrganizationId ?? "").trim();
  return viewer.length > 0 && viewer === tripOrg;
}

/** E-LR can be offered once a fleet vehicle or a trip plate is on the trip. */
export function isElrEligible(input: {
  vehicleId?: string | null;
  vehicleRegistration?: string | null;
  driverId?: string | null;
}): boolean {
  return trimmed(input.vehicleId).length > 0 || trimmed(input.vehicleRegistration).length > 0;
}

/**
 * Generate is for hub stages after loading: in transit, unloading, delivered,
 * and completed. Assigned / loading never unlock it. Later stages keep it.
 */
export function isElrAfterLoadingStage(
  status: string | null | undefined,
): boolean {
  const s = trimmed(status).toLowerCase().replace(/[\s-]+/g, "_");
  if (!s) return false;
  return !BEFORE_ELR_TRIP_STATUSES.has(s);
}

const BEFORE_ELR_TRIP_STATUSES = new Set([
  "draft",
  "cancelled",
  "unassigned",
  "assigned",
  "confirmed",
  "in_progress",
  "pickup",
  "s_in",
  "source_in",
  "loading",
  "picked_up",
]);

export function isElrReadyToGenerate(input: {
  vehicleId?: string | null;
  vehicleRegistration?: string | null;
  driverId?: string | null;
  tripStatus?: string | null;
}): boolean {
  return isElrEligible(input) && isElrAfterLoadingStage(input.tripStatus);
}

/** Historical E-LR keeps the vehicle it was generated with. */
export function elrVehicleChangedSinceSnapshot(
  snapshot: Pick<ElrSnapshot, "vehicle">,
  currentVehicleId: string | null | undefined,
): boolean {
  const recorded = trimmed(snapshot.vehicle.id);
  const current = trimmed(currentVehicleId);
  if (!recorded || !current) return false;
  return recorded !== current;
}

function trimmed(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function optionalPartyField(value: string | null | undefined): string | undefined {
  const text = trimmed(value);
  return text || undefined;
}

export function buildElrSnapshot(source: ElrTripSource): ElrBuildResult {
  const missing: string[] = [];
  const tripNumber = trimmed(source.tripNumber);
  const consignorName = trimmed(source.clientName);
  const transporterName = trimmed(source.transporterName);
  const vehicle = trimmed(source.vehicleRegistration);
  const vehicleId = trimmed(source.vehicleId);
  const origin = trimmed(source.origin);
  const destination = trimmed(source.destination);
  const tripDate = trimmed(source.pickupDate);
  const tripId = trimmed(source.tripId);

  if (!tripId) missing.push("Trip");
  if (!tripNumber) missing.push("Trip number");
  if (!consignorName) missing.push("Consignor");
  if (!transporterName) missing.push("Transporter");
  if (!vehicleId && !vehicle && !source.allowRegistrationWithoutAssignment) {
    missing.push("Vehicle assignment");
  }
  if (!vehicle) missing.push("Vehicle registration");
  if (!origin) missing.push("Origin");
  if (!destination) missing.push("Destination");
  if (!tripDate) missing.push("Trip date");
  if (
    !canGenerateElrForTrip(source.viewerOrganizationId, source.organizationId)
  ) {
    missing.push("Workspace access");
  }
  if (missing.length > 0) return { ok: false, missing };

  const driverName = optionalPartyField(source.driverName);
  const driverPhone = optionalPartyField(source.driverPhone);
  const description = optionalPartyField(source.loadType);
  const weight =
    source.loadTons != null && Number.isFinite(source.loadTons)
      ? source.loadTons
      : undefined;
  const indentId = optionalPartyField(source.indentId);
  const freightBasis = optionalPartyField(source.freightBasis);
  const freight =
    source.freight != null && Number.isFinite(source.freight)
      ? source.freight
      : undefined;

  const snapshot: ElrSnapshot = {
    tripId,
    lrNumber: elrNumberFromTripNumber(tripNumber),
    generatedAt: source.generatedAt ?? new Date().toISOString(),
    consignor: { name: consignorName },
    transporter: { name: transporterName },
    vehicle: {
      ...(vehicleId ? { id: vehicleId } : {}),
      registrationNumber: vehicle,
    },
    route: { origin, destination },
    trip: {
      tripId,
      tripNumber,
      tripDate,
      ...(indentId ? { indentId } : {}),
    },
  };
  if (driverName || driverPhone) {
    snapshot.driver = {
      ...(driverName ? { name: driverName } : {}),
      ...(driverPhone ? { phone: driverPhone } : {}),
    };
  }
  if (description || weight != null) {
    snapshot.cargo = {
      ...(description ? { description } : {}),
      ...(weight != null ? { weightTons: weight } : {}),
    };
  }
  if (freight != null || freightBasis) {
    snapshot.commercial = {
      ...(freight != null ? { freight } : {}),
      ...(freightBasis ? { freightBasis } : {}),
    };
  }
  return { ok: true, snapshot };
}

export function elrValidationMessage(missing: string[]): string {
  const lines = missing.map((item) => `- ${item}`).join("\n");
  return `Missing required trip information:\n${lines}`;
}

export function elrActionLabel(hasExisting: boolean): "View E-LR" | "Generate E-LR" {
  return hasExisting ? "View E-LR" : "Generate E-LR";
}

export type StoredElrDocument = {
  id: string;
  storagePath: string;
  snapshot: ElrSnapshot;
};

export function serializeElrDocumentNumber(snapshot: ElrSnapshot): string {
  return JSON.stringify({
    kind: ELR_KIND,
    lrNumber: snapshot.lrNumber,
    generatedAt: snapshot.generatedAt,
    snapshot,
  });
}

export function readStoredElrSnapshot(
  documentNumber: string | null | undefined,
): ElrSnapshot | null {
  const text = (documentNumber ?? "").trim();
  if (!text.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(text) as {
      kind?: unknown;
      snapshot?: ElrSnapshot;
    };
    if (parsed?.kind !== ELR_KIND || !parsed.snapshot?.lrNumber) return null;
    return parsed.snapshot;
  } catch {
    return null;
  }
}

/** Lines printed on the E-LR. Same snapshot always yields the same lines. */
export function elrDocumentLines(snapshot: ElrSnapshot): string[] {
  const lines = [
    "ELECTRONIC LORRY RECEIPT",
    snapshot.transporter.name,
    `LR No: ${snapshot.lrNumber}`,
    `Date: ${snapshot.trip.tripDate}`,
    "CONSIGNOR",
    snapshot.consignor.name,
    "TRANSPORT / VEHICLE",
    snapshot.transporter.name,
    `Vehicle No: ${snapshot.vehicle.registrationNumber}`,
    "ROUTE",
    `Origin: ${snapshot.route.origin}`,
    `Destination: ${snapshot.route.destination}`,
    "TRIP REFERENCE",
    `Trip: ${snapshot.trip.tripNumber}`,
  ];
  if (snapshot.consignee?.name) lines.push(`Consignee: ${snapshot.consignee.name}`);
  if (snapshot.consignee?.address) {
    lines.push(`Consignee address: ${formatPartyAddress(snapshot.consignee)}`);
  }
  if (snapshot.vehicle.type) lines.push(`Vehicle type: ${snapshot.vehicle.type}`);
  if (snapshot.driver?.name) lines.push(`Driver: ${snapshot.driver.name}`);
  if (snapshot.driver?.phone) lines.push(`Driver phone: ${snapshot.driver.phone}`);
  if (snapshot.driver?.license) lines.push(`Driver license: ${snapshot.driver.license}`);
  if (snapshot.cargo?.description) {
    lines.push(`Goods: ${snapshot.cargo.description}`);
  }
  if (snapshot.cargo?.quantity != null && snapshot.cargo.unit) {
    lines.push(`Quantity: ${snapshot.cargo.quantity} ${snapshot.cargo.unit}`);
  }
  if (snapshot.cargo?.weight != null && snapshot.cargo.weightUnit) {
    lines.push(`Weight: ${snapshot.cargo.weight} ${snapshot.cargo.weightUnit}`);
  } else if (snapshot.cargo?.weightTons != null) {
    lines.push(`Weight: ${snapshot.cargo.weightTons} tons`);
  }
  if (snapshot.cargo?.hsn) lines.push(`HSN: ${snapshot.cargo.hsn}`);
  if (snapshot.commercial?.goodsValue != null) {
    lines.push(`Goods value: ${snapshot.commercial.goodsValue}`);
  }
  if (snapshot.commercial?.sourceDocument) {
    lines.push(
      `Source document: ${snapshot.commercial.sourceDocument.number} ${snapshot.commercial.sourceDocument.date}`,
    );
  }
  if (snapshot.commercial?.freight != null) {
    lines.push(`Freight: ${snapshot.commercial.freight}`);
  }
  if (snapshot.commercial?.freightBasis) {
    lines.push(`Freight basis: ${snapshot.commercial.freightBasis}`);
  }
  if (snapshot.trip.indentId) lines.push(`Indent: ${snapshot.trip.indentId}`);
  if (snapshot.references?.orderNumber) {
    lines.push(`Order: ${snapshot.references.orderNumber}`);
  }
  if (snapshot.references?.ewayBillNumber) {
    lines.push(`E-way bill: ${snapshot.references.ewayBillNumber}`);
  }
  return lines;
}

function formatPartyAddress(party: ElrParty): string {
  return [party.address, party.city, party.state, party.pin].filter(Boolean).join(", ");
}
