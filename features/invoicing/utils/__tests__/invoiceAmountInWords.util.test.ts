import { formatInvoiceAmountInWords } from '../invoiceAmountInWords.util';

describe('formatInvoiceAmountInWords', () => {
  it('formats whole rupees in Indian style', () => {
    expect(formatInvoiceAmountInWords(71600)).toBe(
      'Indian Rupee Seventy-One Thousand Six Hundred Only',
    );
  });

  it('includes paise when present', () => {
    expect(formatInvoiceAmountInWords(100.5)).toBe(
      'Indian Rupee One Hundred and Fifty Paise Only',
    );
  });
});
