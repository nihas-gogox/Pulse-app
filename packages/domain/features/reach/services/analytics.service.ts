/**
 * Reach analytics — exactly 4 numbers (Impressions, Views, Bids, Credits
 * Used). No CTR/CPM/CPC — this is a fleet-owner/logistics audience, not a
 * marketing dashboard. See get_reach_campaign_metrics in
 * 20261224040000_reach_campaigns_core.sql for the materialized+live-tail math.
 */
import { supabase } from '@pulse/core/lib/supabase';

export interface ReachCampaignMetrics {
  impressions: number;
  views: number;
  bids: number;
  creditsUsed: number;
}

export async function getReachCampaignMetrics(
  campaignId: string,
): Promise<{ error: Error | null; metrics: ReachCampaignMetrics | null }> {
  const { data, error } = await supabase()
    .rpc('get_reach_campaign_metrics', { p_campaign_id: campaignId })
    .single();

  if (error) return { error: new Error(error.message), metrics: null };

  const row = data as { impressions: number; views: number; bids: number; credits_used: number };
  return {
    error: null,
    metrics: {
      impressions: row.impressions,
      views: row.views,
      bids: row.bids,
      creditsUsed: row.credits_used,
    },
  };
}

export interface ReachOrgSummary {
  walletBalance: number;
  campaigns: { active: number; completed: number; total: number };
  metrics: ReachCampaignMetrics;
  /** promised/delivered are computed from real data (active campaigns' plan
   * caps vs. actual impressions), not placeholders — see
   * get_reach_org_summary in 20261227000000_reach_org_summary_reshape.sql. */
  reach: { promised: number; delivered: number };
}

/** Overall Reach overview for an org — nested shape kept deliberately
 * future-proof (see 20261227000000_reach_org_summary_reshape.sql) so it
 * doesn't need reshaping again as Reach grows. */
export async function getReachOrgSummary(
  orgId: string,
): Promise<{ error: Error | null; summary: ReachOrgSummary | null }> {
  const { data, error } = await supabase().rpc('get_reach_org_summary', { p_org_id: orgId });

  if (error) return { error: new Error(error.message), summary: null };

  const row = data as {
    wallet_balance: number;
    campaigns: { active: number; completed: number; total: number };
    metrics: { impressions: number; views: number; bids: number; credits_used: number };
    reach: { promised: number; delivered: number };
  };
  return {
    error: null,
    summary: {
      walletBalance: row.wallet_balance,
      campaigns: row.campaigns,
      metrics: {
        impressions: row.metrics.impressions,
        views: row.metrics.views,
        bids: row.metrics.bids,
        creditsUsed: row.metrics.credits_used,
      },
      reach: row.reach,
    },
  };
}
