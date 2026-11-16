-- Migration sans perte : verrouillage strict du profil Ménage sur l'écran Chambres uniquement
-- Remet à 'AUCUN' les accès Accueil, Planning, Clients, Facturation, Restaurant, Cuisine et Rapports
-- pour tout compte Ménage (starter_profile = 'MENAGE' ou role = 'HOUSEKEEPING') ayant des droits personnalisés,
-- tout en conservant l'accès Chambres et le chaînage SHA-256 canonique du journal audit_log.

DO $$
DECLARE
  rec RECORD;
  v_prev_hash TEXT;
  v_id UUID;
  v_now TIMESTAMP(3);
  v_now_iso TEXT;
  v_chambres TEXT;
  v_before_json TEXT;
  v_new_access_json TEXT;
  v_after_json TEXT;
  v_payload TEXT;
  v_entry_hash TEXT;
  v_count INT := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(948201);

  SELECT COALESCE(
    (SELECT "entry_hash" FROM "audit_log" ORDER BY "seq" DESC, "created_at" DESC LIMIT 1),
    'GENESIS'
  ) INTO v_prev_hash;

  FOR rec IN
    SELECT "id", "email", "full_name", "role"::text AS "role_text", "starter_profile", "screen_access"
    FROM "users"
    WHERE NOT ("is_primary_admin" = true OR "role"::text = 'DIRECTION')
      AND ("starter_profile" = 'MENAGE' OR "role"::text = 'HOUSEKEEPING')
      AND "screen_access" IS NOT NULL
      AND (
        COALESCE("screen_access"->>'accueil', 'AUCUN') <> 'AUCUN'
        OR COALESCE("screen_access"->>'planning', 'AUCUN') <> 'AUCUN'
        OR COALESCE("screen_access"->>'clients', 'AUCUN') <> 'AUCUN'
        OR COALESCE("screen_access"->>'facturation', 'AUCUN') <> 'AUCUN'
        OR COALESCE("screen_access"->>'restaurant', 'AUCUN') <> 'AUCUN'
        OR COALESCE("screen_access"->>'cuisine', 'AUCUN') <> 'AUCUN'
        OR COALESCE("screen_access"->>'rapports', 'AUCUN') <> 'AUCUN'
      )
    ORDER BY "created_at" ASC, "id" ASC
  LOOP
    v_chambres := COALESCE(NULLIF(rec."screen_access"->>'chambres', 'AUCUN'), 'LECTURE');

    -- Ordre alphabétique strict et compact sans espaces pour canonicalJson() :
    -- accueil < chambres < clients < cuisine < facturation < planning < rapports < restaurant
    v_before_json :=
      '{"accueil":' || to_json(COALESCE(rec."screen_access"->>'accueil', 'AUCUN'))::text ||
      ',"chambres":' || to_json(COALESCE(rec."screen_access"->>'chambres', 'AUCUN'))::text ||
      ',"clients":' || to_json(COALESCE(rec."screen_access"->>'clients', 'AUCUN'))::text ||
      ',"cuisine":' || to_json(COALESCE(rec."screen_access"->>'cuisine', 'AUCUN'))::text ||
      ',"facturation":' || to_json(COALESCE(rec."screen_access"->>'facturation', 'AUCUN'))::text ||
      ',"planning":' || to_json(COALESCE(rec."screen_access"->>'planning', 'AUCUN'))::text ||
      ',"rapports":' || to_json(COALESCE(rec."screen_access"->>'rapports', 'AUCUN'))::text ||
      ',"restaurant":' || to_json(COALESCE(rec."screen_access"->>'restaurant', 'AUCUN'))::text || '}';

    v_new_access_json :=
      '{"accueil":"AUCUN","chambres":' || to_json(v_chambres)::text ||
      ',"clients":"AUCUN","cuisine":"AUCUN","facturation":"AUCUN","planning":"AUCUN","rapports":"AUCUN","restaurant":"AUCUN"}';

    UPDATE "users"
    SET "screen_access" = v_new_access_json::jsonb
    WHERE "id" = rec."id";

    v_id := md5(random()::text || clock_timestamp()::text || rec."id"::text)::uuid;
    v_now := date_trunc('milliseconds', clock_timestamp() AT TIME ZONE 'UTC');
    v_now_iso := to_char(v_now, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
    v_after_json := '{"email":' || to_json(rec."email")::text || ',"screenAccess":' || v_new_access_json || '}';
    v_payload := COALESCE(v_prev_hash, 'GENESIS') || '|' ||
      v_id::text || '|' ||
      v_now_iso || '|' ||
      'MIGRATION_VERROUILLAGE_MENAGE|User|' ||
      rec."id"::text || '|' ||
      v_before_json || '|' ||
      v_after_json || '|';
    v_entry_hash := encode(sha256(convert_to(v_payload, 'UTF8')), 'hex');

    INSERT INTO "audit_log" (
      "id", "action", "entity", "entity_id", "before", "after", "prev_hash", "entry_hash", "created_at"
    )
    VALUES (
      v_id,
      'MIGRATION_VERROUILLAGE_MENAGE',
      'User',
      rec."id"::text,
      v_before_json::jsonb,
      v_after_json::jsonb,
      v_prev_hash,
      v_entry_hash,
      v_now
    );

    v_prev_hash := v_entry_hash;
    v_count := v_count + 1;
  END LOOP;

  IF v_count = 0 THEN
    v_id := md5(random()::text || clock_timestamp()::text || 'menage')::uuid;
    v_now := date_trunc('milliseconds', clock_timestamp() AT TIME ZONE 'UTC');
    v_now_iso := to_char(v_now, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
    v_after_json := '{"correctedCount":0}';
    v_payload := COALESCE(v_prev_hash, 'GENESIS') || '|' ||
      v_id::text || '|' ||
      v_now_iso || '|' ||
      'MIGRATION_VERROUILLAGE_MENAGE|System|menage|null|' ||
      v_after_json || '|';
    v_entry_hash := encode(sha256(convert_to(v_payload, 'UTF8')), 'hex');

    INSERT INTO "audit_log" (
      "id", "action", "entity", "entity_id", "after", "prev_hash", "entry_hash", "created_at"
    )
    VALUES (
      v_id,
      'MIGRATION_VERROUILLAGE_MENAGE',
      'System',
      'menage',
      v_after_json::jsonb,
      v_prev_hash,
      v_entry_hash,
      v_now
    );
  END IF;
END $$;
