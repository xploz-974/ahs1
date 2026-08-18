# Architecture AHS1

Principe fondateur : **le Cloud décide, le Player exécute, le Cache assure la continuité.** La perte du réseau ne doit jamais provoquer la perte de la diffusion.

## Composants

| Composant | Rôle | Stack |
|---|---|---|
| **AHS1 Cloud** | Dashboard admin (orgs, magasins, players, médias, campagnes) | Next.js + React + TypeScript + Tailwind |
| **AHS1 API** | Point d'entrée unique, REST, stateless | Route Handlers Next.js ou service Node/TS dédié |
| **AHS1 Core** | Logique métier pure (`packages/core`) | TypeScript |
| **AHS1 Scheduler** | Résout la programmation (playlist + pub + jingle), génère les manifests | TypeScript, cron/Edge Function |
| **AHS1 Sync** | Manifest de version + calcul des deltas | Endpoints API dédiés |
| **AHS1 Player** | App de diffusion (v1 = Android) | Kotlin, Jetpack Compose, Media3/ExoPlayer, Room |
| **AHS1 Monitor** | Ingestion heartbeats, statut, alertes | Edge Function + job périodique |
| **AHS1 Storage** | Fichiers audio (masters + versions optimisées) | Supabase Storage |

Règle d'architecture : le dashboard et les players ne parlent **qu'à AHS1 API** (à l'exception des URLs signées de Storage et de l'échange de token via Supabase Auth). Cela permet d'ajouter un player Raspberry plus tard sans toucher au backend.

```
Client (Web / Android)
        │
        ▼
   AHS1 API  ──────────► Supabase Auth (JWT)
        │
        ▼
   AHS1 Core  ◄──────────► AHS1 Scheduler
        │
        ▼
     Supabase (Postgres + RLS + Storage)
```

## Scheduler / AutoDJ

Double niveau volontaire :

- **Cloud** : résout "ce qui *devrait* jouer" sur un horizon de plusieurs jours, matérialisé dans `schedule_items` et référencé par le manifest (`playlist_version`). Règles configurables par organisation (table `settings`) : non-répétition piste/artiste, fréquence jingle/pub, maximum de pubs consécutives.
- **Player (fallback local)** : exécute uniquement la file déjà résolue par le Cloud. Aucune nouvelle décision métier n'est recalculée hors-ligne — seulement l'ordre d'exécution du déjà-résolu.

## Synchronisation

Le player compare uniquement des numéros de version (`music`, `advertisements`, `jingles`, `playlist`) exposés par `GET /player/manifest`, puis télécharge le delta via `GET /player/sync`. Cycle de téléchargement strict :

```
Download → fichier temporaire → validation taille → validation checksum
→ activation (rename atomique) → suppression ancienne version
```

Un téléchargement interrompu ne remplace jamais un fichier actif — l'ancienne version reste servie.

## Monitoring

Le statut d'un player n'est jamais binaire :

```
last_seen < 2 min                      → ONLINE
dernier heartbeat cache_status=OK      → OFFLINE_BUT_PLAYING
dernier heartbeat cache_status=LOW     → OFFLINE_CRITICAL
last_seen > seuil configurable          → ERROR
```

## Plan de développement

| Phase | Contenu |
|---|---|
| 1 | Monorepo + Supabase (schéma, RLS) — **en cours** |
| 2 | Auth admin + Dashboard skeleton |
| 3 | Bibliothèque audio (upload, métadonnées, checksum) |
| 4 | Playlists |
| 5 | Publicités (campagnes) |
| 6 | Jingles |
| 7 | Scheduler (résolution playlist/pub/jingle) |
| 8 | API Player (enroll, manifest, sync, heartbeat, playback) |
| 9 | App Android — activation + lecture basique en ligne |
| 10 | Cache local (Room + fichiers) |
| 11 | Mode offline |
| 12 | Synchronisation delta |
| 13 | Historique (upload différé, idempotent) |
| 14 | Heartbeat |
| 15 | Monitoring (statuts) |
| 16 | Alertes |
| 17 | Tests / robustesse |

## Risques techniques identifiés

- **Foreground Service tué par Android** (MIUI/Xiaomi agressif) → notification persistante + demande d'exemption de mise en veille batterie, testé explicitement sur le device cible.
- **Corruption du cache** → cycle temp→checksum→activate strict, jamais d'écrasement direct.
- **Dérive historique offline/serveur** → `client_event_id` idempotent par player.
- **RLS mal configurée** (fuite multi-tenant) → tests systématiques par table dès cette phase.
- **Scheduler incohérent Cloud/fallback local** → le fallback n'exécute jamais de nouvelle décision métier.
- **Dépendance à un seul device de test** → prévoir un second Android "stock" avant la Phase 17.
