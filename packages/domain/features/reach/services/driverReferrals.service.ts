/**
 * Boost V2 driver referral pipeline (reach_referrals). An employed driver
 * (active fleet membership) never bids directly with the shipper: they
 * recommend a boosted load to their fleet owner; the reward releases only
 * when the recommendation converts (approve → bid → trip awarded → trip
 * starts). An independent driver (no fleet membership, so no organization to
 * bid through) instead submits a direct bid as themselves — see
 * driver_direct_bids / submitDriverDirectBid below; that path has no
 * recommendation reward since they're already the bidder, and award/
 * acceptance is a separate, not-yet-built surface (submission + status only
 * today). All writes go through SECURITY DEFINER RPCs; reads are RLS-scoped
 * (driver, fleet org, campaign org).
 */
import { supabase } from '@pulse/core/lib/supabase';

export type ReachDriverReferralStatus =
  | 'recommended'
  | 'approved'
  | 'rejected'
  | 'bid_submitted'
  | 'rewarded'
  | 'expired';

/** Status of an independent driver's direct bid on a boosted story
 * (driver_direct_bids). UI maps pending → Quoted, pending+counter_amount →
 * Counter received, accepted → Awarded (job card). */
export type DriverDirectBidStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'superseded';

/** Structured driver intent — WHY the driver recommends this load. */
export type ReachReferralReason =
  | 'truck_available'
  | 'empty_nearby'
  | 'good_margin'
  | 'reliable_customer'
  | 'other';

export const REACH_REFERRAL_REASON_LABELS: Record<ReachReferralReason, string> = {
  truck_available: 'My truck is available',
  empty_nearby: "I'll be empty nearby",
  good_margin: 'Good margin',
  reliable_customer: 'Customer is reliable',
  other: 'Other',
};

export interface ReachDriverReferralRow {
  id: string;
  campaign_id: string;
  driver_user_id: string;
  fleet_org_id: string;
  status: ReachDriverReferralStatus;
  /** Flat reward, snapshotted at recommendation time. Escrowed from the
   * campaign owner's Pulse Credits wallet, but paid out to the driver in
   * INR via driver_ledger (1:1, same convention as reach_plans' credit_price
   * vs price_inr) — not a Pulse Credits balance, drivers have no use for one. */
  reward_amount: number;
  bid_id: string | null;
  trip_id: string | null;
  created_at: string;
  decided_at: string | null;
  rewarded_at: string | null;
}

/** Decision-ready inbox row from get_reach_referral_inbox — recommendation +
 * campaign story snapshot + driver identity in one shot. */
export interface ReachReferralInboxRow {
  id: string;
  campaign_id: string;
  status: ReachDriverReferralStatus;
  reward_amount: number;
  note: string | null;
  reason: ReachReferralReason | null;
  /** Driver's suggested rate (₹) — pre-fills the fleet owner's bid on approval. */
  suggested_rate: number | null;
  created_at: string;
  decided_at: string | null;
  rewarded_at: string | null;
  driver_user_id: string;
  driver_name: string;
  driver_phone: string | null;
  /** Scoring signals — simple heuristics for V2, AI-ready later. */
  driver_trips_completed: number;
  /** Decided recommendations (any outcome) across the driver's history. */
  driver_referrals_total: number;
  driver_referrals_converted: number;
  post_id: string | null;
  campaign_org_id: string;
  campaign_status: string;
  snapshot_post_type: 'UPDATE' | 'LOAD' | null;
  snapshot_title: string | null;
  snapshot_origin: string | null;
  snapshot_destination: string | null;
  snapshot_vehicle_type: string | null;
  snapshot_material: string | null;
}

/** One story on the driver Story tab (get_driver_reach_stories). Stories
 * disappear once the load is assigned to someone else; the driver's own
 * rewarded conversions persist so the earning stays visible. */
export interface DriverReachStoryRow {
  campaign_id: string;
  campaign_org_id: string;
  org_name: string;
  org_logo_url: string | null;
  campaign_status: string;
  published_at: string | null;
  /** True original story post date (falls back to published_at). Use this for "Xd ago", not published_at. */
  posted_at: string | null;
  expires_at: string | null;
  /** Set if the org deleted the source story; the campaign snapshot keeps delivering, but the client should show this was removed. */
  source_deleted_at: string | null;
  snapshot_post_type: 'UPDATE' | 'LOAD' | null;
  snapshot_title: string | null;
  snapshot_origin: string | null;
  snapshot_destination: string | null;
  snapshot_vehicle_type: string | null;
  snapshot_material: string | null;
  snapshot_content: string | null;
  /** Load target / offered rate from the Boost snapshot (posts.rate_offer). */
  snapshot_rate_offer: number | null;
  driver_reward_enabled: boolean;
  /** Driver Incentive per converted recommendation (₹, 1:1 with credits). */
  reward_amount: number;
  /** False once the campaign's escrow can no longer cover another reward. */
  reward_available: boolean;
  referral_id: string | null;
  referral_status: ReachDriverReferralStatus | null;
  referral_reward_amount: number | null;
  recommended_at: string | null;
  rewarded_at: string | null;
  /** Underlying marketplace post — needed for the independent-driver direct-bid path. */
  post_id: string;
  direct_bid_status: DriverDirectBidStatus | null;
  direct_bid_amount: number | null;
  /** Shipper counter-offer when set; null until countered. */
  direct_bid_counter_amount: number | null;
}

/** Driver Story tab feed — the authenticated driver's boosted stories. */
export async function getDriverReachStories(): Promise<{
  error: Error | null;
  stories: DriverReachStoryRow[];
}> {
  const { data, error } = await supabase().rpc('get_driver_reach_stories');
  if (error) return { error: new Error(error.message), stories: [] };
  return { error: null, stories: (data ?? []) as DriverReachStoryRow[] };
}

/** Independent driver bids on a boosted story as themselves — no
 * organization required (submit_driver_direct_bid). Submitting again while
 * still 'pending' updates the amount/note in place. Award/acceptance is not
 * yet built; this only records the bid and its status. */
export async function submitDriverDirectBid(
  postId: string,
  amount: number,
  note?: string,
): Promise<{ error: Error | null; bidId: string | null }> {
  const { data, error } = await supabase().rpc('submit_driver_direct_bid', {
    p_post_id: postId,
    p_amount: amount,
    p_note: note?.trim() || null,
  });
  if (error) return { error: new Error(error.message), bidId: null };
  const bidId = (data as { bid_id?: string } | null)?.bid_id ?? null;
  return { error: null, bidId };
}

/** Map RPC error text to a short driver-facing line. */
export function formatDirectBidError(message: string): string {
  const m = (message ?? '').toLowerCase();
  if (m.includes('not_biddable')) {
    return 'This load is no longer open for bidding. Pull to refresh Stories.';
  }
  if (m.includes('bid_locked')) {
    return 'This bid was already decided and cannot be changed.';
  }
  if (m.includes('unauthorized')) {
    return 'Your account cannot bid on this load. Sign in as a driver / fleet owner.';
  }
  if (m.includes('invalid_amount')) {
    return 'Enter a valid bid amount greater than zero.';
  }
  if (m.includes('driver_unavailable')) {
    return "You're currently on an active trip. Complete it before bidding on another load.";
  }
  return message.trim() || 'Could not submit bid.';
}

/** Driver-channel impression/view logging — best-effort, deduped per day
 * server-side. Never blocks the viewing experience (same posture as
 * events.service.ts). */
export async function recordDriverReachEvent(
  campaignId: string,
  eventType: 'impression' | 'view',
): Promise<{ error: Error | null }> {
  const { error } = await supabase().rpc('record_reach_driver_event', {
    p_campaign_id: campaignId,
    p_event_type: eventType,
  });
  if (error) {
    if (__DEV__) console.warn('[reach-events] recordDriverReachEvent skipped:', error.message);
    return { error: new Error(error.message) };
  }
  return { error: null };
}

/** Driver's own org memberships, shaped for resolveDriverParticipation —
 * determines whether the story CTA is Recommend (employed), Join (invited),
 * or direct bidding (independent). */
export async function getDriverFleetMemberships(): Promise<{
  error: Error | null;
  memberships: { organization_id: string; status: string; role: string }[];
}> {
  const {
    data: { session },
  } = await supabase().auth.getSession();
  if (!session?.user) return { error: null, memberships: [] };

  const { data, error } = await supabase()
    .from('organization_members')
    .select('organization_id, status, role')
    .eq('user_id', session.user.id)
    .eq('role', 'driver');

  if (error) return { error: new Error(error.message), memberships: [] };
  return { error: null, memberships: data ?? [] };
}

/** One paid-out referral reward in the driver's ledger (type='reward',
 * reference_type='reach_referral') — the INR entries convert_reach_referral
 * writes on conversion. */
export interface DriverRewardLedgerEntry {
  id: string;
  organization_id: string;
  driver_id: string;
  trip_id: string | null;
  amount: number;
  description: string | null;
  created_at: string;
}

/** Withdrawal request row (driver_salary_requests, request_type='reward'). */
export interface DriverRewardWithdrawalRow {
  id: string;
  organization_id: string;
  driver_id: string;
  amount: number;
  status: string;
  created_at: string;
}

export interface DriverReferralEarningsData {
  /** Reward ledger entries, newest first. */
  entries: DriverRewardLedgerEntry[];
  /** Reward withdrawal requests, newest first. */
  withdrawals: DriverRewardWithdrawalRow[];
  /** drivers.id per fleet org for the signed-in driver (withdrawals need it). */
  driverIdByOrgId: Record<string, string>;
  /** Fleet org display names (best effort — RLS may hide some). */
  orgNameById: Record<string, string>;
}

/**
 * Everything the referral earnings card needs in one call: rewards the driver
 * has earned (driver_ledger) and withdrawals already requested against them
 * (driver_salary_requests, request_type='reward'). All reads are RLS-scoped
 * to the signed-in driver's own rows.
 */
export async function getDriverReferralEarnings(): Promise<{
  error: Error | null;
  data: DriverReferralEarningsData;
}> {
  const empty: DriverReferralEarningsData = {
    entries: [],
    withdrawals: [],
    driverIdByOrgId: {},
    orgNameById: {},
  };

  const {
    data: { session },
  } = await supabase().auth.getSession();
  if (!session?.user) return { error: null, data: empty };

  const { data: driverRows, error: driversError } = await supabase()
    .from('drivers')
    .select('id, organization_id')
    .eq('user_id', session.user.id);
  if (driversError) return { error: new Error(driversError.message), data: empty };

  const drivers = (driverRows ?? []) as { id: string; organization_id: string }[];
  if (drivers.length === 0) return { error: null, data: empty };

  const driverIds = drivers.map((d) => d.id);
  const driverIdByOrgId: Record<string, string> = {};
  for (const d of drivers) driverIdByOrgId[d.organization_id] = d.id;

  const [ledgerRes, withdrawalsRes, orgsRes] = await Promise.all([
    supabase()
      .from('driver_ledger')
      .select('id, organization_id, driver_id, trip_id, amount, description, created_at')
      .in('driver_id', driverIds)
      .eq('type', 'reward')
      .eq('reference_type', 'reach_referral')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase()
      .from('driver_salary_requests')
      .select('id, organization_id, driver_id, amount, status, created_at')
      .in('driver_id', driverIds)
      .eq('request_type', 'reward')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase()
      .from('organizations')
      .select('id, name')
      .in('id', drivers.map((d) => d.organization_id)),
  ]);

  if (ledgerRes.error) return { error: new Error(ledgerRes.error.message), data: empty };
  if (withdrawalsRes.error) return { error: new Error(withdrawalsRes.error.message), data: empty };

  const orgNameById: Record<string, string> = {};
  // Org names are cosmetic — swallow RLS misses rather than failing the card.
  for (const org of (orgsRes.data ?? []) as { id: string; name: string | null }[]) {
    if (org.name) orgNameById[org.id] = org.name;
  }

  return {
    error: null,
    data: {
      entries: (ledgerRes.data ?? []) as DriverRewardLedgerEntry[],
      withdrawals: (withdrawalsRes.data ?? []) as DriverRewardWithdrawalRow[],
      driverIdByOrgId,
      orgNameById,
    },
  };
}

/**
 * The signed-in driver's own referral for a given trip, if this trip started
 * life as a Reach recommendation (reach_referrals.trip_id is set once the
 * fleet owner's bid is awarded — see convert_reach_referral). Read-only,
 * RLS-scoped to driver_user_id = auth.uid(); presentation-layer lookup for
 * the trip card, not a new referral state or table.
 */
export async function getDriverReferralForTrip(
  tripId: string,
): Promise<{ error: Error | null; referral: ReachDriverReferralRow | null }> {
  const {
    data: { session },
  } = await supabase().auth.getSession();
  if (!session?.user) return { error: null, referral: null };

  const { data, error } = await supabase()
    .from('reach_referrals')
    .select(REFERRAL_COLUMNS)
    .eq('trip_id', tripId)
    .eq('driver_user_id', session.user.id)
    .maybeSingle();

  if (error) return { error: new Error(error.message), referral: null };
  return { error: null, referral: (data as ReachDriverReferralRow | null) ?? null };
}

/**
 * All of the signed-in driver's own referrals, across every campaign/fleet
 * org — powers the Home dashboard's "at a glance" summary (pending reward
 * total, recommendation count). Read-only, RLS-scoped to driver_user_id =
 * auth.uid(); no new table, RPC, or referral state.
 */
export async function getDriverReferralsForCurrentUser(): Promise<{
  error: Error | null;
  referrals: ReachDriverReferralRow[];
}> {
  const {
    data: { session },
  } = await supabase().auth.getSession();
  if (!session?.user) return { error: null, referrals: [] };

  const { data, error } = await supabase()
    .from('reach_referrals')
    .select(REFERRAL_COLUMNS)
    .eq('driver_user_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return { error: new Error(error.message), referrals: [] };
  return { error: null, referrals: (data ?? []) as ReachDriverReferralRow[] };
}

/** Fleet Owner Recommendation Inbox — pending first, then newest. */
export async function getReachReferralInbox(
  fleetOrgId: string,
): Promise<{ error: Error | null; inbox: ReachReferralInboxRow[] }> {
  const { data, error } = await supabase().rpc('get_reach_referral_inbox', {
    p_fleet_org_id: fleetOrgId,
  });
  if (error) return { error: new Error(error.message), inbox: [] };
  return { error: null, inbox: (data ?? []) as ReachReferralInboxRow[] };
}

const REFERRAL_COLUMNS =
  'id, campaign_id, driver_user_id, fleet_org_id, status, reward_amount, bid_id, trip_id, created_at, decided_at, rewarded_at';

/** Campaign-owner analytics: every recommendation this campaign generated. */
export async function getDriverReferralsForCampaign(
  campaignId: string,
): Promise<{ error: Error | null; referrals: ReachDriverReferralRow[] }> {
  const { data, error } = await supabase()
    .from('reach_referrals')
    .select(REFERRAL_COLUMNS)
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false });

  if (error) return { error: new Error(error.message), referrals: [] };
  return { error: null, referrals: (data ?? []) as ReachDriverReferralRow[] };
}

/** Fleet-owner inbox: recommendations drivers sent to this org. */
export async function getDriverReferralsForFleetOrg(
  fleetOrgId: string,
): Promise<{ error: Error | null; referrals: ReachDriverReferralRow[] }> {
  const { data, error } = await supabase()
    .from('reach_referrals')
    .select(REFERRAL_COLUMNS)
    .eq('fleet_org_id', fleetOrgId)
    .order('created_at', { ascending: false });

  if (error) return { error: new Error(error.message), referrals: [] };
  return { error: null, referrals: (data ?? []) as ReachDriverReferralRow[] };
}

export interface RecommendReachCampaignInput {
  campaignId: string;
  fleetOrgId: string;
  note?: string;
  reason?: ReachReferralReason;
  /** What the driver thinks the load is worth (₹) — pre-fills the bid. */
  suggestedRate?: number;
}

/** Driver taps "Recommend to Fleet Owner" on a boosted story. */
export async function recommendReachCampaign(
  input: RecommendReachCampaignInput,
): Promise<{ error: Error | null; referralId: string | null }> {
  const { data, error } = await supabase().rpc('recommend_reach_campaign', {
    p_campaign_id: input.campaignId,
    p_fleet_org_id: input.fleetOrgId,
    p_note: input.note?.trim() || null,
    p_reason: input.reason ?? null,
    p_suggested_rate: input.suggestedRate ?? null,
  });
  if (error) return { error: new Error(error.message), referralId: null };
  return { error: null, referralId: (data as { referral_id: string }).referral_id };
}

/** Fleet owner approves (unlocks the normal bid flow) or rejects. */
export async function decideReachReferral(
  referralId: string,
  approve: boolean,
): Promise<{ error: Error | null }> {
  const { error } = await supabase().rpc('decide_reach_referral', {
    p_referral_id: referralId,
    p_approve: approve,
  });
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

/** Links the fleet owner's submitted bid to the referral for conversion tracking. */
export async function markReachReferralBid(
  referralId: string,
  bidId: string,
): Promise<{ error: Error | null }> {
  const { error } = await supabase().rpc('mark_reach_referral_bid', {
    p_referral_id: referralId,
    p_bid_id: bidId,
  });
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

/** Trip awarded + started → releases the reward from escrow. */
export async function convertReachReferral(
  referralId: string,
  tripId: string,
): Promise<{ error: Error | null }> {
  const { error } = await supabase().rpc('convert_reach_referral', {
    p_referral_id: referralId,
    p_trip_id: tripId,
  });
  if (error) return { error: new Error(error.message) };
  return { error: null };
}
