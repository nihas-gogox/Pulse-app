/**
 * Phase 3B.1 — Fleet Owner capacity Stories (posts.type = VEHICLE_AVAILABILITY).
 * No bidding / Boost / trip create.
 */
import { supabase } from '@pulse/core/lib/supabase';

export type FleetOwnerCapacityStory = {
  id: string;
  author_user_id: string;
  type: 'VEHICLE_AVAILABILITY';
  content: string | null;
  origin: string | null;
  destination: string | null;
  load_date: string | null;
  vehicle_type: string | null;
  rate_offer: number | null;
  material: string | null;
  expires_at: string | null;
  is_active: boolean;
  owner_vehicle_id: string | null;
  created_at: string;
};

export type CreateCapacityStoryInput = {
  ownerVehicleId: string;
  origin: string;
  destination?: string | null;
  availableFrom?: string | null;
  rateOffer?: number | null;
  content?: string | null;
  expiresAt?: string | null;
};

export async function createFleetOwnerCapacityStory(
  input: CreateCapacityStoryInput,
): Promise<{ error: Error | null; story: FleetOwnerCapacityStory | null }> {
  const { data, error } = await supabase().rpc('create_fleet_owner_capacity_story', {
    p_owner_vehicle_id: input.ownerVehicleId,
    p_available_from: input.availableFrom || null,
    p_origin: input.origin.trim(),
    p_destination: (input.destination ?? '').trim() || null,
    p_rate_offer: input.rateOffer ?? null,
    p_content: (input.content ?? '').trim() || null,
    p_expires_at: input.expiresAt || null,
  });
  if (error) return { error: new Error(error.message), story: null };
  return { error: null, story: data as FleetOwnerCapacityStory };
}

export async function listMyFleetOwnerCapacityStories(
  authorUserId: string,
): Promise<{ error: Error | null; stories: FleetOwnerCapacityStory[] }> {
  if (!authorUserId) return { error: null, stories: [] };
  const { data, error } = await supabase()
    .from('posts')
    .select(
      'id,author_user_id,type,content,origin,destination,load_date,vehicle_type,rate_offer,material,expires_at,is_active,owner_vehicle_id,created_at',
    )
    .eq('author_user_id', authorUserId)
    .eq('type', 'VEHICLE_AVAILABILITY')
    .is('organization_id', null)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) return { error: new Error(error.message), stories: [] };
  return { error: null, stories: (data ?? []) as FleetOwnerCapacityStory[] };
}

export async function deactivateFleetOwnerCapacityStory(
  postId: string,
): Promise<{ error: Error | null }> {
  const { data, error } = await supabase().rpc(
    'deactivate_fleet_owner_capacity_story',
    { p_post_id: postId },
  );
  if (error) return { error: new Error(error.message) };
  if (!data) return { error: new Error('Story not found or already inactive') };
  return { error: null };
}

export function capacityStoryRouteLabel(story: FleetOwnerCapacityStory): string {
  const from = (story.origin ?? '').trim() || 'Available';
  const to = (story.destination ?? '').trim();
  return to ? `${from} → ${to}` : from;
}
