-- Migration sans perte : réserve l'accès à l'écran Cuisine uniquement aux comptes Cuisinier.
-- 1) Retire l'accès 'cuisine' à tous les comptes non-cuisiniers (y compris DIRECTION) et journalise dans audit_log.
-- 2) Verrouille les comptes CUISINIER / CUISINE sur Cuisine en modification uniquement, sans droits particuliers.

DO $$
DECLARE
  rec RECORD;
  v_prev_hash TEXT;
  v_id UUID;
  v_now TIMESTAMP(3);
  v_now_iso TEXT;
  v_before_json TEXT;
  v_new_access_json TEXT;
  v_after_json TEXT;
  v_payload TEXT;
  v_entry_hash TEXT;
  v_count INT := 0;
  v_names TEXT := '';
  v_display_name TEXT;
  v_accueil TEXT;
  v_chambres TEXT;
  v_clients TEXT;
  v_facturation TEXT;
  v_planning TEXT;
  v_rapports TEXT;
  v_restaurant TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(948202);

  SELECT COALESCE(
    (SELECT "entry_hash" FROM "audit_log" ORDER BY "seq" DESC, "created_at" DESC LIMIT 1),
    'GENESIS'
  ) INTO v_prev_hash;

  -- A. Retirer l'accès Cuisine à tous les comptes qui ne sont pas Cuisinier
  FOR rec IN
    SELECT "id", "email", "full_name", "role"::text AS "role_text", "screen_access"
    FROM "users"
    WHERE "role"::text NOT IN ('CUISINIER', 'CUISINE')
      AND (
        ("screen_access" IS NOT NULL AND COALESCE("screen_access"->>'cuisine', 'AUCUN') <> 'AUCUN')
        OR ("screen_access" IS NULL AND "role"::text = 'DIRECTION')
      )
    ORDER BY "created_at" ASC, "id" ASC
  LOOP
    IF rec."screen_access" IS NULL THEN
      v_accueil := 'ECRITURE';
      v_chambres := 'ECRITURE';
      v_clients := 'ECRITURE';
      v_facturation := 'ECRITURE';
      v_planning := 'ECRITURE';
      v_rapports := 'ECRITURE';
      v_restaurant := 'ECRITURE';
      v_before_json :=
        '{"accueil":"ECRITURE","chambres":"ECRITURE","clients":"ECRITURE","cuisine":"ECRITURE","facturation":"ECRITURE","planning":"ECRITURE","rapports":"ECRITURE","restaurant":"ECRITURE"}';
    ELSE
      v_accueil := COALESCE(rec."screen_access"->>'accueil', 'AUCUN');
      v_chambres := COALESCE(rec."screen_access"->>'chambres', 'AUCUN');
      v_clients := COALESCE(rec."screen_access"->>'clients', 'AUCUN');
      v_facturation := COALESCE(rec."screen_access"->>'facturation', 'AUCUN');
      v_planning := COALESCE(rec."screen_access"->>'planning', 'AUCUN');
      v_rapports := COALESCE(rec."screen_access"->>'rapports', 'AUCUN');
      v_restaurant := COALESCE(rec."screen_access"->>'restaurant', 'AUCUN');
      v_before_json :=
        '{"accueil":' || to_json(v_accueil)::text ||
        ',"chambres":' || to_json(v_chambres)::text ||
        ',"clients":' || to_json(v_clients)::text ||
        ',"cuisine":' || to_json(COALESCE(rec."screen_access"->>'cuisine', 'AUCUN'))::text ||
        ',"facturation":' || to_json(v_facturation)::text ||
        ',"planning":' || to_json(v_planning)::text ||
        ',"rapports":' || to_json(v_rapports)::text ||
        ',"restaurant":' || to_json(v_restaurant)::text || '}';
    END IF;

    v_new_access_json :=
      '{"accueil":' || to_json(v_accueil)::text ||
      ',"chambres":' || to_json(v_chambres)::text ||
      ',"clients":' || to_json(v_clients)::text ||
      ',"cuisine":"AUCUN"' ||
      ',"facturation":' || to_json(v_facturation)::text ||
      ',"planning":' || to_json(v_planning)::text ||
      ',"rapports":' || to_json(v_rapports)::text ||
      ',"restaurant":' || to_json(v_restaurant)::text || '}';

    UPDATE "users"
    SET "screen_access" = v_new_access_json::jsonb
    WHERE "id" = rec."id";

    v_display_name := COALESCE(NULLIF(BTRIM(rec."full_name"), ''), rec."email");
    IF v_names = '' THEN
      v_names := v_display_name || ' (' || rec."email" || ')';
    ELSE
      v_names := v_names || ', ' || v_display_name || ' (' || rec."email" || ')';
    END IF;

    v_id := md5(random()::text || clock_timestamp()::text || rec."id"::text)::uuid;
    v_now := date_trunc('milliseconds', clock_timestamp() AT TIME ZONE 'UTC');
    v_now_iso := to_char(v_now, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
    v_after_json :=
      '{"email":' || to_json(rec."email")::text ||
      ',"fullName":' || to_json(v_display_name)::text ||
      ',"screenAccess":' || v_new_access_json || '}';
    v_payload := COALESCE(v_prev_hash, 'GENESIS') || '|' ||
      v_id::text || '|' ||
      v_now_iso || '|' ||
      'MIGRATION_CUISINE_RESERVEE_CUISINIER|User|' ||
      rec."id"::text || '|' ||
      v_before_json || '|' ||
      v_after_json || '|';
    v_entry_hash := encode(sha256(convert_to(v_payload, 'UTF8')), 'hex');

    INSERT INTO "audit_log" (
      "id", "action", "entity", "entity_id", "before", "after", "prev_hash", "entry_hash", "created_at"
    )
    VALUES (
      v_id,
      'MIGRATION_CUISINE_RESERVEE_CUISINIER',
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

  -- B. Normaliser les comptes CUISINIER / CUISINE : Cuisine ECRITURE uniquement, aucun autre droit
  UPDATE "users"
  SET
    "role" = 'CUISINIER',
    "starter_profile" = 'CUISINIER',
    "screen_access" = '{"accueil":"AUCUN","chambres":"AUCUN","clients":"AUCUN","cuisine":"ECRITURE","facturation":"AUCUN","planning":"AUCUN","rapports":"AUCUN","restaurant":"AUCUN"}'::jsonb,
    "special_permissions" = '{"annuler_commande_ou_reservation":false,"changer_etat_chambre":false,"encaisser_paiement":false,"voir_montants":false}'::jsonb
  WHERE "role"::text IN ('CUISINIER', 'CUISINE');

  IF v_count = 0 THEN
    v_id := md5(random()::text || clock_timestamp()::text || 'cuisine-only')::uuid;
    v_now := date_trunc('milliseconds', clock_timestamp() AT TIME ZONE 'UTC');
    v_now_iso := to_char(v_now, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
    v_after_json := '{"removedCount":0}';
    v_payload := COALESCE(v_prev_hash, 'GENESIS') || '|' ||
      v_id::text || '|' ||
      v_now_iso || '|' ||
      'MIGRATION_CUISINE_RESERVEE_CUISINIER|System|cuisine|null|' ||
      v_after_json || '|';
    v_entry_hash := encode(sha256(convert_to(v_payload, 'UTF8')), 'hex');

    INSERT INTO "audit_log" (
      "id", "action", "entity", "entity_id", "after", "prev_hash", "entry_hash", "created_at"
    )
    VALUES (
      v_id,
      'MIGRATION_CUISINE_RESERVEE_CUISINIER',
      'System',
      'cuisine',
      v_after_json::jsonb,
      v_prev_hash,
      v_entry_hash,
      v_now
    );
  END IF;

  RAISE NOTICE 'MIGRATION_CUISINE_SUMMARY: count=%, users=%', v_count, v_names;
END $$;
