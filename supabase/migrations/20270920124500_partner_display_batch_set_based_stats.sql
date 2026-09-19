-- Local candidate only — do not db push until approved.
-- get_connection_partner_display_batch previously ran four LATERAL aggregates
-- per organization in the batch (trips, ratings UNION ALL, vehicles, indents).
-- That is N sequential index probes per call. Rewrite as one GROUP BY per
-- fact table over the id set. JSON keys and values are unchanged.

CREATE OR REPLACE FUNCTION public.get_connection_partner_display_batch(p_linked_organization_ids uuid[])
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH wanted AS (
    SELECT DISTINCT id
    FROM unnest(p_linked_organization_ids) AS u(id)
    WHERE id IS NOT NULL
  ),
  trip_stats AS (
    SELECT t.organization_id AS org_id, count(*)::int AS trip_count
    FROM public.trips t
    WHERE t.organization_id IN (SELECT id FROM wanted)
      AND t.deleted_at IS NULL
    GROUP BY t.organization_id
  ),
  rating_stats AS (
    SELECT all_ratings.org_id,
      round(avg(all_ratings.score)::numeric, 2)::numeric(3, 2) AS average_rating,
      count(*)::int AS rating_count
    FROM (
      SELECT w.id AS org_id, r.score
      FROM wanted w
      JOIN public.ratings r ON r.rated_id = w.id

      UNION ALL

      SELECT c.linked_organization_id AS org_id, r.score
      FROM public.clients c
      JOIN public.ratings r ON r.rated_id = c.id
      WHERE c.linked_organization_id IN (SELECT id FROM wanted)
        AND c.deleted_at IS NULL

      UNION ALL

      SELECT s.linked_organization_id AS org_id, r.score
      FROM public.suppliers s
      JOIN public.ratings r ON r.rated_id = s.id
      WHERE s.linked_organization_id IN (SELECT id FROM wanted)
        AND s.deleted_at IS NULL
    ) all_ratings
    GROUP BY all_ratings.org_id
  ),
  fleet_stats AS (
    SELECT v.organization_id AS org_id, count(*)::int AS vehicle_count
    FROM public.vehicles v
    WHERE v.organization_id IN (SELECT id FROM wanted)
      AND v.deleted_at IS NULL
    GROUP BY v.organization_id
  ),
  indent_stats AS (
    SELECT i.organization_id AS org_id, count(*)::int AS network_indent_count
    FROM public.indents i
    WHERE i.organization_id IN (SELECT id FROM wanted)
      AND i.deleted_at IS NULL
      AND (i.status = 'broadcast' OR i.shared_at IS NOT NULL)
    GROUP BY i.organization_id
  )
  SELECT coalesce(
    jsonb_object_agg(
      o.id::text,
      jsonb_build_object(
        'organizationName', o.name,
        'contactPerson',    p.full_name,
        'phone',            p.phone,
        'email',            p.email,
        'logoUrl',          NULLIF(TRIM(o.logo_url), ''),
        'ownerAvatarUrl',   NULLIF(TRIM(p.avatar_url), ''),
        'orgAvatarSeed',    NULLIF(TRIM(p.avatar_seed), ''),
        'avatarUrl',        COALESCE(NULLIF(TRIM(o.logo_url), ''), p.avatar_url),
        'avatarSeed',       NULLIF(TRIM(p.avatar_seed), ''),
        'ownerId',          o.owner_id,
        'orgCreatedAt',     o.created_at,
        'ownerSignedUpAt',  p.created_at,
        'tripCount',        coalesce(trip_stats.trip_count, 0),
        'averageRating',    rating_stats.average_rating,
        'ratingCount',      coalesce(rating_stats.rating_count, 0),
        'verificationStatus', o.verification_status::text,
        'vehicleCount',     coalesce(fleet_stats.vehicle_count, 0),
        'networkIndentCount', coalesce(indent_stats.network_indent_count, 0)
      )
    ),
    '{}'::jsonb
  )
  FROM public.organizations o
  JOIN public.profiles p ON p.id = o.owner_id
  JOIN wanted w ON w.id = o.id
  LEFT JOIN trip_stats ON trip_stats.org_id = o.id
  LEFT JOIN rating_stats ON rating_stats.org_id = o.id
  LEFT JOIN fleet_stats ON fleet_stats.org_id = o.id
  LEFT JOIN indent_stats ON indent_stats.org_id = o.id;
$function$;

COMMENT ON FUNCTION public.get_connection_partner_display_batch(uuid[]) IS
  'Batch partner display JSON keyed by org id. Stats are set-based over the id array (not per-row LATERAL).';

REVOKE ALL ON FUNCTION public.get_connection_partner_display_batch(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_connection_partner_display_batch(uuid[]) TO authenticated;
