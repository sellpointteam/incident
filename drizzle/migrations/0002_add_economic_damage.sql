ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS economic_damage jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.publish_incident_bundle(
  _incident jsonb,
  _kia jsonb DEFAULT '[]'::jsonb,
  _irregulars jsonb DEFAULT '[]'::jsonb,
  _militants jsonb DEFAULT '[]'::jsonb,
  _client_request_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _incident_id uuid;
  _existing_id uuid;
  _kia_ids uuid[] := ARRAY[]::uuid[];
  _mil_ids uuid[] := ARRAY[]::uuid[];
  _new_id uuid;
  _rec jsonb;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;
  IF NOT public.has_role(_uid, 'admin') THEN
    RAISE EXCEPTION 'Forbidden: admin role required' USING ERRCODE = '42501';
  END IF;

  IF _client_request_id IS NOT NULL THEN
    SELECT id INTO _existing_id FROM public.incidents WHERE client_request_id = _client_request_id;
    IF _existing_id IS NOT NULL THEN
      SELECT COALESCE(array_agg(id ORDER BY created_at), ARRAY[]::uuid[]) INTO _kia_ids
        FROM public.kia_soldiers WHERE incident_id = _existing_id;
      SELECT COALESCE(array_agg(id ORDER BY created_at), ARRAY[]::uuid[]) INTO _mil_ids
        FROM public.militant_casualties WHERE incident_id = _existing_id;
      RETURN jsonb_build_object(
        'incident_id', _existing_id,
        'kia_ids', to_jsonb(_kia_ids),
        'militant_ids', to_jsonb(_mil_ids),
        'idempotent_hit', true
      );
    END IF;
  END IF;

  INSERT INTO public.incidents (
    date, country, province, district, location_name,
    event_type, soldiers_killed, soldiers_injured,
    irregulars_killed, irregulars_injured,
    others_killed, others_injured,
    summary, source_type, source_url,
    confidence, verification_status, published,
    perpetrator_actor_id, target_actor_id,
    economic_damage,
    created_by, client_request_id
  )
  VALUES (
    (_incident->>'date')::date,
    COALESCE(_incident->>'country', 'Pakistan'),
    _incident->>'province',
    NULLIF(_incident->>'district',''),
    NULLIF(_incident->>'location_name',''),
    COALESCE((_incident->>'event_type')::event_type, 'other'::event_type),
    COALESCE((_incident->>'soldiers_killed')::int, 0),
    COALESCE((_incident->>'soldiers_injured')::int, 0),
    COALESCE((_incident->>'irregulars_killed')::int, 0),
    COALESCE((_incident->>'irregulars_injured')::int, 0),
    COALESCE((_incident->>'others_killed')::int, 0),
    COALESCE((_incident->>'others_injured')::int, 0),
    COALESCE(_incident->>'summary',''),
    COALESCE((_incident->>'source_type')::source_type, 'news_article'::source_type),
    NULLIF(_incident->>'source_url',''),
    COALESCE((_incident->>'confidence')::confidence_level, 'medium'::confidence_level),
    COALESCE((_incident->>'verification_status')::verification_status, 'verified'::verification_status),
    COALESCE((_incident->>'published')::boolean, true),
    NULLIF(_incident->>'perpetrator_actor_id','')::uuid,
    NULLIF(_incident->>'target_actor_id','')::uuid,
    COALESCE(_incident->'economic_damage', '{}'::jsonb),
    _uid,
    _client_request_id
  )
  RETURNING id INTO _incident_id;

  FOR _rec IN SELECT * FROM jsonb_array_elements(COALESCE(_kia, '[]'::jsonb)) LOOP
    INSERT INTO public.kia_soldiers (
      incident_id, name, rank, unit, force_type, date_of_death,
      casualty_country, casualty_province, casualty_district, casualty_tehsil,
      hometown_province, hometown_district, hometown_tehsil,
      media_acknowledged, source_url, notes, created_by
    ) VALUES (
      _incident_id,
      COALESCE(NULLIF(TRIM(_rec->>'name'),''), 'Unknown'),
      NULLIF(_rec->>'rank',''), NULLIF(_rec->>'unit',''),
      COALESCE(NULLIF(_rec->>'force_type',''), 'Army'),
      COALESCE((_rec->>'date_of_death')::date, (_incident->>'date')::date),
      COALESCE(NULLIF(_rec->>'casualty_country',''), 'Pakistan'),
      COALESCE(NULLIF(_rec->>'casualty_province',''), _incident->>'province'),
      NULLIF(_rec->>'casualty_district',''), NULLIF(_rec->>'casualty_tehsil',''),
      NULLIF(_rec->>'hometown_province',''), NULLIF(_rec->>'hometown_district',''), NULLIF(_rec->>'hometown_tehsil',''),
      COALESCE((_rec->>'media_acknowledged')::boolean, true),
      NULLIF(_rec->>'source_url',''), NULLIF(_rec->>'notes',''), _uid
    ) RETURNING id INTO _new_id;
    _kia_ids := _kia_ids || _new_id;
  END LOOP;

  FOR _rec IN SELECT * FROM jsonb_array_elements(COALESCE(_irregulars, '[]'::jsonb)) LOOP
    INSERT INTO public.kia_soldiers (
      incident_id, name, rank, unit, force_type, date_of_death,
      casualty_country, casualty_province, casualty_district, casualty_tehsil,
      hometown_province, hometown_district, hometown_tehsil,
      media_acknowledged, source_url, notes, created_by
    ) VALUES (
      _incident_id,
      COALESCE(NULLIF(TRIM(_rec->>'name'),''), 'Unknown'),
      NULLIF(_rec->>'rank',''), NULLIF(_rec->>'unit',''),
      COALESCE(NULLIF(_rec->>'force_type',''), 'Pro-State Militia'),
      COALESCE((_rec->>'date_of_death')::date, (_incident->>'date')::date),
      COALESCE(NULLIF(_rec->>'casualty_country',''), 'Pakistan'),
      COALESCE(NULLIF(_rec->>'casualty_province',''), _incident->>'province'),
      NULLIF(_rec->>'casualty_district',''), NULLIF(_rec->>'casualty_tehsil',''),
      NULLIF(_rec->>'hometown_province',''), NULLIF(_rec->>'hometown_district',''), NULLIF(_rec->>'hometown_tehsil',''),
      COALESCE((_rec->>'media_acknowledged')::boolean, true),
      NULLIF(_rec->>'source_url',''), NULLIF(_rec->>'notes',''), _uid
    ) RETURNING id INTO _new_id;
    _kia_ids := _kia_ids || _new_id;
  END LOOP;

  FOR _rec IN SELECT * FROM jsonb_array_elements(COALESCE(_militants, '[]'::jsonb)) LOOP
    INSERT INTO public.militant_casualties (
      incident_id, name, alias, affiliation, rank_role, date_of_death,
      province, district, location_name,
      hometown_province, hometown_district, hometown_tehsil,
      source_url, notes, confirmed, created_by
    ) VALUES (
      _incident_id,
      NULLIF(TRIM(_rec->>'name'),''), NULLIF(_rec->>'alias',''),
      NULLIF(_rec->>'affiliation',''), NULLIF(_rec->>'rank_role',''),
      NULLIF(_rec->>'date_of_death','')::date,
      NULLIF(_rec->>'province',''), NULLIF(_rec->>'district',''), NULLIF(_rec->>'location_name',''),
      NULLIF(_rec->>'hometown_province',''), NULLIF(_rec->>'hometown_district',''), NULLIF(_rec->>'hometown_tehsil',''),
      NULLIF(_rec->>'source_url',''), NULLIF(_rec->>'notes',''),
      COALESCE((_rec->>'confirmed')::boolean, true), _uid
    ) RETURNING id INTO _new_id;
    _mil_ids := _mil_ids || _new_id;
  END LOOP;

  RETURN jsonb_build_object(
    'incident_id', _incident_id,
    'kia_ids', to_jsonb(_kia_ids),
    'militant_ids', to_jsonb(_mil_ids),
    'idempotent_hit', false
  );
END;
$function$;