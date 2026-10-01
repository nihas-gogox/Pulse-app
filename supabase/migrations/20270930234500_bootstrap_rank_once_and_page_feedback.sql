-- get_initial_chat_state only.
--
-- 1. ranked_trips no longer joins v_long_haul_health. That view inlines into
--    two driver_locations aggregates per candidate trip (current_km and the
--    health CASE). The odometer span is computed once, behind OFFSET 0, and
--    only when actual_distance_traveled_km is null (COALESCE does not
--    evaluate the subquery otherwise). trip_health reads that stored value.
--    Status strings, 0.7 / 0.9 thresholds, and late_flag ordering are unchanged.
--    v_long_haul_health itself is not modified.
--
-- 2. feedback_state runs only for trips that survive the same page predicate
--    the projection already uses. When p_trip_limit is null, every ranked trip
--    is on the page, matching the previous unpaged result.

CREATE OR REPLACE FUNCTION public.get_initial_chat_state(
  p_organization_id uuid,
  p_message_limit integer DEFAULT 50,
  p_trip_limit integer DEFAULT NULL::integer,
  p_trip_offset integer DEFAULT 0,
  p_hub_trip_bucket text DEFAULT 'active'::text,
  p_include_message_bodies boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_bucket text;
BEGIN
  v_bucket := lower(trim(coalesce(p_hub_trip_bucket, 'active')));
  IF v_bucket NOT IN ('active', 'history', 'all') THEN
    v_bucket := 'active';
  END IF;

  RETURN (
    WITH linked_supplier_trip_ids AS MATERIALIZED (
      SELECT tr.id
      FROM   public.trips tr
      WHERE  tr.status NOT IN ('cancelled')
        AND  EXISTS (
          SELECT 1 FROM public.suppliers s
          WHERE  s.id = tr.supplier_id
            AND  s.linked_organization_id = p_organization_id
        )
      LIMIT 500
    ),
    scoped_convs AS MATERIALIZED (
      SELECT tc.id, tc.trip_id
      FROM   public.trip_conversations tc
      JOIN   public.trips t ON t.id = tc.trip_id
      WHERE (
        tc.organization_id = p_organization_id
        OR tc.trip_id IN (SELECT id FROM linked_supplier_trip_ids)
      )
        AND t.status <> 'cancelled'
        AND (
          v_bucket = 'all'
          OR (
            v_bucket = 'active'
            AND lower(trim(coalesce(t.status::text, ''))) NOT IN ('completed', 'delivered', 'done')
          )
          OR (
            v_bucket = 'history'
            AND lower(trim(coalesce(t.status::text, ''))) IN ('completed', 'delivered', 'done')
          )
        )
    ),
    -- One odometer aggregate per candidate trip. OFFSET 0 keeps the aggregate
    -- from being inlined into the health CASE. COALESCE skips it when
    -- actual_distance_traveled_km is already set.
    trip_pace AS MATERIALIZED (
      SELECT
        t.id AS trip_id,
        COALESCE(
          t.actual_distance_traveled_km::double precision,
          (
            SELECT span_km
            FROM (
              SELECT CASE
                WHEN count(*) FILTER (WHERE dl.odometer_km IS NOT NULL) >= 2
                  THEN max(dl.odometer_km) - min(dl.odometer_km)
                ELSE NULL::double precision
              END AS span_km
              FROM public.driver_locations dl
              WHERE dl.trip_id = t.id
            ) once
            OFFSET 0
          )
        ) AS distance_km,
        COALESCE(t.started_at, t.pickup_date::timestamptz) AS anchor,
        t.status,
        EXTRACT(EPOCH FROM (now() - COALESCE(t.started_at, t.pickup_date::timestamptz, t.created_at))) AS elapsed_seconds,
        GREATEST(
          EXTRACT(EPOCH FROM (now() - COALESCE(t.started_at, t.pickup_date::timestamptz, t.created_at))) / 86400.0
            * 350.0,
          0::double precision
        ) AS expected_km
      FROM (SELECT DISTINCT sc.trip_id FROM scoped_convs sc) ids
      JOIN public.trips t ON t.id = ids.trip_id
    ),
    trip_health AS MATERIALIZED (
      SELECT
        p.trip_id,
        CASE
          WHEN p.anchor IS NULL THEN 'ON_TRACK'
          WHEN lower(trim(p.status)) NOT IN (
            'in_transit', 'picked_up', 'in_progress', 'transit', 'at_drop',
            'loading', 'unloading', 'at_pickup', 'assigned', 'active'
          ) THEN 'ON_TRACK'
          WHEN p.elapsed_seconds <= 0 THEN 'ON_TRACK'
          WHEN COALESCE(p.distance_km, 0::double precision) < p.expected_km * 0.7
            THEN 'CRITICAL_DELAY'
          WHEN COALESCE(p.distance_km, 0::double precision) < p.expected_km * 0.9
            THEN 'LATE_RISK'
          ELSE 'ON_TRACK'
        END AS health_status
      FROM trip_pace p
    ),
    ranked_trips AS MATERIALIZED (
      SELECT
        agg.trip_id,
        ROW_NUMBER() OVER (
          ORDER BY
            CASE WHEN agg.max_unread > 0 THEN 0 ELSE 1 END,
            agg.late_flag DESC,
            agg.last_at DESC NULLS LAST
        ) AS rn
      FROM (
        SELECT
          base.trip_id,
          MAX(COALESCE(tc2.unread_dispatcher_count, 0))::int AS max_unread,
          MAX(tc2.last_message_at) AS last_at,
          MAX(
            CASE
              WHEN h.health_status IN ('LATE_RISK', 'CRITICAL_DELAY')
              THEN 1
              ELSE 0
            END
          )::int AS late_flag
        FROM (SELECT DISTINCT sc.trip_id FROM scoped_convs sc) base
        JOIN public.trip_conversations tc2 ON tc2.trip_id = base.trip_id
        LEFT JOIN trip_health h ON h.trip_id = base.trip_id
        GROUP BY base.trip_id
      ) agg
    ),
    page_trips AS MATERIALIZED (
      SELECT r.trip_id
      FROM ranked_trips r
      WHERE p_trip_limit IS NULL
         OR (r.rn > p_trip_offset AND r.rn <= p_trip_offset + p_trip_limit)
    ),
    feedback_state AS MATERIALIZED (
      SELECT
        m.conversation_id,
        CASE
          WHEN bool_or((m.metadata->>'submitted_at') IS NOT NULL) THEN 'rated'
          WHEN bool_or(
            (m.metadata->>'submitted_at') IS NULL
            AND COALESCE(m.metadata->>'rating_status', '') <> 'rated'
          ) THEN 'pending'
          ELSE 'none'
        END AS status
      FROM public.trip_messages m
      JOIN scoped_convs sc ON sc.id = m.conversation_id
      JOIN page_trips pt ON pt.trip_id = sc.trip_id
      WHERE m.message_type IN ('feedback_request', 'feedback')
      GROUP BY m.conversation_id
    )
    SELECT COALESCE(
      jsonb_agg(c ORDER BY (c->>'last_message_at') DESC NULLS LAST),
      '[]'::jsonb
    )
    FROM (
      SELECT jsonb_build_object(
        'id',                      tc.id,
        'organization_id',         tc.organization_id,
        'trip_organization_id',    t.organization_id,
        'trip_organization_name',  o_trip.name,
        'indent_creator_organization_name', o_ind.name::text,
        'trip_id',                 tc.trip_id,
        'indent_id',               t.indent_id,
        'party_type',              tc.party_type,
        'party_name',              tc.party_name,
        'client_id',               tc.client_id,
        'supplier_id',             tc.supplier_id,
        'driver_id',               tc.driver_id,
        'last_message_at',         tc.last_message_at,
        'last_message_preview',    tc.last_message_preview,
        'unread_dispatcher_count', COALESCE(tc.unread_dispatcher_count, 0),
        'created_at',              tc.created_at,
        'updated_at',              tc.updated_at,
        'trip_number',             t.trip_number,
        'display_trip_id',         t.display_trip_id,
        'trip_status',             t.status,
        'trip_driver_id',          t.driver_id,
        'trip_supplier_id',        t.supplier_id,
        'trip_created_at',         t.created_at,
        'trip_source',             COALESCE(t.source::text, ''),
        'pickup_area',             t.pickup_area,
        'drop_location',           t.drop_location,
        'trip_feedback_status',    COALESCE(fs.status, 'none'),
        'messages', CASE WHEN p_include_message_bodies THEN COALESCE((
          SELECT jsonb_agg(msg_row ORDER BY msg_row->>'created_at' ASC)
          FROM (
            SELECT jsonb_build_object(
              'id',                 tm.id,
              'conversation_id',    tm.conversation_id,
              'organization_id',    tm.organization_id,
              'sender_user_id',     tm.sender_user_id,
              'sender_role',        tm.sender_role,
              'sender_name',        tm.sender_name,
              'content',            tm.content,
              'message_type',       tm.message_type,
              'metadata',           tm.metadata,
              'is_read',            tm.is_read,
              'read_at',            tm.read_at,
              'created_at',         tm.created_at,
              'sender_avatar_seed', tm.sender_avatar_seed,
              'is_delivered',       COALESCE(tm.is_delivered, FALSE),
              'delivered_at',       tm.delivered_at,
              'reactions',          COALESCE(tm.reactions, '{}'::jsonb),
              'reply_to_id',        tm.reply_to_id,
              'reply_to_preview',   tm.reply_to_preview,
              'edited_at',          tm.edited_at
            ) AS msg_row
            FROM (
              SELECT *
              FROM   public.trip_messages m
              WHERE  m.conversation_id = tc.id
                AND  (
                  m.message_type NOT IN ('ledger_event', 'ledger', 'payment', 'ledger_update')
                  OR COALESCE(
                    nullif(trim(m.metadata->>'sender_org_id'), ''),
                    nullif(trim(m.metadata->'event_payload'->>'sender_org_id'), '')
                  ) = p_organization_id::text
                  OR COALESCE(
                    nullif(trim(m.metadata->>'receiver_org_id'), ''),
                    nullif(trim(m.metadata->'event_payload'->>'receiver_org_id'), '')
                  ) = p_organization_id::text
                )
              ORDER  BY m.created_at DESC
              LIMIT  p_message_limit
            ) tm
          ) sub
        ), '[]'::jsonb) ELSE '[]'::jsonb END
      ) AS c
      FROM  public.trip_conversations tc
      JOIN  scoped_convs sc ON sc.id = tc.id
      JOIN  public.trips  t  ON t.id = tc.trip_id
      LEFT  JOIN public.organizations o_trip ON o_trip.id = t.organization_id
      LEFT  JOIN public.indents ind ON ind.id = t.indent_id
      LEFT  JOIN public.organizations o_ind ON o_ind.id = ind.organization_id
      LEFT  JOIN ranked_trips r ON r.trip_id = tc.trip_id
      LEFT  JOIN feedback_state fs ON fs.conversation_id = tc.id
      WHERE p_trip_limit IS NULL
         OR (r.rn > p_trip_offset AND r.rn <= p_trip_offset + p_trip_limit)
    ) rows
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_initial_chat_state(uuid, integer, integer, integer, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_initial_chat_state(uuid, integer, integer, integer, text, boolean) TO service_role;
