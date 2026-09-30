import {
  buildVerifiedExportCsvRow,
  verifiedExportRowsToCsv,
  VERIFIED_EXPORT_CSV_HEADERS,
} from "@/features/tripCompliance/utils/complianceVerifiedExport.util";
import type { ComplianceTripSummary } from "@/features/tripCompliance/tripCompliance.types";

function summary(overrides: {
  trip?: Partial<ComplianceTripSummary["trip"]>;
  documents?: ComplianceTripSummary["documents"];
}): ComplianceTripSummary {
  return {
    stage: "compliance_verified",
    trip: {
      id: "trip-1",
      organization_id: "org-1",
      client_name: "Sunflag",
      supplier_name: "Gogox Logistics",
      supplier_id: "sup-1",
      pickup_area: "Durgapur, West Bengal",
      drop_location: "Kolkata, West Bengal",
      vehicle_display_number: "WB11C8919",
      driver_display_name: "Ravi",
      driver_id: "drv-1",
      vehicle_id: "veh-1",
      pickup_date: "2026-09-23",
      started_at: "2026-09-23T09:24:00",
      client_price: 100000,
      supplier_rate: 80000,
      margin: 20000,
      load_tons: null,
      supplier_rate_basis: null,
      ...overrides.trip,
    } as ComplianceTripSummary["trip"],
    documents: overrides.documents ?? [
      {
        id: "d1",
        trip_id: "trip-1",
        document_type: "lr",
        file_name: "lr.pdf",
        storage_path: "p",
        uploaded_at: "2026-09-23T10:00:00Z",
        status: "verified",
        verified_by: null,
        verified_at: "2026-09-23T11:00:00Z",
        rejection_reason: null,
        document_number: "3277",
      },
      {
        id: "d2",
        trip_id: "trip-1",
        document_type: "invoice",
        file_name: "inv.pdf",
        storage_path: "p2",
        uploaded_at: "2026-09-23T10:00:00Z",
        status: "verified",
        verified_by: null,
        verified_at: "2026-09-23T11:00:00Z",
        rejection_reason: null,
        document_number: "INV-901",
      },
    ],
    documentCounts: { total: 2, verified: 2, rejected: 0, pending: 0 },
  } as ComplianceTripSummary;
}

describe("complianceVerifiedExport.util", () => {
  it("emits the payment-sheet header columns in order", () => {
    expect([...VERIFIED_EXPORT_CSV_HEADERS]).toEqual([
      "TRIP ID",
      "Verification status",
      "Loading date",
      "Intransit date",
      "Client sales invoice No",
      "Account No",
      "Beneficiary Name",
      "IFSC No",
      "Branch Name",
      "LR No",
      "Customer",
      "Supplier",
      "Source",
      "Destination",
      "Truck No",
      "Truck Type",
      "Driver name",
      "Driver No.",
      "C Price",
      "S Price",
      "% of advance",
      "Documentation charges",
      "TDS",
      "Final Advance",
      "Margin",
      "Margin %",
    ]);
  });

  it("maps trip + enrichment into aligned CSV cells", () => {
    const row = buildVerifiedExportCsvRow(summary({}), {
      supplierName: "Gogox Logistics",
      truckType: "32 FT",
      driverPhone: "9876543210",
      accountNumber: "123456789012",
      ifsc: "HDFC0001234",
      branchName: "Salt Lake",
      advancePercent: 90,
      tdsRatePercent: 2,
    });

    expect(row["Verification status"]).toBe("Verified");
    expect(row["Loading date"]).toBe("23 Sep 2026");
    expect(row["Client sales invoice No"]).toBe("INV-901");
    expect(row["LR No"]).toBe("3277");
    expect(row["Account No"]).toBe("123456789012");
    expect(row["Beneficiary Name"]).toBe("Gogox Logistics");
    expect(row["IFSC No"]).toBe("HDFC0001234");
    expect(row["Branch Name"]).toBe("Salt Lake");
    expect(row.Customer).toBe("Sunflag");
    expect(row.Supplier).toBe("Gogox Logistics");
    expect(row.Source).toContain("Durgapur");
    expect(row.Destination).toContain("Kolkata");
    expect(row["Truck Type"]).toBe("32 FT");
    expect(row["Driver No."]).toBe("9876543210");
    expect(row["C Price"]).toBe("100000");
    expect(row["S Price"]).toBe("80000");
    expect(row["% of advance"]).toBe("90");
    expect(row["Documentation charges"]).toBe("0");
    expect(row.TDS).toBe("1600");
    expect(row["Final Advance"]).toBe("70400");
    expect(row.Margin).toBe("20000");
    expect(row["Margin %"]).toBe("20");
  });

  it("serializes CSV with escaped commas", () => {
    const row = buildVerifiedExportCsvRow(
      summary({
        trip: { pickup_area: "Durgapur, West Bengal", drop_location: "Kolkata, West Bengal" },
      }),
      { supplierName: "Acme, Logistics" },
    );
    const csv = verifiedExportRowsToCsv([row]);
    const lines = csv.split("\n");
    expect(lines[0].startsWith("TRIP ID,Verification status,Loading date")).toBe(true);
    expect(lines[1]).toContain('"Acme, Logistics"');
    expect(lines[1]).toContain('"Durgapur, West Bengal"');
  });
});
