-- AHS1 — Audio Hub Stream v1
-- Migration 0002 : RLS sur storage.objects pour les buckets audio.
--
-- Convention de chemin : {organization_id}/{uuid}-{nom_fichier}
-- Le premier segment du chemin doit correspondre à l'organisation de
-- l'utilisateur connecté (storage.foldername renvoie les segments du path).

create policy "org members read own audio objects"
on storage.objects for select
using (
  bucket_id in ('audio-music', 'audio-jingles', 'audio-advertisements', 'audio-temporary')
  and auth_is_org_member((storage.foldername(name))[1]::uuid)
);

create policy "org members upload own audio objects"
on storage.objects for insert
with check (
  bucket_id in ('audio-music', 'audio-jingles', 'audio-advertisements', 'audio-temporary')
  and auth_is_org_member((storage.foldername(name))[1]::uuid)
);

create policy "org members delete own audio objects"
on storage.objects for delete
using (
  bucket_id in ('audio-music', 'audio-jingles', 'audio-advertisements', 'audio-temporary')
  and auth_is_org_member((storage.foldername(name))[1]::uuid)
);
