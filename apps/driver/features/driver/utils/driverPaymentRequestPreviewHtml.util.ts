/**
 * Formal payment-request HTML for sharing with fleet / shipper (PDF + in-app preview).
 * Compact professional settlement layout — fits mobile preview without oversized type.
 */

function safe(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export type PaymentFollowUpHtmlInput = {
  fleetName: string;
  displayId: string;
  amount: number;
  from: string;
  to: string;
  status: string;
  tripDate: string;
  driverName?: string | null;
  driverPhone?: string | null;
  paymentRequestId?: string | null;
  /** ISO or display date for when this request document was issued. */
  issuedAt?: string | null;
};

/** Formal payment request voucher addressed to the paying party. */
export function buildEarningsPaymentFollowUpHtml(p: PaymentFollowUpHtmlInput): string {
  const party = safe(p.fleetName.trim() || "Accounts");
  const displayId = safe(p.displayId);
  const from = safe(p.from);
  const to = safe(p.to);
  const tripDate = safe(p.tripDate);
  const driverName = safe((p.driverName ?? "").trim() || "Driver");
  const driverPhone = (p.driverPhone ?? "").trim();
  const driverPhoneSafe = driverPhone ? safe(driverPhone) : "";
  const amountNum = Math.round(p.amount);
  const amount = amountNum.toLocaleString("en-IN");
  const issuedAt = safe(
    (p.issuedAt ?? "").trim() ||
      new Date().toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
  );
  const ref = p.paymentRequestId ? safe(String(p.paymentRequestId)) : null;
  const docNo = ref
    ? `PR-${ref.slice(0, 8).toUpperCase()}`
    : `PR-${displayId.replace(/[^a-zA-Z0-9]/g, "").slice(-8).toUpperCase() || "TRIP"}`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      font-size: 12px;
      line-height: 1.4;
      -webkit-font-smoothing: antialiased;
    }
    .page { padding: 10px 10px 14px; }
    .doc {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      overflow: hidden;
      background: #ffffff;
    }

    /* Header */
    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      padding: 12px 12px 10px;
      background: #0f172a;
      color: #ffffff;
    }
    .brandName {
      margin: 0;
      font-size: 15px;
      font-weight: 800;
      letter-spacing: -0.03em;
      line-height: 1.15;
    }
    .brandSub {
      margin: 4px 0 0;
      font-size: 9px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.58);
      font-weight: 700;
    }
    .docMeta { text-align: right; flex-shrink: 0; padding-top: 2px; }
    .docTitle {
      margin: 0;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #fbbf24;
    }
    .docNo {
      margin: 3px 0 0;
      font-size: 11px;
      font-weight: 700;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      color: rgba(255,255,255,0.92);
    }
    .docIssued {
      margin: 4px 0 0;
      font-size: 9px;
      color: rgba(255,255,255,0.55);
    }

    /* Parties — aligned two columns */
    .parties {
      display: grid;
      grid-template-columns: 1fr 1fr;
      border-bottom: 1px solid #e2e8f0;
      background: #f8fafc;
    }
    .party {
      padding: 10px 12px;
      min-width: 0;
    }
    .party + .party { border-left: 1px solid #e2e8f0; }
    .partyLabel {
      margin: 0 0 6px;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #64748b;
    }
    .partyName {
      margin: 0;
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.02em;
      word-break: break-word;
      line-height: 1.25;
    }
    .partyLine {
      margin: 5px 0 0;
      font-size: 11px;
      color: #64748b;
      word-break: break-word;
    }

    /* Amount — clear focal point */
    .amountStrip {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 10px 12px;
      border-bottom: 1px solid #e2e8f0;
      background: #fffbeb;
    }
    .amountLeft { min-width: 0; }
    .amountLabel {
      margin: 0;
      font-size: 9px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #92400e;
      font-weight: 800;
    }
    .amountValue {
      margin: 4px 0 0;
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.04em;
      color: #0f172a;
      line-height: 1.05;
      font-variant-numeric: tabular-nums;
    }
    .badge {
      flex-shrink: 0;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #92400e;
      background: #fef3c7;
      border: 1px solid #fcd34d;
      padding: 4px 8px;
      border-radius: 999px;
    }

    .intro {
      padding: 9px 12px;
      font-size: 11px;
      line-height: 1.4;
      color: #334155;
      border-bottom: 1px solid #e2e8f0;
    }
    .intro p { margin: 0; }

    /* Line item table — consistent columns */
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    th {
      text-align: left;
      font-size: 11px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #64748b;
      font-weight: 800;
      padding: 7px 12px;
      border-bottom: 1px solid #cbd5e1;
      background: #f1f5f9;
    }
    th.r, td.r { text-align: right; }
    th.c, td.c { text-align: center; }
    col.desc { width: 50%; }
    col.trip { width: 25%; }
    col.amt { width: 25%; }
    td {
      padding: 9px 12px;
      font-size: 12px;
      color: #0f172a;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
    }
    .route {
      margin: 0;
      font-weight: 800;
      font-size: 12px;
      letter-spacing: -0.015em;
      word-break: break-word;
      line-height: 1.3;
    }
    .meta {
      margin: 6px 0 0;
      font-size: 10px;
      color: #64748b;
      line-height: 1.4;
    }
    .tripId {
      display: inline-block;
      font-weight: 700;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 10px;
      word-break: break-all;
      line-height: 1.35;
    }
    .amt {
      font-weight: 800;
      font-size: 12px;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }

    /* Totals — right-aligned values */
    .totals {
      padding: 2px 12px 4px;
      background: #fafafa;
    }
    .totalsRow {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      padding: 7px 0;
      font-size: 12px;
      color: #334155;
      border-bottom: 1px solid #e2e8f0;
    }
    .totalsRow:last-child { border-bottom: 0; }
    .totalsRow .val {
      font-variant-numeric: tabular-nums;
      text-align: right;
      font-weight: 700;
    }
    .totalsRow.due {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
      padding-top: 12px;
      padding-bottom: 12px;
    }
    .totalsRow.due .val {
      color: #b45309;
      font-size: 14px;
    }

    /* Key facts — even two-column grid */
    .details {
      display: grid;
      grid-template-columns: 1fr 1fr;
      border-top: 1px solid #e2e8f0;
    }
    .detail {
      padding: 8px 12px;
      border-bottom: 1px solid #e2e8f0;
      min-width: 0;
    }
    .detail:nth-child(odd) { border-right: 1px solid #e2e8f0; }
    .detailK {
      margin: 0;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #64748b;
    }
    .detailV {
      margin: 5px 0 0;
      font-size: 11px;
      font-weight: 700;
      color: #0f172a;
      word-break: break-word;
      line-height: 1.3;
    }

    .note {
      padding: 9px 12px;
      font-size: 11px;
      line-height: 1.4;
      color: #334155;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
    }
    .note strong { color: #0f172a; }

    .footer {
      padding: 8px 12px 10px;
      font-size: 10px;
      line-height: 1.4;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
    }
    .footer strong { color: #64748b; font-weight: 700; }
  </style>
</head>
<body>
  <div class="page">
    <div class="doc">
      <div class="topbar">
        <div>
          <p class="brandName">Pulse</p>
          <p class="brandSub">Driver settlement</p>
        </div>
        <div class="docMeta">
          <p class="docTitle">Payment request</p>
          <p class="docNo">${docNo}</p>
          <p class="docIssued">${issuedAt}</p>
        </div>
      </div>

      <div class="parties">
        <div class="party">
          <p class="partyLabel">Bill to</p>
          <p class="partyName">${party}</p>
          <p class="partyLine">Trip settlement payable</p>
        </div>
        <div class="party">
          <p class="partyLabel">Requested by</p>
          <p class="partyName">${driverName}</p>
          ${driverPhoneSafe ? `<p class="partyLine">${driverPhoneSafe}</p>` : `<p class="partyLine">Pulse Driver</p>`}
        </div>
      </div>

      <div class="amountStrip">
        <div class="amountLeft">
          <p class="amountLabel">Amount due</p>
          <p class="amountValue">₹${amount}</p>
        </div>
        <div class="badge">Unpaid</div>
      </div>

      <div class="intro">
        <p>Please settle the outstanding amount for the completed trip below and mark payment received in Pulse, or share UTR / payment proof with the driver.</p>
      </div>

      <table>
        <colgroup>
          <col class="desc" />
          <col class="trip" />
          <col class="amt" />
        </colgroup>
        <thead>
          <tr>
            <th>Description</th>
            <th>Trip</th>
            <th class="r">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <p class="route">${from} → ${to}</p>
              <p class="meta">Trip settlement · ${tripDate}</p>
            </td>
            <td><span class="tripId">${displayId}</span></td>
            <td class="r amt">₹${amount}</td>
          </tr>
        </tbody>
      </table>

      <div class="totals">
        <div class="totalsRow">
          <span>Subtotal</span>
          <span class="val">₹${amount}</span>
        </div>
        <div class="totalsRow due">
          <span>Total due</span>
          <span class="val">₹${amount}</span>
        </div>
      </div>

      <div class="details">
        <div class="detail">
          <p class="detailK">Trip date</p>
          <p class="detailV">${tripDate}</p>
        </div>
        <div class="detail">
          <p class="detailK">Status</p>
          <p class="detailV">Payment pending</p>
        </div>
        <div class="detail">
          <p class="detailK">Paying party</p>
          <p class="detailV">${party}</p>
        </div>
        <div class="detail">
          <p class="detailK">Request ref</p>
          <p class="detailV">${ref ?? docNo}</p>
        </div>
      </div>

      <div class="note">
        <strong>Payment instruction.</strong>
        Kindly pay <strong>₹${amount}</strong> against trip <strong>${displayId}</strong>
        to <strong>${driverName}</strong>${driverPhoneSafe ? ` (${driverPhoneSafe})` : ""}.
      </div>

      <div class="footer">
        <strong>Generated from Pulse Driver</strong> · Settlement request for ${party}. Not a tax invoice.
      </div>
    </div>
  </div>
</body>
</html>`;
}

export type BulkPaymentFollowUpLine = {
  displayId: string;
  from: string;
  to: string;
  tripDate: string;
  amount: number;
};

/** Combined payment request for multiple due trips (same paying party). */
export function buildBulkEarningsPaymentFollowUpHtml(p: {
  fleetName: string;
  trips: BulkPaymentFollowUpLine[];
  driverName?: string | null;
  driverPhone?: string | null;
  paymentRequestId?: string | null;
  issuedAt?: string | null;
}): string {
  const party = safe(p.fleetName.trim() || "Accounts");
  const driverName = safe((p.driverName ?? "").trim() || "Driver");
  const driverPhone = (p.driverPhone ?? "").trim();
  const driverPhoneSafe = driverPhone ? safe(driverPhone) : "";
  const total = Math.round(p.trips.reduce((s, t) => s + (Number(t.amount) || 0), 0));
  const amount = total.toLocaleString("en-IN");
  const issuedAt = safe(
    (p.issuedAt ?? "").trim() ||
      new Date().toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
  );
  const ref = p.paymentRequestId ? safe(String(p.paymentRequestId)) : null;
  const docNo = ref
    ? `PR-${ref.slice(0, 8).toUpperCase()}`
    : `PR-BULK-${p.trips.length}`;

  const rows = p.trips
    .map((t) => {
      const from = safe(t.from);
      const to = safe(t.to);
      const displayId = safe(t.displayId);
      const tripDate = safe(t.tripDate);
      const lineAmt = Math.round(t.amount).toLocaleString("en-IN");
      return `<tr>
        <td>
          <p class="route">${from} → ${to}</p>
          <p class="meta">Trip settlement · ${tripDate}</p>
        </td>
        <td><span class="tripId">${displayId}</span></td>
        <td class="r amt">₹${lineAmt}</td>
      </tr>`;
    })
    .join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      font-size: 12px;
      line-height: 1.4;
      -webkit-font-smoothing: antialiased;
    }
    .page { padding: 10px 10px 14px; }
    .doc { border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; background: #ffffff; }
    .topbar {
      display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;
      padding: 12px 12px 10px; background: #0f172a; color: #ffffff;
    }
    .brandName { margin: 0; font-size: 15px; font-weight: 800; letter-spacing: -0.03em; }
    .brandSub {
      margin: 4px 0 0; font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase;
      color: rgba(255,255,255,0.58); font-weight: 700;
    }
    .docMeta { text-align: right; flex-shrink: 0; }
    .docTitle {
      margin: 0; font-size: 9px; font-weight: 800; letter-spacing: 0.12em;
      text-transform: uppercase; color: #fbbf24;
    }
    .docNo {
      margin: 3px 0 0; font-size: 11px; font-weight: 700;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      color: rgba(255,255,255,0.92);
    }
    .docIssued { margin: 2px 0 0; font-size: 9px; color: rgba(255,255,255,0.55); }
    .parties {
      display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #e2e8f0; background: #f8fafc;
    }
    .party { padding: 10px 12px; min-width: 0; }
    .party + .party { border-left: 1px solid #e2e8f0; }
    .partyLabel {
      margin: 0 0 3px; font-size: 9px; font-weight: 700; letter-spacing: 0.1em;
      text-transform: uppercase; color: #64748b;
    }
    .partyName {
      margin: 0; font-size: 13px; font-weight: 700; color: #0f172a;
      letter-spacing: -0.015em; word-break: break-word;
    }
    .partyLine { margin: 3px 0 0; font-size: 11px; color: #64748b; word-break: break-word; }
    .amountStrip {
      display: flex; align-items: center; justify-content: space-between; gap: 14px;
      padding: 10px 12px; border-bottom: 1px solid #e2e8f0; background: #fffbeb;
    }
    .amountLabel {
      margin: 0; font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase;
      color: #92400e; font-weight: 700;
    }
    .amountValue {
      margin: 4px 0 0; font-size: 22px; font-weight: 800; letter-spacing: -0.04em;
      color: #0f172a; line-height: 1.05; font-variant-numeric: tabular-nums;
    }
    .badge {
      flex-shrink: 0; font-size: 9px; font-weight: 800; letter-spacing: 0.06em;
      text-transform: uppercase; color: #92400e; background: #fef3c7;
      border: 1px solid #fcd34d; padding: 4px 8px; border-radius: 999px;
    }
    .intro {
      padding: 8px 12px; font-size: 14px; line-height: 1.5; color: #334155;
      border-bottom: 1px solid #e2e8f0;
    }
    .intro p { margin: 0; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th {
      text-align: left; font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase;
      color: #64748b; font-weight: 700; padding: 7px 12px;
      border-bottom: 1px solid #cbd5e1; background: #f1f5f9;
    }
    th.r, td.r { text-align: right; }
    col.desc { width: 50%; } col.trip { width: 25%; } col.amt { width: 25%; }
    td {
      padding: 8px 12px; font-size: 12px; color: #0f172a;
      border-bottom: 1px solid #e2e8f0; vertical-align: top;
    }
    .route {
      margin: 0; font-weight: 700; font-size: 12px; letter-spacing: -0.015em;
      word-break: break-word; line-height: 1.3;
    }
    .meta { margin: 3px 0 0; font-size: 10px; color: #64748b; line-height: 1.3; }
    .tripId {
      display: inline-block; font-weight: 700;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 10px; word-break: break-all;
    }
    .amt { font-weight: 700; font-size: 12px; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .totals { padding: 2px 12px 4px; background: #fafafa; }
    .totalsRow {
      display: flex; justify-content: space-between; align-items: center; gap: 16px;
      padding: 7px 0; font-size: 12px; color: #475569; border-bottom: 1px solid #e2e8f0;
    }
    .totalsRow:last-child { border-bottom: 0; }
    .totalsRow .val { font-variant-numeric: tabular-nums; text-align: right; font-weight: 700; }
    .totalsRow.due {
      font-size: 13px; font-weight: 800; color: #0f172a; padding-top: 8px; padding-bottom: 8px;
    }
    .totalsRow.due .val { color: #b45309; font-size: 14px; }
    .note {
      padding: 8px 12px; font-size: 14px; line-height: 1.5; color: #334155;
      background: #f8fafc; border-top: 1px solid #e2e8f0;
    }
    .note strong { color: #0f172a; }
    .footer {
      padding: 8px 12px 10px; font-size: 10px; line-height: 1.35; color: #94a3b8;
      border-top: 1px solid #e2e8f0;
    }
    .footer strong { color: #64748b; font-weight: 700; }
  </style>
</head>
<body>
  <div class="page">
    <div class="doc">
      <div class="topbar">
        <div>
          <p class="brandName">Pulse</p>
          <p class="brandSub">Driver settlement</p>
        </div>
        <div class="docMeta">
          <p class="docTitle">Payment request</p>
          <p class="docNo">${docNo}</p>
          <p class="docIssued">${issuedAt}</p>
        </div>
      </div>

      <div class="parties">
        <div class="party">
          <p class="partyLabel">Bill to</p>
          <p class="partyName">${party}</p>
          <p class="partyLine">${p.trips.length} trip${p.trips.length === 1 ? "" : "s"} · settlement payable</p>
        </div>
        <div class="party">
          <p class="partyLabel">Requested by</p>
          <p class="partyName">${driverName}</p>
          ${driverPhoneSafe ? `<p class="partyLine">${driverPhoneSafe}</p>` : `<p class="partyLine">Pulse Driver</p>`}
        </div>
      </div>

      <div class="amountStrip">
        <div>
          <p class="amountLabel">Total amount due</p>
          <p class="amountValue">₹${amount}</p>
        </div>
        <div class="badge">${p.trips.length} trips · unpaid</div>
      </div>

      <div class="intro">
        <p>Please settle the outstanding amount for the completed trips listed below and mark payment received in Pulse, or share UTR / payment proof with the driver.</p>
      </div>

      <table>
        <colgroup>
          <col class="desc" />
          <col class="trip" />
          <col class="amt" />
        </colgroup>
        <thead>
          <tr>
            <th>Description</th>
            <th>Trip</th>
            <th class="r">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <div class="totals">
        <div class="totalsRow">
          <span>Trips</span>
          <span class="val">${p.trips.length}</span>
        </div>
        <div class="totalsRow">
          <span>Subtotal</span>
          <span class="val">₹${amount}</span>
        </div>
        <div class="totalsRow due">
          <span>Total due</span>
          <span class="val">₹${amount}</span>
        </div>
      </div>

      <div class="note">
        <strong>Payment instruction.</strong>
        Kindly pay <strong>₹${amount}</strong> for the ${p.trips.length} listed trip${p.trips.length === 1 ? "" : "s"}
        to <strong>${driverName}</strong>${driverPhoneSafe ? ` (${driverPhoneSafe})` : ""}.
        ${ref ? ` Request reference: <strong>${ref}</strong>.` : ""}
      </div>

      <div class="footer">
        <strong>Generated from Pulse Driver</strong> · Combined settlement request for ${party}. Not a tax invoice.
      </div>
    </div>
  </div>
</body>
</html>`;
}
