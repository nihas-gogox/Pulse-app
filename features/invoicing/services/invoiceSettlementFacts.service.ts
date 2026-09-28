/**
 * Read-only settlement facts for invoice PDF footers (bank transfer block).
 * Does not write to finance ledger or entity_bank_accounts.
 */

import { supabase } from '@/lib/supabase';

export type InvoiceBankAccountFact = {
  bank_name: string | null;
  account_number: string | null;
  ifsc_code: string | null;
  account_type: string | null;
  is_primary: boolean;
};

export type InvoiceSettlementFacts = {
  bankAccounts: InvoiceBankAccountFact[];
  /** Presentational lines for PDF — empty when no verified/org bank rows exist. */
  bankDetailsLines: string[];
  /** Udyam / MSME from organizations — null when unset. Read-only. */
  msmeNumber: string | null;
};

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').replace(/\s+/g, ' ').trim();
  return trimmed ? trimmed : null;
}

function formatBankLines(
  account: InvoiceBankAccountFact,
  accountName: string | null,
): string[] {
  const lines: string[] = [];
  const bank = trimOrNull(account.bank_name);
  const holder = trimOrNull(accountName);
  const number = trimOrNull(account.account_number);
  const ifsc = trimOrNull(account.ifsc_code);
  if (bank) lines.push(`BANK NAME: ${bank}`);
  if (holder) lines.push(`ACCOUNT NAME: ${holder}`);
  if (number) lines.push(`ACCOUNT NUMBER: ${number}`);
  if (ifsc) lines.push(`IFSC CODE: ${ifsc}`);
  return lines;
}

/**
 * Fetch primary (or first) organization bank account for the workspace.
 * Filters deleted rows. Never invents bank identity.
 */
export async function fetchInvoiceSettlementFacts(args: {
  organizationId: string;
  accountName?: string | null;
}): Promise<{ error: Error | null; facts: InvoiceSettlementFacts }> {
  const orgId = String(args.organizationId ?? '').trim();
  if (!orgId) {
    return {
      error: null,
      facts: { bankAccounts: [], bankDetailsLines: [], msmeNumber: null },
    };
  }

  try {
    const [{ data, error }, orgRes] = await Promise.all([
      supabase()
        .from('entity_bank_accounts')
        .select(
          'bank_name, account_number, ifsc_code, account_type, is_primary, deleted_at',
        )
        .eq('organization_id', orgId)
        .eq('entity_type', 'organization')
        .eq('entity_id', orgId)
        .is('deleted_at', null)
        .order('is_primary', { ascending: false })
        .limit(5),
      supabase()
        .from('organizations')
        .select('msme_number')
        .eq('id', orgId)
        .maybeSingle(),
    ]);

    const msmeNumber = trimOrNull(
      (orgRes.data as { msme_number?: string | null } | null)?.msme_number,
    );

    if (error) {
      return {
        error: new Error(error.message),
        facts: { bankAccounts: [], bankDetailsLines: [], msmeNumber },
      };
    }

    const bankAccounts: InvoiceBankAccountFact[] = (data ?? []).map((row) => ({
      bank_name: (row as { bank_name?: string | null }).bank_name ?? null,
      account_number:
        (row as { account_number?: string | null }).account_number ?? null,
      ifsc_code: (row as { ifsc_code?: string | null }).ifsc_code ?? null,
      account_type: (row as { account_type?: string | null }).account_type ?? null,
      is_primary: Boolean((row as { is_primary?: boolean }).is_primary),
    }));

    const primary =
      bankAccounts.find((a) => a.is_primary) ?? bankAccounts[0] ?? null;
    const bankDetailsLines = primary
      ? formatBankLines(primary, args.accountName ?? null)
      : [];

    return { error: null, facts: { bankAccounts, bankDetailsLines, msmeNumber } };
  } catch (e) {
    return {
      error: e instanceof Error ? e : new Error(String(e)),
      facts: { bankAccounts: [], bankDetailsLines: [], msmeNumber: null },
    };
  }
}
