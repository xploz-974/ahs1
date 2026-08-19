# AHS1 — Audio Hub Stream v1

Plateforme de diffusion audio pour commerces : musique d'ambiance, jingles, publicités et programmes horaires, avec continuité de diffusion hors connexion.

## Statut

- **Phase 1 — Architecture + Supabase** ✅ terminée. Schéma + RLS appliqués sur le projet Supabase cloud (`ppnhcoikhuzyncwsusjt`), buckets Storage créés, seed de dev en place.
- **Phase 2 — Auth admin + Dashboard skeleton** en cours. Voir `apps/web`.

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

## Nomenclature

Voir `docs/architecture.md` — chaque composant (`AHS1 Cloud`, `AHS1 API`, `AHS1 Core`, `AHS1 Scheduler`, `AHS1 Sync`, `AHS1 Player`, `AHS1 Monitor`, `AHS1 Storage`) est décrit et son rôle précisé.
