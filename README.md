# AHS1 — Audio Hub Stream v1

Plateforme de diffusion audio pour commerces : musique d'ambiance, jingles, publicités et programmes horaires, avec continuité de diffusion hors connexion.

## Statut

**Phase 1 — Architecture + Supabase** en cours. Voir [docs/architecture.md](docs/architecture.md) pour la vue d'ensemble validée et [docs/database.md](docs/database.md) pour le schéma.

Plan de développement complet (17 phases) : voir `docs/architecture.md#plan-de-développement`.

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

## Démarrer en local

Prérequis : Node 20+, pnpm 9+, [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
pnpm install
supabase start
supabase db reset   # applique les migrations + seed
```

Studio local : http://localhost:54323

## Nomenclature

Voir `docs/architecture.md` — chaque composant (`AHS1 Cloud`, `AHS1 API`, `AHS1 Core`, `AHS1 Scheduler`, `AHS1 Sync`, `AHS1 Player`, `AHS1 Monitor`, `AHS1 Storage`) est décrit et son rôle précisé.
