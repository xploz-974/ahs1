-- AHS1 — Audio Hub Stream v1
-- Migration 0004 : déclenche la fonction ingest-audio directement en SQL,
-- en contournant l'UI Database Webhooks (schéma supabase_functions manquant
-- sur ce projet). On appelle net.http_post() nous-mêmes via un trigger.
--
-- Prérequis : désactiver "Enforce JWT Verification" sur la fonction
-- ingest-audio (Edge Functions > ingest-audio > Settings), car ce trigger
-- n'envoie pas de token d'authentification.

create extension if not exists pg_net;

create or replace function public.trigger_ingest_audio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://ppnhcoikhuzyncwsusjt.supabase.co/functions/v1/ingest-audio',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object('record', row_to_json(NEW))
  );
  return NEW;
end;
$$;

drop trigger if exists on_storage_object_insert on storage.objects;

create trigger on_storage_object_insert
after insert on storage.objects
for each row execute function public.trigger_ingest_audio();
