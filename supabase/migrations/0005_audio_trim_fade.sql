-- AHS1 — Audio Hub Stream v1
-- Migration 0005 : points de coupe (in/out) et fondus par fichier audio.
--
-- trim_end_ms = null signifie "jusqu'à la fin du fichier".
-- Ces valeurs sont exprimées en millisecondes, relatives au fichier original
-- (pas au fichier coupé), pour rester cohérentes avec duration_ms.

alter table audio_files
  add column trim_start_ms integer not null default 0,
  add column trim_end_ms integer,
  add column fade_in_ms integer not null default 0,
  add column fade_out_ms integer not null default 0;

alter table audio_files
  add constraint audio_files_trim_check check (
    trim_start_ms >= 0
    and (trim_end_ms is null or trim_end_ms > trim_start_ms)
    and fade_in_ms >= 0
    and fade_out_ms >= 0
  );
