import React, { useMemo, useRef, useState } from 'react';
import type { InvoicePdfData } from '@/components/InvoicePdf.types';
import { InvoiceGogoxWordmark } from '@/features/invoicing/components/InvoiceGogoxWordmark';
import { buildInvoicePdfTableRows } from '@/features/invoicing/services/invoiceCnDn.service';
import { resolveInvoiceHeaderLogo } from '@/features/invoicing/utils/invoiceLogo.util';
import Theme from '@/constants/Theme';

const font =
  'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif';

const ink = Theme.textPrimaryDark;
const muted = Theme.textMuted;
const softRule = Theme.borderMedium;
const accent = Theme.accentBrown;
const accentDeep = Theme.accentBrownDeep;

function formatPlainAmount(amount: number): string {
  return amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatTaxInvoiceDate(value: string | null | undefined): string {
  const raw = (value ?? '').trim();
  if (!raw) return '';
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  const dd = String(parsed.getDate()).padStart(2, '0');
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${parsed.getFullYear()}`;
}

function pageStyle(): React.CSSProperties {
  return {
    backgroundColor: Theme.cardWhite,
    width: '210mm',
    minHeight: '297mm',
    padding: '28px 32px 32px',
    position: 'relative',
    boxSizing: 'border-box',
    color: ink,
    fontFamily: font,
    borderRadius: 12,
    border: `1px solid ${softRule}`,
    boxShadow: '0 8px 28px rgba(15, 23, 42, 0.06)',
  };
}

function amountStyle(extra?: React.CSSProperties): React.CSSProperties {
  return {
    fontVariantNumeric: 'tabular-nums',
    fontFeatureSettings: '"tnum"',
    whiteSpace: 'nowrap',
    textAlign: 'right',
    ...extra,
  };
}

function MetaPair({
  label,
  value,
  align = 'left',
}: {
  label: string;
  value: string | null | undefined;
  align?: 'left' | 'right';
}) {
  if (!value) return null;
  if (align === 'right') {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(72px, 1fr) 104px',
          columnGap: 12,
          alignItems: 'baseline',
          minHeight: 22,
          marginBottom: 2,
          fontSize: 12,
          lineHeight: 1.4,
        }}
      >
        <span style={{ color: muted, fontWeight: 500, textAlign: 'right' }}>{label}</span>
        <span
          style={{
            color: ink,
            fontWeight: 700,
            textAlign: 'right',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </span>
      </div>
    );
  }
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '92px minmax(0, 1fr)',
        columnGap: 10,
        alignItems: 'baseline',
        minHeight: 22,
        marginBottom: 2,
        fontSize: 12,
        lineHeight: 1.4,
      }}
    >
      <span style={{ color: muted, fontWeight: 500 }}>{label}</span>
      <span
        style={{
          color: ink,
          fontWeight: 700,
          minWidth: 0,
          overflowWrap: 'anywhere',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function TotalRow({
  label,
  value,
  emphasis = false,
  accentValue = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  accentValue?: boolean;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 108px',
        columnGap: 12,
        alignItems: 'baseline',
        minHeight: 24,
        marginBottom: 4,
        fontSize: emphasis ? 13 : 12,
      }}
    >
      <span
        style={{
          color: emphasis ? ink : muted,
          fontWeight: emphasis ? 800 : 500,
          textAlign: 'right',
        }}
      >
        {label}
      </span>
      <span
        style={{
          ...amountStyle({
            color: accentValue ? accentDeep : ink,
            fontWeight: emphasis ? 800 : 700,
          }),
        }}
      >
        {value}
      </span>
    </div>
  );
}

interface InvoicePdfWebProps {
  invoiceData: InvoicePdfData;
  initialShowSplit?: boolean;
  onBack?: () => void;
}

export default function InvoicePdfWeb({
  invoiceData,
  initialShowSplit = true,
  onBack,
}: InvoicePdfWebProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const [showSplit, setShowSplit] = useState(initialShowSplit);
  const tableRows = useMemo(
    () => buildInvoicePdfTableRows(invoiceData.items, { showSplit }),
    [invoiceData.items, showSplit],
  );
  const shipment = invoiceData.shipment;
  const title =
    invoiceData.documentKind === 'draft' ? 'DRAFT TAX INVOICE' : 'ORIGINAL TAX INVOICE';
  const headerLogo = useMemo(
    () =>
      resolveInvoiceHeaderLogo({
        brandingLogoUrl: invoiceData.brandingLogoUrl,
        companyName: invoiceData.brandingCompanyName,
        remoteFailed: logoFailed,
      }),
    [
      invoiceData.brandingCompanyName,
      invoiceData.brandingLogoUrl,
      logoFailed,
    ],
  );
  const showMsmeText =
    Boolean(invoiceData.issuerMsme) && !headerLogo?.includesMsmeCaption;

  const taxLines = invoiceData.taxRows.filter((row) => {
    if (row.label === 'GST' && /not applicable/i.test(row.value)) return false;
    return true;
  });

  const handleDownloadPdf = async () => {
    if (!printRef.current) return;
    setIsGenerating(true);

    try {
      const element = printRef.current;
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf/dist/jspdf.es.min.js'),
      ]);
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      const rawNo = (invoiceData.invoiceNo || 'DRAFT').trim() || 'DRAFT';
      const safeNo = rawNo.replace(/[^\w.\-]+/g, '_');
      pdf.save(`invoice_${safeNo}.pdf`);
    } catch (error) {
      console.error('Failed to generate PDF', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: Theme.analyticsCanvas,
        fontFamily: font,
      }}
    >
      <div
        style={{
          flexShrink: 0,
          position: 'sticky',
          top: 0,
          zIndex: 30,
          padding: '10px 20px',
          backgroundColor: Theme.screenBackground,
          borderBottom: `1px solid ${Theme.borderMedium}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <button
          type="button"
          onClick={onBack}
          disabled={!onBack}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'none',
            border: 'none',
            padding: '8px 4px',
            minHeight: 44,
            cursor: onBack ? 'pointer' : 'default',
            color: Theme.accentBrownDeep,
            fontSize: 14,
            fontWeight: 700,
            fontFamily: font,
            opacity: onBack ? 1 : 0.4,
          }}
        >
          ← Back to draft
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div
            role="group"
            aria-label="Invoice line split"
            style={{
              display: 'flex',
              padding: 3,
              backgroundColor: Theme.liquidPillBg,
              border: `1px solid ${Theme.liquidPillBorder}`,
              borderRadius: 999,
            }}
          >
            <button type="button" onClick={() => setShowSplit(true)} style={segmentStyle(showSplit)}>
              Show split
            </button>
            <button type="button" onClick={() => setShowSplit(false)} style={segmentStyle(!showSplit)}>
              No split
            </button>
          </div>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isGenerating}
            style={{
              backgroundColor: isGenerating ? Theme.borderMedium : Theme.buttonPrimary,
              color: Theme.buttonPrimaryText,
              padding: '8px 16px',
              border: `${Theme.buttonPrimaryBorderWidth}px solid ${Theme.buttonPrimaryBorder}`,
              borderRadius: Theme.buttonPrimaryRadius,
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              fontSize: 13,
              fontWeight: 600,
              minHeight: 44,
              fontFamily: font,
            }}
          >
            {isGenerating ? 'Generating…' : 'Download draft'}
          </button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '28px 20px 40px',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div ref={printRef} style={pageStyle()}>
          {/* Soft title watermark */}
          <div
            style={{
              position: 'absolute',
              top: 18,
              right: 28,
              fontSize: 42,
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: Theme.borderLight,
              pointerEvents: 'none',
              zIndex: 0,
              userSelect: 'none',
            }}
          >
            Invoice
          </div>

          {invoiceData.documentKind === 'draft' ? (
            <div
              style={{
                position: 'absolute',
                top: '48%',
                left: '50%',
                transform: 'translate(-50%, -50%) rotate(-28deg)',
                fontSize: 72,
                fontWeight: 700,
                letterSpacing: 10,
                color: 'rgba(148, 163, 184, 0.18)',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
                zIndex: 0,
              }}
            >
              DRAFT
            </div>
          ) : null}

          {/* Header: brand left · meta right */}
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'grid',
              gridTemplateColumns: '1fr 240px',
              columnGap: 32,
              alignItems: 'start',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 6,
                    flexShrink: 0,
                  }}
                >
                  {headerLogo?.kind === 'remote' || headerLogo?.kind === 'bundled' ? (
                    <img
                      src={headerLogo.src}
                      alt=""
                      style={{
                        height: headerLogo.kind === 'bundled' ? 56 : 44,
                        maxWidth: headerLogo.kind === 'bundled' ? 148 : 132,
                        width: 'auto',
                        objectFit: 'contain',
                        display: 'block',
                      }}
                      onError={() => {
                        if (headerLogo.kind === 'remote') setLogoFailed(true);
                      }}
                    />
                  ) : headerLogo?.kind === 'gogox_wordmark' ? (
                    <InvoiceGogoxWordmark width={132} />
                  ) : null}
                  {showMsmeText ? (
                    <div
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: muted,
                        letterSpacing: 0.1,
                      }}
                    >
                      MSME Reg No: {invoiceData.issuerMsme}
                    </div>
                  ) : null}
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 800,
                    letterSpacing: '-0.02em',
                    textTransform: 'uppercase',
                    lineHeight: 1.3,
                    color: ink,
                  }}
                >
                  {invoiceData.brandingCompanyName}
                </div>
                {invoiceData.issuerAddressLines.map((line, idx) => (
                  <div
                    key={`addr-${idx}`}
                    style={{
                      fontSize: 12,
                      lineHeight: 1.45,
                      marginTop: idx === 0 ? 4 : 1,
                      color: muted,
                    }}
                  >
                    {line}
                  </div>
                ))}
                {invoiceData.issuerGstNotApplicable ? (
                  <div style={{ fontSize: 12, marginTop: 4, color: muted }}>
                    GST not applicable
                  </div>
                ) : invoiceData.issuerGstin ? (
                  <div style={{ fontSize: 12, marginTop: 4, fontWeight: 600, color: ink }}>
                    GSTIN {invoiceData.issuerGstin}
                  </div>
                ) : invoiceData.issuerPan ? (
                  <div style={{ fontSize: 12, marginTop: 4, color: muted }}>
                    PAN {invoiceData.issuerPan}
                  </div>
                ) : null}
              </div>
            </div>

            <div style={{ width: '100%' }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  color: accentDeep,
                  marginBottom: 12,
                  textAlign: 'right',
                }}
              >
                {title}
              </div>
              <MetaPair
                align="right"
                label="Invoice"
                value={invoiceData.invoiceNo === 'DRAFT' ? 'DRAFT' : invoiceData.invoiceNo}
              />
              <MetaPair
                align="right"
                label="Date"
                value={formatTaxInvoiceDate(invoiceData.previewDate)}
              />
              {invoiceData.paymentTerms ? (
                <MetaPair align="right" label="Terms" value={invoiceData.paymentTerms} />
              ) : null}
              <MetaPair
                align="right"
                label="Due Date"
                value={formatTaxInvoiceDate(invoiceData.indicativeDueDate)}
              />
            </div>
          </div>

          <div
            style={{
              height: 1,
              backgroundColor: softRule,
              margin: '22px 0 18px',
              position: 'relative',
              zIndex: 1,
            }}
          />

          {/* Bill To + trip meta — shared top edge, equal columns */}
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              columnGap: 32,
              alignItems: 'start',
              marginBottom: 20,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: 0.4,
                  textTransform: 'uppercase',
                  color: muted,
                  marginBottom: 8,
                  minHeight: 16,
                }}
              >
                Bill To
              </div>
              {invoiceData.billingLines.length > 0 ? (
                invoiceData.billingLines.map((line, idx) => (
                  <div
                    key={`bill-${idx}`}
                    style={{
                      fontSize: idx === 0 ? 14 : 12,
                      fontWeight: idx === 0 ? 800 : 500,
                      lineHeight: 1.45,
                      color: idx === 0 ? ink : muted,
                      textTransform: idx === 0 ? 'uppercase' : undefined,
                      marginBottom: idx === 0 ? 2 : 0,
                    }}
                  >
                    {line}
                  </div>
                ))
              ) : (
                <div style={{ fontSize: 14, fontWeight: 800, color: ink }}>
                  {invoiceData.clientName}
                </div>
              )}
            </div>

            <div>
              {/* Spacer matches Bill To title row so trip fields share the same top edge */}
              <div style={{ minHeight: 24, marginBottom: 0 }} aria-hidden />
              {shipment.mode === 'single' ? (
                <>
                  <MetaPair label="Trip ID" value={shipment.trip_id} />
                  <MetaPair
                    label="Trip Date"
                    value={formatTaxInvoiceDate(shipment.trip_date)}
                  />
                  <MetaPair label="LR Number" value={shipment.lr_number} />
                  <MetaPair label="Pickup" value={shipment.pickup} />
                  <MetaPair label="Delivery" value={shipment.delivery} />
                  <MetaPair
                    label="Truck No"
                    value={shipment.truck_no || shipment.vehicle_notes}
                  />
                  <MetaPair label="Load Type" value={shipment.load_type} />
                </>
              ) : (
                <>
                  <MetaPair
                    label="Trips"
                    value={
                      shipment.mode === 'multi'
                        ? `${shipment.trip_count} trips billed as separate freight lines`
                        : '—'
                    }
                  />
                  {shipment.trips.slice(0, 3).map((trip) => (
                    <MetaPair
                      key={trip.trip_id}
                      label={trip.trip_id}
                      value={
                        [trip.lr_number, trip.truck_no].filter(Boolean).join(' · ') ||
                        trip.route
                      }
                    />
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Line items — fixed column widths */}
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              position: 'relative',
              zIndex: 1,
              tableLayout: 'fixed',
            }}
          >
            <colgroup>
              <col style={{ width: 40 }} />
              <col />
              <col style={{ width: 72 }} />
              <col style={{ width: 104 }} />
              <col style={{ width: 112 }} />
            </colgroup>
            <thead>
              <tr>
                {(
                  [
                    { label: '#', align: 'center' as const },
                    { label: 'Item & Description', align: 'left' as const },
                    { label: 'HSN/SAC', align: 'center' as const },
                    { label: 'Rate', align: 'right' as const },
                    { label: 'Amount', align: 'right' as const },
                  ] as const
                ).map((col) => (
                  <th
                    key={col.label}
                    style={{
                      backgroundColor: accent,
                      color: Theme.cardWhite,
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: 0.3,
                      textAlign: col.align,
                      padding: '10px 10px',
                      border: 'none',
                    }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((item, index) => {
                const isSplit = item.rowRole === 'split';
                const isRevised = item.rowRole === 'revised';
                const displayIndex =
                  item.rowRole === 'freight' || item.rowRole === 'other'
                    ? String(
                        tableRows
                          .slice(0, index + 1)
                          .filter((r) => r.rowRole === 'freight' || r.rowRole === 'other')
                          .length,
                      )
                    : '';
                const titleText = item.title || item.route;
                const rate = item.rate ?? item.amount;
                const rowBorder = `1px solid ${Theme.borderLight}`;
                return (
                  <tr key={item.key}>
                    <td
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        padding: '12px 10px',
                        borderBottom: rowBorder,
                        color: muted,
                        verticalAlign: 'top',
                        textAlign: 'center',
                      }}
                    >
                      {displayIndex}
                    </td>
                    <td
                      style={{
                        fontSize: 12,
                        padding: '12px 10px',
                        borderBottom: rowBorder,
                        verticalAlign: 'top',
                      }}
                    >
                      <div
                        style={{
                          fontWeight: isSplit || isRevised ? 500 : 700,
                          textTransform: isSplit ? 'none' : 'uppercase',
                          color: ink,
                          lineHeight: 1.35,
                        }}
                      >
                        {titleText}
                      </div>
                      {item.subtitle && !isSplit ? (
                        <div style={{ marginTop: 3, color: muted, fontSize: 11, lineHeight: 1.35 }}>
                          {item.subtitle}
                        </div>
                      ) : null}
                    </td>
                    <td
                      style={{
                        fontSize: 12,
                        padding: '12px 8px',
                        borderBottom: rowBorder,
                        color: muted,
                        verticalAlign: 'top',
                        textAlign: 'center',
                      }}
                    >
                      {!isSplit && !isRevised ? item.hsnSac || '—' : ''}
                    </td>
                    <td
                      style={{
                        ...amountStyle({ fontSize: 12, color: ink }),
                        padding: '12px 10px',
                        borderBottom: rowBorder,
                        verticalAlign: 'top',
                      }}
                    >
                      {!isSplit && !isRevised ? formatPlainAmount(rate) : ''}
                    </td>
                    <td
                      style={{
                        ...amountStyle({
                          fontSize: 12,
                          fontWeight: 700,
                          color:
                            item.splitKind === 'cn'
                              ? Theme.negative
                              : item.splitKind === 'dn'
                                ? Theme.positive
                                : ink,
                        }),
                        padding: '12px 10px',
                        borderBottom: rowBorder,
                        verticalAlign: 'top',
                      }}
                    >
                      {formatPlainAmount(item.amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Notes + totals — aligned columns */}
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'grid',
              gridTemplateColumns: '1fr 240px',
              columnGap: 36,
              marginTop: 20,
              alignItems: 'start',
            }}
          >
            <div>
              {invoiceData.amountInWords ? (
                <div style={{ marginBottom: 14 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: 0.3,
                      textTransform: 'uppercase',
                      color: muted,
                      marginBottom: 4,
                    }}
                  >
                    Total In Words
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      fontStyle: 'italic',
                      fontWeight: 600,
                      color: ink,
                      lineHeight: 1.45,
                    }}
                  >
                    {invoiceData.amountInWords}
                  </div>
                </div>
              ) : null}

              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: 0.3,
                  textTransform: 'uppercase',
                  color: muted,
                  marginBottom: 4,
                }}
              >
                Note
              </div>
              {invoiceData.notes ? (
                <div
                  style={{
                    fontSize: 12,
                    lineHeight: 1.55,
                    color: muted,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {invoiceData.notes}
                </div>
              ) : invoiceData.taxWarning ? (
                <div style={{ fontSize: 12, color: Theme.warning }}>{invoiceData.taxWarning}</div>
              ) : (
                <div style={{ fontSize: 12, color: muted }}>
                  {invoiceData.invoiceNumberCaption}
                </div>
              )}

              {invoiceData.bankDetailsLines.length > 0 ? (
                <div style={{ marginTop: 14 }}>
                  {invoiceData.bankDetailsLines.map((line) => (
                    <div
                      key={line}
                      style={{ fontSize: 12, lineHeight: 1.5, fontWeight: 600, color: ink }}
                    >
                      {line}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div style={{ width: '100%' }}>
              {taxLines.map((row) => (
                <TotalRow
                  key={row.label}
                  label={row.label === 'Taxable amount' ? 'Sub total' : row.label}
                  value={row.value.replace(/^₹\s?/, '')}
                />
              ))}
              <div
                style={{
                  height: 1,
                  backgroundColor: softRule,
                  margin: '8px 0 10px',
                }}
              />
              <TotalRow
                label="Total"
                value={formatPlainAmount(invoiceData.grandTotal)}
                emphasis
              />
              <TotalRow
                label="Balance Due"
                value={formatPlainAmount(invoiceData.grandTotal)}
                emphasis
                accentValue
              />

              <div
                style={{
                  marginTop: 28,
                  minHeight: 64,
                  borderBottom: `1px solid ${softRule}`,
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  paddingBottom: 6,
                }}
              >
                <span style={{ fontSize: 11, color: muted, fontWeight: 600 }}>
                  Authorized Signature
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function segmentStyle(active: boolean): React.CSSProperties {
  return {
    backgroundColor: active ? Theme.screenBackground : 'transparent',
    color: active ? Theme.textPrimaryDark : Theme.textRouteCard,
    padding: '8px 14px',
    border: 'none',
    borderRadius: 999,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    minHeight: 36,
    boxShadow: active ? '0 1px 2px rgba(15, 23, 42, 0.08)' : 'none',
    fontFamily: font,
  };
}
