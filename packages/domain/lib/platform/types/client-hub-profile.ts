/** Extended client hub / KYC profile fields on `public.clients`. */
export type UpdateClientHubProfileInput = {
  legalName?: string | null;
  tradeName?: string | null;
  gstin?: string | null;
  panNumber?: string | null;
  cin?: string | null;
  msmeNumber?: string | null;
  industry?: string | null;
  tanNumber?: string | null;
  kamName?: string | null;
  kamEmail?: string | null;
  kamPhone?: string | null;
  billingContactName?: string | null;
  billingContactEmail?: string | null;
  billingContactPhone?: string | null;
  potentialVolume?: number | null;
  projectedContractRevenue?: number | null;
  paymentTermsLabel?: string | null;
  invoiceFrequencyLabel?: string | null;
  clientCode?: string | null;
  iecNumber?: string | null;
  operatingRegions?: string[] | null;
  registeredAddress?: string | null;
  billingAddress?: string | null;
  corporateAddress?: string | null;
  remarks?: string | null;
};
