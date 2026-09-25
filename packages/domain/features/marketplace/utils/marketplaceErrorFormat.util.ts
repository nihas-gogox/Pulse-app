/**
 * A9.2 — single shared translation for Marketplace bid-transaction RPC
 * errors. submit_market_bid / accept_market_bid (Market) and
 * submit_driver_direct_bid / accept_driver_direct_bid (Reach) deliberately
 * share the same `code: message` exception convention (established in
 * A6.3), so one formatter correctly covers both mechanisms' submission and
 * award/reject paths -- do not duplicate this mapping per screen.
 *
 * Never displays a raw error code/prefix or Postgres text to a user.
 * Always returns display text only -- callers that need the original
 * message for logging/debugging already have it (this function doesn't
 * consume or discard it).
 */
export function formatMarketplaceTransactionError(message: string | null | undefined): string {
  const m = (message ?? '').toLowerCase();

  if (m.includes('driver_unavailable')) {
    // A6.4 wording -- preserved exactly, do not regress.
    return "You're currently on an active trip. Complete it before bidding on another load.";
  }
  if (m.includes('not_biddable')) {
    return 'This load is no longer open for bidding.';
  }
  if (m.includes('already_awarded')) {
    return 'This load has already been awarded to another bid.';
  }
  if (m.includes('bid_locked')) {
    return 'This bid has already been decided and can no longer be changed.';
  }
  if (m.includes('invalid_amount')) {
    return 'Enter a valid bid amount greater than zero.';
  }
  if (m.includes('vehicle_no_longer_eligible')) {
    return 'The selected vehicle is no longer eligible for this bid. Choose another vehicle and try again.';
  }
  if (m.includes('cannot bid on your own')) {
    return "You can't bid on your own organization's load.";
  }
  if (m.includes('invalid_state')) {
    return 'This bid has already been decided.';
  }
  if (m.includes('unauthorized')) {
    return "You don't have permission to do this.";
  }
  if (m.includes('not_found')) {
    return 'This bid or load could not be found. It may have been removed.';
  }

  // Unknown error: safe generic fallback, never the raw database text.
  return 'Something went wrong. Please try again.';
}
