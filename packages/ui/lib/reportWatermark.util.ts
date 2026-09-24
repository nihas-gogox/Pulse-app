/**
 * Shared print/PDF watermark for downloadable reports.
 * Overlay sits above table cells (z-index) so it remains visible on white rows.
 * Uses rgba color instead of opacity — print engines often drop CSS opacity.
 */

export const PULSE_WATERMARK_PRINT_CSS = `
  .pulse-watermark-layer {
    position: fixed;
    inset: 0;
    z-index: 9999;
    pointer-events: none;
    overflow: hidden;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
    color-adjust: exact;
  }
  .pulse-watermark {
    position: absolute;
    top: 48%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-22deg);
    font-size: 108px;
    font-weight: 700;
    font-style: italic;
    letter-spacing: -0.04em;
    line-height: 1;
    color: rgba(77, 54, 54, 0.22);
    white-space: nowrap;
    user-select: none;
  }
  .pulse-watermark-dot {
    color: rgba(255, 206, 68, 0.62);
  }
  .pulse-report-body {
    position: relative;
    z-index: 1;
  }
  @media print {
    .pulse-watermark-layer {
      position: fixed;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
  }
`;

export function pulseWatermarkHtmlFragment(): string {
  return `<div class="pulse-watermark-layer" aria-hidden="true"><div class="pulse-watermark">pulse<span class="pulse-watermark-dot">.</span></div></div>`;
}

export type WrapPrintableReportHtmlOptions = {
  title: string;
  extraStyles?: string;
  bodyHtml: string;
  lang?: string;
};

/** Wrap report fragment in a full HTML document with centered PULSE watermark on each page. */
export function wrapPrintableReportHtml(options: WrapPrintableReportHtmlOptions): string {
  const { title, extraStyles = "", bodyHtml, lang = "en" } = options;
  const safeTitle = title.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <style>
    ${PULSE_WATERMARK_PRINT_CSS}
    ${extraStyles}
  </style>
</head>
<body>
  <div class="pulse-report-body">
    ${bodyHtml}
  </div>
  ${pulseWatermarkHtmlFragment()}
</body>
</html>`;
}

/** Prepends a branded banner row for Excel exports (xlsx has no per-page watermark). */
/** Injects print CSS + fixed center watermark into an existing HTML document string. */
export function injectPulseWatermarkIntoHtml(html: string): string {
  if (html.includes("pulse-watermark")) return html;
  let result = html;
  if (result.includes("</head>")) {
    result = result.replace("</head>", `<style>${PULSE_WATERMARK_PRINT_CSS}</style></head>`);
  }
  if (/<\/body>/i.test(result)) {
    result = result.replace(/<\/body>/i, `${pulseWatermarkHtmlFragment()}</body>`);
  } else {
    result = result.replace(/<body([^>]*)>/i, `<body$1>${pulseWatermarkHtmlFragment()}`);
  }
  return result;
}

export function prependPulseExcelBanner(
  rows: (string | number)[][],
  subtitle?: string,
): (string | number)[][] {
  const banner: (string | number)[][] = [["PULSE — Business Intelligence Report"]];
  if (subtitle?.trim()) banner.push([subtitle.trim()]);
  banner.push([]);
  return [...banner, ...rows];
}
