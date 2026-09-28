/**
 * Clean GOGOX wordmark for tax-invoice header (web PDF preview).
 * Mirrors the official blue/yellow mark without screenshot chrome.
 */
const GOGO_BLUE = "#2F6BDB";
const X_YELLOW = "#F5C518";

export function InvoiceGogoxWordmark({
  width = 138,
}: {
  width?: number;
}) {
  const height = Math.round(width * 0.34);
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 220 74"
      role="img"
      aria-label="GOGOX"
      style={{ display: "block" }}
    >
      <text
        x="4"
        y="48"
        fill={GOGO_BLUE}
        fontFamily="Inter, Arial Black, Helvetica, Arial, sans-serif"
        fontSize="42"
        fontWeight="800"
        letterSpacing="-1.5"
      >
        GOGO
      </text>
      <g transform="translate(132 10)">
        <line
          x1="6"
          y1="6"
          x2="46"
          y2="46"
          stroke={X_YELLOW}
          strokeWidth="11"
          strokeLinecap="round"
        />
        <line
          x1="46"
          y1="6"
          x2="6"
          y2="46"
          stroke={X_YELLOW}
          strokeWidth="11"
          strokeLinecap="round"
        />
        <circle cx="46" cy="5" r="5.5" fill={X_YELLOW} />
      </g>
    </svg>
  );
}
