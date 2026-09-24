/** Pure parsers for Indian expense receipt OCR — unit-tested, used by the vision service. */

export function parseIndianAmount(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;

  const raw = typeof value === "object" && value !== null && "value" in value
    ? (value as { value: unknown }).value
    : value;

  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw !== "string") return null;

  const cleaned = raw
    .trim()
    .replace(/^(rs\.?|inr\.?|₹)\s*/i, "")
    .replace(/[₹$]/g, "")
    .replace(/\s+/g, "")
    .replace(/,/g, "");

  if (!cleaned) return null;

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function parseLiters(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value) && value > 0 && value < 10_000) {
    return value;
  }

  const raw = typeof value === "object" && value !== null && "value" in value
    ? (value as { value: unknown }).value
    : value;

  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0 && raw < 10_000) {
    return raw;
  }
  if (typeof raw !== "string") return null;

  const cleaned = raw
    .trim()
    .replace(/\blit(?:re)?s?\b/gi, "")
    .replace(/L$/i, "")
    .replace(/\s+/g, "")
    .replace(/,/g, "");

  if (!cleaned) return null;

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed > 0 && parsed < 10_000 ? parsed : null;
}

export function strField(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed && !/^not\s*entered$/i.test(trimmed) ? trimmed : null;
  }
  if (typeof value === "object" && "value" in value) {
    return strField((value as { value: unknown }).value);
  }
  const asString = String(value).trim();
  return asString && !/^not\s*entered$/i.test(asString) ? asString : null;
}

const INDIAN_STATE_NAMES =
  /^(andhra pradesh|arunachal pradesh|assam|bihar|chhattisgarh|goa|gujarat|haryana|himachal pradesh|jharkhand|karnataka|kerala|madhya pradesh|maharashtra|manipur|meghalaya|mizoram|nagaland|odisha|punjab|rajasthan|sikkim|tamil nadu|telangana|tripura|uttar pradesh|uttarakhand|west bengal|delhi|nct of delhi)$/i;

export function normalizeCity(value: unknown): string | null {
  const text = strField(value);
  if (!text) return null;

  const cleaned = text
    .replace(/\b\d{6}\b/g, "")
    .replace(/\bindia\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (cleaned.length < 2 || INDIAN_STATE_NAMES.test(cleaned)) return null;
  return cleaned;
}

export function inferCityFromAddress(address: string): string | null {
  const trimmed = address.trim();
  if (!trimmed) return null;

  const roadTail = trimmed.match(
    /(?:road|rd|nh|sh|highway|mc\s*road|main\s*road|expressway)\s+(.+)$/i,
  );
  if (roadTail?.[1]) {
    const city = normalizeCity(roadTail[1]);
    if (city) return city;
  }

  const parts = trimmed
    .split(/[,|\n/]/)
    .map((part) => part.trim())
    .filter(Boolean);

  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const part = parts[i]
      .replace(/\b\d{6}\b/g, "")
      .replace(/\bindia\b/gi, "")
      .trim();
    if (!part || part.length < 2) continue;
    if (INDIAN_STATE_NAMES.test(part)) continue;
    if (/^\d+$/.test(part)) continue;

    const roadSplit = part.match(
      /(?:road|rd|nh|sh|highway|mc\s*road|main\s*road)\s+(.+)$/i,
    );
    if (roadSplit?.[1]) {
      const city = normalizeCity(roadSplit[1]);
      if (city) return city;
    }

    if (/^(road|rd|street|st|highway|nh|sh|midc|sector|phase|plot|gate|near|opposite)/i.test(part)) {
      continue;
    }
    return normalizeCity(part);
  }

  const tokens = trimmed.split(/\s+/);
  if (tokens.length >= 2) {
    const last = normalizeCity(tokens[tokens.length - 1]);
    if (last && last.length >= 3) return last;
  }

  return null;
}

export const AMOUNT_FIELD_KEYS = [
  "amount_inr",
  "amount",
  "sale",
  "sale_amount",
  "sale_value",
  "total_amount",
  "total_inr",
  "grand_total",
  "net_amount",
  "paid_amount",
  "bill_amount",
  "total",
  "total_paid",
  "invoice_amount",
  "preset",
  "preset_amount",
] as const;

export const LITERS_FIELD_KEYS = [
  "liters",
  "volume",
  "quantity",
  "fuel_volume",
  "volume_liters",
  "volume_l",
  "qty",
] as const;

export const VENDOR_FIELD_KEYS = [
  "vendor_name",
  "dealer_name",
  "agency_name",
  "outlet_name",
  "merchant_name",
  "station_name",
  "pump_name",
] as const;

export function buildReceiptNotes(parsed: Record<string, unknown>, existingNotes: string | null): string | null {
  const parts: string[] = [];

  const billNo =
    strField(parsed.bill_no) ??
    strField(parsed.bill_number) ??
    strField(parsed.invoice_no) ??
    strField(parsed.invoice_number);
  const date =
    strField(parsed.bill_date) ??
    strField(parsed.date) ??
    strField(parsed.transaction_date);
  const rate = parseIndianAmount(parsed.rate ?? parsed.rate_per_liter ?? parsed.price_per_liter);
  const volume = parseLiters(parsed.volume ?? parsed.liters ?? parsed.quantity);
  const density = strField(parsed.density);
  const preset = parseIndianAmount(parsed.preset ?? parsed.preset_amount);
  const fpId = strField(parsed.fp_id) ?? strField(parsed.fuel_point_id) ?? strField(parsed.fp);
  const nozzle = strField(parsed.nozzle_no) ?? strField(parsed.nozzle_number) ?? strField(parsed.nozl_no);
  const brand = strField(parsed.brand) ?? strField(parsed.oil_company) ?? strField(parsed.company);
  const txnId = strField(parsed.transaction_id) ?? strField(parsed.trns_id);
  const phone = strField(parsed.phone) ?? strField(parsed.mobile_no) ?? strField(parsed.phone_number);

  if (billNo) parts.push(`Bill ${billNo}`);
  if (date) parts.push(date);
  if (brand) parts.push(brand);
  if (rate != null) parts.push(`Rate ₹${rate.toFixed(2)}/L`);
  if (volume != null) parts.push(`${volume} L`);
  if (density) parts.push(`Density ${density}`);
  if (preset != null) parts.push(`Preset ₹${Math.round(preset)}`);
  if (fpId) parts.push(`FP ${fpId}`);
  if (nozzle) parts.push(`Nozzle ${nozzle}`);
  if (txnId) parts.push(`Txn ${txnId}`);
  if (phone) parts.push(`Ph ${phone}`);
  if (existingNotes && !parts.includes(existingNotes)) parts.push(existingNotes);

  return parts.length > 0 ? parts.join(" · ") : null;
}
