/**
 * LR parsing — aligned with cashflow-catalyst src/lib/utils (expandLR, cleanInput).
 */

export function cleanInput(str: string) {
  if (!str) return '';
  return str.replace(/\/.*$/g, '').trim();
}

export function isValidLR(str: string) {
  return /[A-Z]?\d+(-\d+)?/.test(str);
}

/** Expands comma-separated and dash-range LR notation into individual LR strings. */
export function expandLR(input: string): string[] {
  if (!input || input === '-') return [];

  const cleaned = cleanInput(input);
  const parts = cleaned.split(',');
  const result: string[] = [];

  parts.forEach((part) => {
    const dashParts = part.trim().split('-');

    if (dashParts.length === 1) {
      result.push(part.trim());
    } else {
      const prefixMatch = dashParts[0].match(/[A-Z]+/);
      const prefix = prefixMatch ? prefixMatch[0] : '';
      const startNumMatch = dashParts[0].match(/\d+/);
      const startNumStr = startNumMatch ? startNumMatch[0] : '';

      if (startNumStr) {
        const start = parseInt(startNumStr, 10);

        dashParts.slice(1).forEach((endStr) => {
          let end = parseInt(endStr, 10);

          if (!isNaN(start) && !isNaN(end) && end < start && endStr.length < startNumStr.length) {
            const patchedEndStr = startNumStr.substring(0, startNumStr.length - endStr.length) + endStr;
            end = parseInt(patchedEndStr, 10);
          }

          if (!isNaN(start) && !isNaN(end) && end > start) {
            for (let i = start + 1; i <= end; i++) {
              result.push(prefix + i.toString().padStart(startNumStr.length, '0'));
            }
          } else if (!isNaN(end)) {
            result.push(prefix + end.toString().padStart(startNumStr.length, '0'));
          }
        });
      }

      result.push(dashParts[0].trim());
    }
  });

  return Array.from(new Set(result));
}
