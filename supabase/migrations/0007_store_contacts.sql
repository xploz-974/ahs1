-- AHS1 — Audio Hub Stream v1
-- Migration 0007 : contacts nommés par magasin pour la messagerie support,
-- et attribution du nom sur chaque message store.

create table store_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create index idx_store_contacts_store on store_contacts(store_id);

alter table store_contacts enable row level security;

create policy store_contacts_select on store_contacts for select
  using (auth_is_org_member(organization_id) or (auth_is_player() and store_id = auth_player_store_id()));

create policy store_contacts_admin_write on store_contacts for all
  using (auth_is_org_member(organization_id))
  with check (auth_is_org_member(organization_id));

alter table support_messages add column sender_name text;
