-- AHS1 — Audio Hub Stream v1
-- Migration 0003 : policy d'écriture manquante sur `genres`.
--
-- `genres` est une table globale (pas de organization_id) : n'importe quel
-- utilisateur rattaché à au moins une organisation peut créer un genre.
-- Sans cette policy, la seule policy existante (lecture) bloque tout INSERT
-- fait par find-or-create lors de l'édition/import d'un fichier audio.

create policy "org members can create genres"
on genres for insert
with check (
  exists (select 1 from organization_members m where m.user_id = auth.uid())
);
