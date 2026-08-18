# Schéma de base de données AHS1

Source de vérité : [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql). Ce document en résume la structure et le modèle de sécurité.

## Groupes de tables

| Groupe | Tables |
|---|---|
| Organisations & utilisateurs | `organizations`, `users`, `organization_members` |
| Magasins & players | `stores`, `players`, `player_tokens` |
| Bibliothèque audio | `artists`, `albums`, `genres`, `audio_files` |
| Playlists | `playlists`, `playlist_items`, `playlist_stores` |
| Jingles | `jingles` |
| Publicités | `advertisers`, `advertisement_campaigns`, `advertisement_assets`, `campaign_stores` |
| Programmation | `schedules`, `schedule_items` |
| Historique & télémétrie | `playback_history`, `player_heartbeats`, `player_alerts` |
| Synchronisation | `sync_manifests`, `sync_items` |
| Paramètres | `settings` |

Toutes les clés primaires sont des `uuid` (`gen_random_uuid()`). Toutes les tables métier portent (directement ou via jointure) un `organization_id`.

## Idempotence de l'historique

`playback_history` porte une contrainte `unique (player_id, client_event_id)` : le player génère un UUID côté client pour chaque événement de lecture, ce qui permet un envoi en lot après une coupure réseau sans créer de doublons, même en cas de double envoi.

## Modèle de sécurité (RLS)

Deux populations de JWT accèdent à la base :

1. **Utilisateurs admin** — Supabase Auth standard. Rattachés à une ou plusieurs organisations via `organization_members`. Fonction `auth_is_org_member(org_id)`.
2. **Players** — JWT signé par AHS1 API (pas Supabase Auth) avec des claims custom : `scope=player`, `organization_id`, `store_id`, `player_id`. Fonctions `auth_is_player()`, `auth_player_org_id()`, `auth_player_store_id()`.

Règles générales appliquées par table :

- Lecture des données de bibliothèque/programmation : admin de l'org **ou** player scopé à cette organisation/ce magasin.
- Écriture (create/update/delete) : réservée aux admins de l'organisation — un player ne modifie jamais le contenu, seulement son propre historique et ses heartbeats.
- `playback_history` : insertion réservée au player propriétaire de l'événement (`player_id` doit correspondre au claim JWT) ; lecture réservée aux admins.
- `player_heartbeats` : même principe — un player ne peut insérer que ses propres heartbeats.

Une organisation ne peut jamais accéder aux données d'une autre : toute policy passe par `organization_id`, jamais par un identifiant global.

## Formats & contraintes métier

- `audio_files.format` : `mp3 | wav | flac`.
- `audio_files.category` : `music | jingle | advertisement | temporary` — détermine le sous-dossier de stockage.
- `players.type` : `ANDROID | RASPBERRY | DESKTOP | WEB` (seul `ANDROID` est utilisé en v1, l'architecture supporte déjà les autres).
- `players.status` : `PENDING | ONLINE | OFFLINE_BUT_PLAYING | OFFLINE_CRITICAL | SYNCING | ERROR`.
- `player_alerts.type` : `PLAYER_OFFLINE | CACHE_LOW | STORAGE_LOW | SYNC_FAILED | NO_CONTENT | INVALID_AUDIO | PLAYER_OUTDATED | CONNECTION_FAILURE`.

## Stockage (Supabase Storage)

Buckets définis dans `supabase/config.toml` : `audio-music`, `audio-jingles`, `audio-advertisements`, `audio-temporary`. Tous privés — les fichiers sont servis via URLs signées générées par AHS1 API.
