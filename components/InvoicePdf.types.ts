export interface InvoicePdfItem {
  key: string;
  tripId: string;
  route: string;
  /** Primary line title (e.g. Base freight / Freight charges…). */
  title?: string | null;
  /** Secondary line under title (route or trip id). */
  subtitle?: string | null;
  date: string;
  amount: number;
  /** Unit rate shown in Rate column (same as amount for qty=1 freight). */
  rate?: number | null;
  lineType: 'freight' | 'fuel' | 'additional';
  /** UUID of the parent trip when this line belongs under freight. */
  tripKey?: string | null;
  nested?: boolean;
  splitKind?: 'cn' | 'dn' | null;
  hsnSac?: string | null;
}

export interface InvoicePdfShipment {
  mode: 'single' | 'multi' | 'empty';
  trip_count: number;
  trip_id: string | null;
  trip_date: string | null;
  pickup: string | null;
  delivery: string | null;
  vehicle_notes: string | null;
  truck_no?: string | null;
  load_type?: string | null;
  lr_number?: string | null;
  trips: Array<{
    trip_id: string;
    trip_date: string;
    route: string;
    amount: number;
    truck_no?: string | null;
    load_type?: string | null;
    lr_number?: string | null;
  }>;
}

export interface InvoicePdfTaxRow {
  label: string;
  value: string;
}

export interface InvoicePdfData {
  documentKind: 'draft' | 'issued';
  brandingCompanyName: string;
  brandingLogoUrl: string | null;
  invoiceNo: string;
  invoiceNumberCaption: string;
  clientName: string;
  previewDate: string;
  indicativeDueDate: string | null;
  issuerAddressLines: string[];
  issuerPan: string | null;
  issuerGstin: string | null;
  issuerGstNotApplicable: boolean;
  /** Udyam / MSME — present only when stored on the workspace. Never invented. */
  issuerMsme: string | null;
  billingLines: string[];
  paymentTerms: string | null;
  notes: string | null;
  bankDetailsLines: string[];
  /** Indian Rupee … Only — empty when total is not finite. */
  amountInWords: string;
  shipment: InvoicePdfShipment;
  items: InvoicePdfItem[];
  taxableBase: number;
  taxRows: InvoicePdfTaxRow[];
  taxWarning: string | null;
  grandTotal: number;
}
