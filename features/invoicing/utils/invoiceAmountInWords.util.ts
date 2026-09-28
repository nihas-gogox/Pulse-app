/**
 * Indian-rupee amount-in-words for tax invoice footers.
 * Read-only presentation helper — does not touch the ledger.
 */

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const TENS = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
];

function twoDigitWords(n: number): string {
  if (n < 20) return ONES[n] ?? '';
  const ten = Math.floor(n / 10);
  const one = n % 10;
  return `${TENS[ten] ?? ''}${one ? `-${ONES[one]}` : ''}`.trim();
}

function threeDigitWords(n: number): string {
  if (n < 100) return twoDigitWords(n);
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  const head = `${ONES[hundred]} Hundred`;
  return rest ? `${head} ${twoDigitWords(rest)}` : head;
}

function integerToIndianWords(value: number): string {
  if (value === 0) return 'Zero';
  const crore = Math.floor(value / 1_00_00_000);
  const lakh = Math.floor((value % 1_00_00_000) / 1_00_000);
  const thousand = Math.floor((value % 1_00_000) / 1_000);
  const hundred = value % 1_000;
  const parts: string[] = [];
  if (crore) parts.push(`${threeDigitWords(crore)} Crore`);
  if (lakh) parts.push(`${threeDigitWords(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigitWords(thousand)} Thousand`);
  if (hundred) parts.push(threeDigitWords(hundred));
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/** e.g. 71600 → "Indian Rupee Seventy-One Thousand Six Hundred Only" */
export function formatInvoiceAmountInWords(amount: number): string {
  if (!Number.isFinite(amount)) return '';
  const rounded = Math.round(Math.abs(amount) * 100) / 100;
  const rupees = Math.floor(rounded);
  const paise = Math.round((rounded - rupees) * 100);
  const rupeeWords = integerToIndianWords(rupees);
  const paisePart =
    paise > 0 ? ` and ${twoDigitWords(paise)} Paise` : '';
  const prefix = amount < 0 ? 'Minus ' : '';
  return `${prefix}Indian Rupee ${rupeeWords}${paisePart} Only`;
}
