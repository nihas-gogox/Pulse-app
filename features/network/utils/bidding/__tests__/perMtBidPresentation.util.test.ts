import { VEHICLE_TYPES } from "@/features/indents/constants";
import {
  formatWeightChip,
  parseTonnageFromVehicleType,
  perMtEstimateChipTonnes,
  resolveExpectedTripValue,
  resolveVehiclePayloadTonnes,
  storedBidFromUnitRate,
  unitRateFromStoredBid,
} from "@/features/network/utils/bidding/perMtBidPresentation.util";

describe("parseTonnageFromVehicleType", () => {
  it("reads MT payloads, including Add Vehicle labels", () => {
    expect(parseTonnageFromVehicleType("16 MT")).toBe(16);
    expect(parseTonnageFromVehicleType("21MT")).toBe(21);
    expect(parseTonnageFromVehicleType("7 mt")).toBe(7);
    expect(parseTonnageFromVehicleType("20 ft - 7 MT")).toBe(7);
    expect(parseTonnageFromVehicleType("32 FT MXL 18 MT")).toBe(18);
    expect(parseTonnageFromVehicleType("Canter / 709 14 ft - 3.5 MT")).toBe(3.5);
  });
});

describe("resolveVehiclePayloadTonnes — Create Trip catalog", () => {
  it("maps 10 FT to 10 FT payload, not 21T", () => {
    expect(resolveVehiclePayloadTonnes("10 FT")).toBe(3.5);
  });

  it("uses Add Vehicle MT where Create Trip only has body length", () => {
    expect(resolveVehiclePayloadTonnes("14 FT")).toBe(3.5);
    expect(resolveVehiclePayloadTonnes("Eicher 14ft")).toBe(3.5);
    expect(resolveVehiclePayloadTonnes("17 FT")).toBe(5);
    expect(resolveVehiclePayloadTonnes("Taurus 17ft")).toBe(5);
    expect(resolveVehiclePayloadTonnes("20 FT")).toBe(7);
    expect(resolveVehiclePayloadTonnes("Container 20ft")).toBe(7);
    expect(resolveVehiclePayloadTonnes("32 Ft MXL")).toBe(18);
    expect(resolveVehiclePayloadTonnes("32 Ft SXL")).toBe(7);
    expect(resolveVehiclePayloadTonnes("32FT Container")).toBe(18);
    expect(resolveVehiclePayloadTonnes("40 FT")).toBe(25);
    expect(resolveVehiclePayloadTonnes("Tata Ace")).toBe(0.75);
  });

  it("does not invent payload for generic Create Trip types", () => {
    for (const type of [
      "Truck",
      "Trailer",
      "Container",
      "Tipper",
      "Open Body",
      "Tanker",
    ]) {
      expect(resolveVehiclePayloadTonnes(type)).toBeNull();
    }
  });

  it("resolves every Create Trip VEHICLE_TYPES entry that is FT, MT, or a named LCV", () => {
    const expectedNull = new Set([
      "Trailer",
      "Container",
      "Truck",
      "Tipper",
      "Open Body",
      "Tanker",
    ]);
    for (const type of VEHICLE_TYPES) {
      const payload = resolveVehiclePayloadTonnes(type);
      if (expectedNull.has(type)) {
        expect(payload).toBeNull();
      } else {
        expect(payload).toEqual(expect.any(Number));
      }
    }
  });
});

describe("formatWeightChip", () => {
  it("never renders a false zero", () => {
    expect(formatWeightChip(0)).toBeUndefined();
    expect(formatWeightChip(null)).toBeUndefined();
    expect(formatWeightChip(9)).toBe("9T");
  });
});

describe("unit ↔ stored conversion", () => {
  it("divides a trip-total bid back to ₹/MT when tonnes are known", () => {
    expect(unitRateFromStoredBid(124_256, 38.83)).toBe(3200);
    expect(storedBidFromUnitRate(3200, 38.83)).toBe(124_256);
  });

  it("leaves the figure alone when weight is missing", () => {
    expect(unitRateFromStoredBid(5320, null)).toBe(5320);
    expect(storedBidFromUnitRate(5320, null)).toBe(5320);
    expect(storedBidFromUnitRate(5320, 0)).toBe(5320);
  });
});

describe("resolveExpectedTripValue", () => {
  it("uses indent weight as the real trip total", () => {
    expect(
      resolveExpectedTripValue({
        unitRateInr: 5320,
        indentTonnes: 9,
        vehicleType: "16 MT",
        estimateTonnes: 16,
      }),
    ).toEqual({ tonnes: 9, amountInr: 47_880, source: "indent_weight" });
  });

  it("uses 10 FT payload instead of a 21T chip", () => {
    expect(
      resolveExpectedTripValue({
        unitRateInr: 5200,
        indentTonnes: null,
        vehicleType: "10 FT",
        estimateTonnes: 21,
      }),
    ).toEqual({ tonnes: 3.5, amountInr: 18_200, source: "vehicle_type" });
  });

  it("does not invent a number for a generic truck", () => {
    expect(
      resolveExpectedTripValue({
        unitRateInr: 5320,
        indentTonnes: 0,
        vehicleType: "Truck",
        estimateTonnes: null,
      }),
    ).toBeNull();
  });
});

describe("perMtEstimateChipTonnes", () => {
  it("does not offer 7/9/16/21T on a 10 FT load", () => {
    expect(perMtEstimateChipTonnes("10 FT")).toEqual([]);
    expect(perMtEstimateChipTonnes("18 MT")).toEqual([]);
  });
});
