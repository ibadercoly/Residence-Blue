-- Migration sans perte : restriction stricte de l'écran Rapports (Directeur et Comptable uniquement)
-- Retire uniquement screen_access.rapports (mis à 'AUCUN') aux autres profils sans modifier aucune autre permission,
-- tout en conservant le chaînage SHA-256 du journal audit_log.

DO $$
DECLARE
  rec RECORD;
  v_prev_rapports TEXT;
  v_prev_hash TEXT;
  v_id UUID;
  v_now TIMESTAMP(3);
  v_now_iso TEXT;
  v_before_json TEXT;
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
      AND COALESCE("starter_profile", '') <> 'COMPTABLE'
      AND "role"::text <> 'COMPTABLE'
      AND "screen_access" IS NOT NULL
      AND COALESCE("screen_access"->>'rapports', 'AUCUN') <> 'AUCUN'
    ORDER BY "created_at" ASC, "id" ASC
  LOOP
    v_prev_rapports := COALESCE(rec."screen_access"->>'rapports', 'LECTURE');

    UPDATE "users"
    SET "screen_access" = jsonb_set("screen_access", '{rapports}', '"AUCUN"'::jsonb, true)
    WHERE "id" = rec."id";

    v_id := md5(random()::text || clock_timestamp()::text || rec."id"::text)::uuid;
    v_now := date_trunc('milliseconds', clock_timestamp() AT TIME ZONE 'UTC');
    v_now_iso := to_char(v_now, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
    v_before_json := '{"rapports":' || to_json(v_prev_rapports)::text || '}';
    v_after_json := '{"email":' || to_json(rec."email")::text || ',"rapports":"AUCUN"}';
    v_payload := COALESCE(v_prev_hash, 'GENESIS') || '|' ||
      v_id::text || '|' ||
      v_now_iso || '|' ||
      'MIGRATION_RETRAIT_ACCES_RAPPORTS|User|' ||
      rec."id"::text || '|' ||
      v_before_json || '|' ||
      v_after_json || '|';
    v_entry_hash := encode(sha256(convert_to(v_payload, 'UTF8')), 'hex');

    INSERT INTO "audit_log" (
      "id", "action", "entity", "entity_id", "before", "after", "prev_hash", "entry_hash", "created_at"
    )
    VALUES (
      v_id,
      'MIGRATION_RETRAIT_ACCES_RAPPORTS',
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
    v_id := md5(random()::text || clock_timestamp()::text || 'rapports')::uuid;
    v_now := date_trunc('milliseconds', clock_timestamp() AT TIME ZONE 'UTC');
    v_now_iso := to_char(v_now, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
    v_after_json := '{"correctedCount":0}';
    v_payload := COALESCE(v_prev_hash, 'GENESIS') || '|' ||
      v_id::text || '|' ||
      v_now_iso || '|' ||
      'MIGRATION_RETRAIT_ACCES_RAPPORTS|System|rapports|null|' ||
      v_after_json || '|';
    v_entry_hash := encode(sha256(convert_to(v_payload, 'UTF8')), 'hex');

    INSERT INTO "audit_log" (
      "id", "action", "entity", "entity_id", "after", "prev_hash", "entry_hash", "created_at"
    )
    VALUES (
      v_id,
      'MIGRATION_RETRAIT_ACCES_RAPPORTS',
      'System',
      'rapports',
      v_after_json::jsonb,
      v_prev_hash,
      v_entry_hash,
      v_now
    );
  END IF;
END
$$;
