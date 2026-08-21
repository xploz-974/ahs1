-- AHS1 — Audio Hub Stream v1
-- Migration 0006 : messagerie support magasin ↔ dashboard.
--
-- L'assistant simple (mots-clés) côté player répond sans toucher la base.
-- Seule l'escalade ("si ça persiste") crée des lignes ici, via
-- POST /api/player/support (JWT player) ou depuis le dashboard (admin).

create table support_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  store_id uuid not null references stores(id) on delete cascade,
  sender text not null check (sender in ('store', 'admin')),
  body text not null,
  created_at timestamptz not null default now()
);
create index idx_support_messages_store on support_messages(store_id, created_at desc);

alter table support_messages enable row level security;

create policy support_messages_select on support_messages for select
  using (auth_is_org_member(organization_id) or (auth_is_player() and store_id = auth_player_store_id()));

create policy support_messages_admin_insert on support_messages for insert
  with check (auth_is_org_member(organization_id));
