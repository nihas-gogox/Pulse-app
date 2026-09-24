import type { UpdateClientHubProfileInput } from '../../../../../lib/platform/types/client-hub-profile';

function trimOrNull(v: string | undefined | null): string | null {
  const t = (v ?? '').trim();
  return t || null;
}

export function buildClientHubProfilePatch(input: UpdateClientHubProfileInput): Record<string, unknown> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (input.legalName !== undefined) patch.legal_name = trimOrNull(input.legalName);
  if (input.tradeName !== undefined) patch.trade_name = trimOrNull(input.tradeName);
  if (input.gstin !== undefined) patch.gstin = trimOrNull(input.gstin);
  if (input.panNumber !== undefined) patch.pan_number = trimOrNull(input.panNumber);
  if (input.cin !== undefined) patch.cin = trimOrNull(input.cin);
  if (input.msmeNumber !== undefined) patch.msme_number = trimOrNull(input.msmeNumber);
  if (input.industry !== undefined) patch.industry = trimOrNull(input.industry);
  if (input.tanNumber !== undefined) patch.tan_number = trimOrNull(input.tanNumber);
  if (input.kamName !== undefined) patch.kam_name = trimOrNull(input.kamName);
  if (input.kamEmail !== undefined) patch.kam_email = trimOrNull(input.kamEmail);
  if (input.kamPhone !== undefined) patch.kam_phone = trimOrNull(input.kamPhone);
  if (input.billingContactName !== undefined) {
    patch.billing_contact_name = trimOrNull(input.billingContactName);
  }
  if (input.billingContactEmail !== undefined) {
    patch.billing_contact_email = trimOrNull(input.billingContactEmail);
  }
  if (input.billingContactPhone !== undefined) {
    patch.billing_contact_phone = trimOrNull(input.billingContactPhone);
  }
  if (input.potentialVolume !== undefined) patch.potential_volume = input.potentialVolume;
  if (input.projectedContractRevenue !== undefined) {
    patch.projected_contract_revenue = input.projectedContractRevenue;
  }
  if (input.paymentTermsLabel !== undefined) {
    patch.payment_terms_label = trimOrNull(input.paymentTermsLabel);
  }
  if (input.invoiceFrequencyLabel !== undefined) {
    patch.invoice_frequency_label = trimOrNull(input.invoiceFrequencyLabel);
  }
  if (input.clientCode !== undefined) patch.client_code = trimOrNull(input.clientCode);
  if (input.iecNumber !== undefined) patch.iec_number = trimOrNull(input.iecNumber);
  if (input.operatingRegions !== undefined) patch.operating_regions = input.operatingRegions;
  if (input.registeredAddress !== undefined) {
    patch.registered_address = trimOrNull(input.registeredAddress);
  }
  if (input.billingAddress !== undefined) patch.billing_address = trimOrNull(input.billingAddress);
  if (input.corporateAddress !== undefined) patch.corporate_address = trimOrNull(input.corporateAddress);
  if (input.remarks !== undefined) patch.notes = trimOrNull(input.remarks);

  return patch;
}
