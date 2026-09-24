/**
 * Core accounting model: maps stored ledger rows to double-entry (debit/credit) interpretation.
 * See docs/CORE_ACCOUNTING_MODEL.md. Every transaction hits ≥2 accounts; balance is always computed from history.
 */

/** Core account types (double-entry). */
export const CORE_ACCOUNTS = {
  AR: 'Accounts Receivable (Customer)',
  AP: 'Accounts Payable (Supplier)',
  DRIVER_PAYABLE: 'Driver Payable',
  /** DCO-6: independent owner-operator settlement — deliberately separate
   * from AP (not a supplier) and DRIVER_PAYABLE (not an employee). */
  DCO_PAYABLE: 'DCO Payable',
  VEHICLE_EXPENSE: 'Vehicle Expense',
  REVENUE: 'Revenue',
  CASH_BANK: 'Cash / Bank',
  COMMISSION_EXPENSE: 'Commission Expense',
  COST_OF_SERVICE: 'Cost of Service',
} as const;

export type CoreAccountKey = keyof typeof CORE_ACCOUNTS;

/** Vehicle expense sub-types (party_name/description). */
export const VEHICLE_EXPENSE_TYPES = ['FUEL', 'MAINTENANCE', 'TOLL', 'REPAIR', 'INSURANCE', 'PERMIT', 'EMI', 'OTHER'] as const;

/** Minimal ledger row shape for interpretation (avoids circular dep on full LedgerRow). */
export interface LedgerRowLike {
  amount_in: number;
  amount_out: number;
  contact_type?: 'client' | 'supplier' | 'driver' | 'dco' | null;
  party_name?: string | null;
  description?: string | null;
}

export interface DoubleEntryInterpretation {
  /** Debit account (left side). */
  debitAccount: CoreAccountKey;
  /** Credit account (right side). */
  creditAccount: CoreAccountKey;
  /** Human-readable transaction type for audit/analytics. */
  transactionType: string;
  /** Amount (positive) that moved. */
  amount: number;
}

/**
 * Interpret a stored transaction row as the corresponding double-entry pair.
 * Used for consistency with docs/CORE_ACCOUNTING_MODEL.md and future audit/analytics.
 */
export function getDoubleEntryFromLedgerRow(row: LedgerRowLike): DoubleEntryInterpretation | null {
  const amtIn = Number(row.amount_in ?? 0);
  const amtOut = Number(row.amount_out ?? 0);
  const contactType = row.contact_type ?? null;
  const desc = (row.description ?? '').trim().toUpperCase();
  const partyName = (row.party_name ?? '').trim();

  // Cash IN (customer payment): Dr Cash/Bank · Cr AR
  if (amtIn > 0 && contactType === 'client') {
    return {
      debitAccount: 'CASH_BANK',
      creditAccount: 'AR',
      transactionType: 'customer_payment',
      amount: amtIn,
    };
  }

  // Cash OUT
  if (amtOut > 0) {
    if (contactType === 'supplier') {
      return {
        debitAccount: 'AP',
        creditAccount: 'CASH_BANK',
        transactionType: 'supplier_payment',
        amount: amtOut,
      };
    }
    if (contactType === 'driver') {
      return {
        debitAccount: 'DRIVER_PAYABLE',
        creditAccount: 'CASH_BANK',
        transactionType: 'driver_payment',
        amount: amtOut,
      };
    }
    if (contactType === 'dco') {
      return {
        debitAccount: 'DCO_PAYABLE',
        creditAccount: 'CASH_BANK',
        transactionType: 'dco_payment',
        amount: amtOut,
      };
    }
    // Vehicle expense (no contact; party_name/description = Fuel, Maintenance, Toll, etc.)
    if (!contactType && (VEHICLE_EXPENSE_TYPES.some((t) => desc === t || partyName.toUpperCase().includes(t)) || /FUEL|TOLL|MAINTENANCE|REPAIR|OTHER/i.test(partyName))) {
      return {
        debitAccount: 'VEHICLE_EXPENSE',
        creditAccount: 'CASH_BANK',
        transactionType: 'vehicle_expense',
        amount: amtOut,
      };
    }
    // Other cash out (misc)
    return {
      debitAccount: 'CASH_BANK',
      creditAccount: 'CASH_BANK',
      transactionType: 'other_out',
      amount: amtOut,
    };
  }

  return null;
}

/** Short labels for account keys (for "Dr X · Cr Y" display). */
const ACCOUNT_SHORT: Record<CoreAccountKey, string> = {
  AR: 'AR',
  AP: 'AP',
  DRIVER_PAYABLE: 'Driver Pay.',
  DCO_PAYABLE: 'DCO Pay.',
  VEHICLE_EXPENSE: 'Vehicle Exp.',
  REVENUE: 'Revenue',
  CASH_BANK: 'Cash',
  COMMISSION_EXPENSE: 'Commission',
  COST_OF_SERVICE: 'Cost of Svc',
};

/** Human-readable transaction type for list/expand. */
const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  customer_payment: 'Customer payment',
  supplier_payment: 'Supplier payment',
  driver_payment: 'Driver payment',
  dco_payment: 'DCO payment',
  vehicle_expense: 'Vehicle expense',
  other_out: 'Other (cash out)',
};

/**
 * Return a display label for a ledger row (double-entry type or "Dr X · Cr Y").
 */
export function getDoubleEntryDisplayLabel(row: LedgerRowLike): string | null {
  const i = getDoubleEntryFromLedgerRow(row);
  if (!i) return null;
  const friendly = TRANSACTION_TYPE_LABELS[i.transactionType];
  if (friendly) return friendly;
  return `Dr ${ACCOUNT_SHORT[i.debitAccount]} · Cr ${ACCOUNT_SHORT[i.creditAccount]}`;
}

/**
 * When creating a ledger entry from the UI, which logical double-entry does this represent?
 * Call this before persisting to ensure description/contact_type align with the model.
 */
export function getDoubleEntryForNewEntry(params: {
  type: 'in' | 'out';
  amount: number;
  contactType?: 'client' | 'supplier' | 'driver' | null;
  category?: string | null;
  partyName?: string | null;
}): DoubleEntryInterpretation | null {
  const { type, amount, contactType, category } = params;
  if (amount <= 0) return null;

  if (type === 'in') {
    if (contactType === 'client') {
      return { debitAccount: 'CASH_BANK', creditAccount: 'AR', transactionType: 'customer_payment', amount };
    }
    return null;
  }

  // type === 'out'
  if (contactType === 'supplier') {
    return { debitAccount: 'AP', creditAccount: 'CASH_BANK', transactionType: 'supplier_payment', amount };
  }
  if (contactType === 'driver') {
    return { debitAccount: 'DRIVER_PAYABLE', creditAccount: 'CASH_BANK', transactionType: 'driver_payment', amount };
  }
  if (!contactType && category && VEHICLE_EXPENSE_TYPES.includes(category as (typeof VEHICLE_EXPENSE_TYPES)[number])) {
    return { debitAccount: 'VEHICLE_EXPENSE', creditAccount: 'CASH_BANK', transactionType: 'vehicle_expense', amount };
  }
  if (!contactType && params.partyName && /FUEL|MAINTENANCE|TOLL|REPAIR|OTHER/i.test(params.partyName)) {
    return { debitAccount: 'VEHICLE_EXPENSE', creditAccount: 'CASH_BANK', transactionType: 'vehicle_expense', amount };
  }
  return null;
}
