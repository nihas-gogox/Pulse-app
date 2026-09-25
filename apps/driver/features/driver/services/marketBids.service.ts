/**
 * Phase A/B — DCO bids directly on a Market-shared Indent (market_bids table).
 * Distinct from driver_direct_bids (boosted Reach/Post stories) and from the
 * org-to-org bids/direct_quotes tables — unrelated to this workstream.
 * @see supabase/migrations/20270301040000_market_bids.sql
 * @see supabase/migrations/20270301060000_accept_reject_market_bid.sql
 */
import { supabase } from '@pulse/core/lib/supabase';
import { formatMarketplaceTransactionError } from '@pulse/domain/features/marketplace/utils/marketplaceErrorFormat.util';

export type MarketBidStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'superseded';

/** A8.6.2 — independent of MarketBidStatus; see network/services/marketBids.service.ts for full doc. */
export type FeePaymentStatus = 'not_required' | 'required' | 'pending' | 'paid' | 'failed' | 'expired';

export type MarketBidRow = {
  id: string;
  indent_id: string;
  bidder_type: 'dco' | 'organization';
  bidder_user_id: string;
  bidder_organization_id: string | null;
  owner_vehicle_id: string | null;
  amount: number;
  note: string | null;
  status: MarketBidStatus;
  fee_payment_status: FeePaymentStatus;
  platform_fee_amount: number | null;
  created_at: string;
  updated_at: string;
  accepted_at: string | null;
};

const MARKET_BID_COLUMNS =
  'id,indent_id,bidder_type,bidder_user_id,bidder_organization_id,owner_vehicle_id,amount,note,status,fee_payment_status,platform_fee_amount,created_at,updated_at,accepted_at';

/** DCO bid — p_bidder_organization_id stays NULL; the Business-bidder path is not yet implemented backend-side. */
export async function submitMarketBid(input: {
  indentId: string;
  amount: number;
  note?: string | null;
  ownerVehicleId?: string | null;
}): Promise<{ error: Error | null; bidId: string | null }> {
  const { data, error } = await supabase().rpc('submit_market_bid', {
    p_indent_id: input.indentId,
    p_amount: input.amount,
    p_note: (input.note ?? '').trim() || null,
    p_bidder_organization_id: null,
    p_owner_vehicle_id: input.ownerVehicleId || null,
  });
  if (error) return { error: new Error(error.message), bidId: null };
  const bidId = (data as { bid_id?: string } | null)?.bid_id ?? null;
  return { error: null, bidId };
}

/** This bidder's own bid on one indent, if any — RLS permits reading own rows. */
export async function getMyMarketBidForIndent(
  uid: string,
  indentId: string,
): Promise<{ error: Error | null; bid: MarketBidRow | null }> {
  if (!uid || !indentId) return { error: null, bid: null };
  const { data, error } = await supabase()
    .from('market_bids')
    .select(MARKET_BID_COLUMNS)
    .eq('indent_id', indentId)
    .eq('bidder_user_id', uid)
    .maybeSingle();
  if (error) return { error: new Error(error.message), bid: null };
  return { error: null, bid: (data as MarketBidRow | null) ?? null };
}

/** All of this bidder's own market_bids rows, newest first. */
export async function listMyMarketBids(
  uid: string,
): Promise<{ error: Error | null; bids: MarketBidRow[] }> {
  if (!uid) return { error: null, bids: [] };
  const { data, error } = await supabase()
    .from('market_bids')
    .select(MARKET_BID_COLUMNS)
    .eq('bidder_user_id', uid)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return { error: new Error(error.message), bids: [] };
  return { error: null, bids: (data ?? []) as MarketBidRow[] };
}

export function formatMarketBidAmount(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(Number(amount))) return '';
  return `₹${Number(amount).toLocaleString('en-IN')}`;
}

export function marketBidStatusLabel(status: MarketBidStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'accepted':
      return 'Awarded';
    case 'rejected':
      return 'Not selected';
    case 'withdrawn':
      return 'Withdrawn';
    case 'superseded':
      return 'Superseded';
    default:
      return status;
  }
}

/**
 * A9.2: delegates to the shared Marketplace error formatter (do not
 * duplicate the mapping here) -- kept as a thin, named wrapper since
 * AvailableLoadDetailScreen.tsx already imports it from this module.
 */
export function formatMarketBidSubmitError(message: string): string {
  return formatMarketplaceTransactionError(message);
}
