# AHS1 — Audio Hub Stream v1

Plateforme de diffusion audio pour commerces : musique d'ambiance, jingles, publicités et programmes horaires, avec continuité de diffusion hors connexion.

## Statut

- **Phases 1-8** ✅ terminées : schéma + RLS, dashboard (auth, bibliothèque audio avec édition waveform, playlists, jingles, publicités, scheduler/AutoDJ, players), API Player (`enroll`/`refresh`/`config`/`manifest`/`sync`/`heartbeat`/`playback`), testé de bout en bout via curl.
- **Phase 9 — Application Android** en cours. Voir `apps/android` et [docs/android-player.md](docs/android-player.md).

Déployé sur Netlify depuis [github.com/xploz-974/ahs1](https://github.com/xploz-974/ahs1) (branche `main`), URL de prod : `playeur.xploz.re`.

Voir [docs/architecture.md](docs/architecture.md) pour la vue d'ensemble validée et [docs/database.md](docs/database.md) pour le schéma. Plan de développement complet (17 phases) : `docs/architecture.md#plan-de-développement`.

## Structure du monorepo

```
apps/
  web/        AHS1 Cloud — dashboard admin (Next.js)
  android/    AHS1 Player — application de diffusion (Kotlin)

packages/
  types/       Types partagés (dérivés du schéma DB)
  api-client/   Client TypeScript typé pour AHS1 API
  core/         Logique métier pure (Scheduler, règles AutoDJ)
  shared/       Utilitaires communs

services/
  scheduler/   AHS1 Scheduler
  sync/        AHS1 Sync
  monitor/     AHS1 Monitor

supabase/
  migrations/  Schéma PostgreSQL + RLS
  functions/   Edge Functions (enroll, heartbeat, sync…)
  seed/        Données de développement
```

## Base de données

Ce projet n'utilise pas de Supabase local — tout tourne sur le projet cloud (`https://ppnhcoikhuzyncwsusjt.supabase.co`). Les migrations dans `supabase/migrations/` et le seed dans `supabase/seed/` sont appliqués manuellement via le **SQL Editor** du dashboard Supabase (copier/coller + Run).

## Dashboard web (`apps/web`)

Prérequis : Node 20+, pnpm 9+ (à installer sur la machine qui build/lance le dashboard).

```bash
cd apps/web
cp .env.example .env.local   # remplir NEXT_PUBLIC_SUPABASE_ANON_KEY
pnpm install
pnpm dev
```

Un compte doit exister dans **Authentication** sur le dashboard Supabase, et être lié à une organisation via `organization_members` (voir `supabase/seed/seed.sql`) pour voir des données.

## Déploiement Netlify

Config dans `netlify.toml` à la racine (build via Turborepo, publish `apps/web/.next`, plugin `@netlify/plugin-nextjs` pour le middleware et les server actions). Variables d'environnement requises sur le site Netlify :
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_JWT_SECRET`, `SUPABASE_SECRET_KEY` (API Player, Phase 8+)
- `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` (optionnel, enrichissement métadonnées)

⚠️ Si un déploiement ne se met pas à jour après un push : vérifier que le site n'est pas **verrouillé sur un ancien build** (Deploys → le déploiement affiché → bouton "Unlock to start auto publishing").

## Application Android (`apps/android`)

Voir [docs/android-player.md](docs/android-player.md) pour ouvrir le projet dans Android Studio et l'installer sur un appareil de test.

## Nomenclature

Voir `docs/architecture.md` — chaque composant (`AHS1 Cloud`, `AHS1 API`, `AHS1 Core`, `AHS1 Scheduler`, `AHS1 Sync`, `AHS1 Player`, `AHS1 Monitor`, `AHS1 Storage`) est décrit et son rôle précisé.
