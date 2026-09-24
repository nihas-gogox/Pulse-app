/**
 * Ratings: Client→Supplier, Client→Driver (indent trips), Supplier→Driver, Organization→Driver (asset trips).
 */

export type RaterType = 'client' | 'supplier' | 'organization' | 'driver';
export type RatedType = 'client' | 'supplier' | 'driver';

export interface RatingRow {
  id: string;
  organization_id: string;
  trip_id: string;
  rater_type: RaterType;
  rater_id: string;
  rated_type: RatedType;
  rated_id: string;
  score: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateRatingData {
  trip_id: string;
  rater_type: RaterType;
  rater_id: string;
  rated_type: RatedType;
  rated_id: string;
  score: number;
  comment?: string | null;
}
