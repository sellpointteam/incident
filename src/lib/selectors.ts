/**
 * Shared Supabase column projections.
 *
 * Replaces ad-hoc `.select("*")` calls. Picking the right projection
 * shrinks payloads and limits exposure of columns that may later become
 * sensitive.
 *
 * Convention: keep these as plain string constants (not arrays) so they
 * can be passed straight to `.select(...)`.
 */

/**
 * Lightweight columns for map markers, popups, and feed rows.
 *
 * Includes everything the public surface (IncidentPopup, IntelPanel,
 * LiveIncidentFeed, useIncidents geo-resolver) actually reads. Heavier
 * audit columns (created_by, updated_at, etc.) live in the DETAIL set.
 */
export const INCIDENT_LIST_COLUMNS =
  "id,date,country,province,district,location_name,event_type,summary,soldiers_killed,soldiers_injured,irregulars_killed,irregulars_injured,others_killed,others_injured,latitude,longitude,published,source_url,source_type,confidence,verification_status,created_at,perpetrator_actor_id,target_actor_id,economic_damage";

/** Full record for detail pages and admin editing. */
export const INCIDENT_DETAIL_COLUMNS =
  "id,date,country,province,district,location_name,event_type,summary,soldiers_killed,soldiers_injured,irregulars_killed,irregulars_injured,others_killed,others_injured,latitude,longitude,published,source_url,source_type,verification_status,confidence,created_at,updated_at,created_by,client_request_id,perpetrator_actor_id,target_actor_id,economic_damage";

/** Lightweight columns for the KIA map / list. */
export const KIA_LIST_COLUMNS =
  "id,name,rank,unit,force_type,date_of_death,casualty_province,casualty_district,casualty_tehsil,hometown_province,hometown_district,hometown_tehsil,hometown_latitude,hometown_longitude,media_acknowledged,incident_id,created_at";

/** Full record for KIA detail / editing. */
export const KIA_DETAIL_COLUMNS =
  KIA_LIST_COLUMNS + ",notes,source_url,casualty_country,updated_at,created_by";

/** Channel admin list. */
export const CHANNEL_LIST_COLUMNS =
  "id,platform,handle,display_name,language,reliability_score,enabled,last_external_id,last_polled_at,created_at";

/** Pending review list. */
export const PENDING_REVIEW_LIST_COLUMNS =
  "id,record_type,status,confidence_level,created_at,extracted_data";

/** Blog list (no body). */
export const BLOG_LIST_COLUMNS =
  "id,slug,title,excerpt,cover_image_url,published,published_at,updated_at,category,featured,image_fit,focal_x,focal_y,reading_time_minutes";
