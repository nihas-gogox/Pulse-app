jest.mock("jspdf", () => {
  const lines: string[] = [];
  return {
    jsPDF: class {
      setCreationDate() {}
      setProperties() {}
      setFont() {}
      setFontSize() {}
      setTextColor() {}
      setFillColor() {}
      setDrawColor() {}
      setLineWidth() {}
      rect() {}
      line() {}
      splitTextToSize(value: string) {
        return [String(value)];
      }
      text(line: string | string[]) {
        if (Array.isArray(line)) lines.push(...line);
        else lines.push(line);
      }
      output() {
        const body = `%PDF-1.3\n${lines.join("\n")}`;
        lines.length = 0;
        return Uint8Array.from(Buffer.from(body)).buffer;
      }
    },
  };
});

import { generateElrPdfBytes } from "@/features/trips/services/elrPdf.util";
import {
  buildElrSnapshot,
  canGenerateElrForTrip,
  elrActionLabel,
  elrDocumentLines,
  elrValidationMessage,
  elrVehicleChangedSinceSnapshot,
  isElrAfterLoadingStage,
  isElrEligible,
  isElrReadyToGenerate,
  readStoredElrSnapshot,
  serializeElrDocumentNumber,
  type ElrTripSource,
} from "@/features/trips/services/elrSnapshot.util";

const source: ElrTripSource = {
  tripId: "trip-1",
  tripNumber: "TRP051",
  organizationId: "org-a",
  viewerOrganizationId: "org-a",
  transporterName: "Pulse Haul",
  clientName: "ABC Steels",
  vehicleId: "veh-a",
  vehicleRegistration: "TN 01 AB 1234",
  driverName: "Ravi",
  driverPhone: "9876543210",
  origin: "Chennai",
  destination: "Bengaluru",
  pickupDate: "2026-09-29",
  loadType: "Coils",
  loadTons: 12,
  freight: 15000,
  freightBasis: "fixed",
  indentId: "IND045",
  generatedAt: "2026-09-29T08:00:00.000Z",
};

describe("buildElrSnapshot", () => {
  it("maps trip detail fields and leaves out data the trip does not have", () => {
    const built = buildElrSnapshot(source);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.snapshot.lrNumber).toBe("ELR-TRP051");
    expect(built.snapshot.consignor).toEqual({ name: "ABC Steels" });
    expect(built.snapshot.consignor.address).toBeUndefined();
    expect(built.snapshot.consignor.gstin).toBeUndefined();
    expect(built.snapshot.vehicle.registrationNumber).toBe("TN 01 AB 1234");
    expect(built.snapshot.vehicle.id).toBe("veh-a");
    expect(built.snapshot.route).toEqual({
      origin: "Chennai",
      destination: "Bengaluru",
    });
    expect(built.snapshot.driver).toEqual({
      name: "Ravi",
      phone: "9876543210",
    });
    expect(built.snapshot.cargo).toEqual({
      description: "Coils",
      weightTons: 12,
    });
    expect(built.snapshot.commercial?.freight).toBe(15000);
    expect("consignee" in built.snapshot).toBe(false);
  });

  it("does not invent a driver or cargo when they are absent", () => {
    const built = buildElrSnapshot({
      ...source,
      driverName: "  ",
      driverPhone: null,
      loadType: null,
      loadTons: null,
      freight: null,
      freightBasis: null,
      indentId: null,
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.snapshot.driver).toBeUndefined();
    expect(built.snapshot.cargo).toBeUndefined();
    expect(built.snapshot.commercial).toBeUndefined();
    expect(built.snapshot.trip.indentId).toBeUndefined();
  });

  it("blocks generation when a required field is missing", () => {
    const built = buildElrSnapshot({ ...source, vehicleRegistration: "" });
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.missing).toContain("Vehicle registration");
    expect(elrValidationMessage(built.missing)).toContain("Vehicle registration");
  });

  it("does not generate until the trip is past loading", () => {
    expect(isElrAfterLoadingStage("assigned")).toBe(false);
    expect(isElrAfterLoadingStage("in_progress")).toBe(false);
    expect(isElrAfterLoadingStage("picked_up")).toBe(false);
    expect(isElrAfterLoadingStage("in_transit")).toBe(true);
    expect(isElrAfterLoadingStage("unloading")).toBe(true);
    expect(isElrAfterLoadingStage("at_drop")).toBe(true);
    expect(isElrAfterLoadingStage("delivered")).toBe(true);
    expect(isElrAfterLoadingStage("completed")).toBe(true);
    expect(isElrAfterLoadingStage("cancelled")).toBe(false);
    expect(
      isElrReadyToGenerate({ vehicleId: "veh-a", tripStatus: "assigned" }),
    ).toBe(false);
    expect(
      isElrReadyToGenerate({ vehicleId: "veh-a", tripStatus: "in_transit" }),
    ).toBe(true);
    expect(
      isElrReadyToGenerate({ vehicleId: null, tripStatus: "in_transit" }),
    ).toBe(false);
    expect(
      isElrReadyToGenerate({
        vehicleId: null,
        vehicleRegistration: "8400164",
        tripStatus: "in_transit",
      }),
    ).toBe(true);
  });

  it("stays unavailable until a vehicle is assigned", () => {
    expect(isElrEligible({ vehicleId: null, driverId: "drv-1" })).toBe(false);
    expect(isElrEligible({ vehicleId: "  ", driverId: "drv-1" })).toBe(false);
    expect(isElrEligible({ vehicleId: "veh-a", driverId: null })).toBe(true);
    expect(isElrEligible({ vehicleId: null, driverId: null })).toBe(false);
    expect(
      isElrEligible({ vehicleId: null, vehicleRegistration: "8400164" }),
    ).toBe(true);
    const plateOnly = buildElrSnapshot({
      ...source,
      vehicleId: null,
      vehicleRegistration: "TN 01 AB 1234",
    });
    expect(plateOnly.ok).toBe(true);
    const noVehicle = buildElrSnapshot({
      ...source,
      vehicleId: null,
      vehicleRegistration: "",
    });
    expect(noVehicle.ok).toBe(false);
    if (noVehicle.ok) return;
    expect(noVehicle.missing).toContain("Vehicle assignment");
  });

  it("keeps the generated vehicle when the trip vehicle later changes", () => {
    const built = buildElrSnapshot(source);
    if (!built.ok) throw new Error("expected snapshot");
    const stored = readStoredElrSnapshot(serializeElrDocumentNumber(built.snapshot));
    expect(stored?.vehicle.id).toBe("veh-a");
    expect(stored?.vehicle.registrationNumber).toBe("TN 01 AB 1234");
    expect(elrVehicleChangedSinceSnapshot(built.snapshot, "veh-b")).toBe(true);
    expect(elrVehicleChangedSinceSnapshot(built.snapshot, "veh-a")).toBe(false);
    expect(stored?.vehicle.registrationNumber).toBe("TN 01 AB 1234");
  });

  it("treats convert the same way: eligible only when that trip has a vehicle", () => {
    expect(isElrEligible({ vehicleId: null })).toBe(false);
    expect(isElrEligible({ vehicleId: "veh-from-convert" })).toBe(true);
  });

  it("refuses a trip from another workspace", () => {
    expect(canGenerateElrForTrip("org-a", "org-b")).toBe(false);
    expect(canGenerateElrForTrip("org-a", "org-a")).toBe(true);
    const built = buildElrSnapshot({
      ...source,
      viewerOrganizationId: "org-b",
    });
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.missing).toContain("Workspace access");
  });

  it("keeps the original snapshot after it is stored", () => {
    const built = buildElrSnapshot(source);
    if (!built.ok) throw new Error("expected snapshot");
    const raw = serializeElrDocumentNumber(built.snapshot);
    expect(readStoredElrSnapshot(raw)).toEqual(built.snapshot);
    expect(readStoredElrSnapshot("BHD-4026")).toBeNull();
  });

  it("prints the same lines for the same snapshot", () => {
    const built = buildElrSnapshot(source);
    if (!built.ok) throw new Error("expected snapshot");
    expect(elrDocumentLines(built.snapshot)).toEqual(
      elrDocumentLines(built.snapshot),
    );
    expect(elrDocumentLines(built.snapshot).join("\n")).toContain("ELR-TRP051");
    expect(elrDocumentLines(built.snapshot).join("\n")).toContain("Chennai");
    expect(elrDocumentLines(built.snapshot).join("\n")).toContain("TN 01 AB 1234");
  });

  it("labels the trip action from whether an E-LR already exists", () => {
    expect(elrActionLabel(false)).toBe("Generate E-LR");
    expect(elrActionLabel(true)).toBe("View E-LR");
  });
});

describe("generateElrPdfBytes", () => {
  it("writes a PDF that contains the lorry receipt text", () => {
    const built = buildElrSnapshot(source);
    if (!built.ok) throw new Error("expected snapshot");
    const first = generateElrPdfBytes(built.snapshot);
    const second = generateElrPdfBytes(built.snapshot);
    const text = Buffer.from(first).toString("latin1");
    expect(text.startsWith("%PDF")).toBe(true);
    expect(text).toContain("ELR-TRP051");
    expect(text).toContain("ABC Steels");
    expect(text).toContain("Chennai");
    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true);
  });
});
