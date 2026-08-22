-- Sécurité anti-déplacement/anti-vol : détection de mouvement locale
-- (accéléromètre, déclenche une alarme sonore immédiate sur l'appareil) et
-- suivi de position (GPS, alerte si l'appareil sort d'un rayon autour de sa
-- position de référence). Les deux sont optionnels par player
-- (security_enabled), désactivés par défaut.

alter table player_alerts drop constraint if exists player_alerts_type_check;
alter table player_alerts add constraint player_alerts_type_check check (type in
  ('PLAYER_OFFLINE','CACHE_LOW','STORAGE_LOW','SYNC_FAILED',
   'NO_CONTENT','INVALID_AUDIO','PLAYER_OUTDATED','CONNECTION_FAILURE',
   'DEVICE_MOVED','DEVICE_OUT_OF_ZONE'));

alter table players add column security_enabled boolean not null default false;
-- Position de référence (déduite automatiquement du premier rapport GPS tant
-- qu'aucune n'est définie ; réinitialisable depuis le dashboard).
alter table players add column home_lat double precision;
alter table players add column home_lng double precision;
alter table players add column geofence_radius_m integer not null default 100;
alter table players add column last_lat double precision;
alter table players add column last_lng double precision;
alter table players add column last_location_at timestamptz;
