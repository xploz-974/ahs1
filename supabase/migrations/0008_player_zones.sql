-- Zones multiroom (§ conception "Zones Multiroom") : regroupe plusieurs
-- players d'un même magasin pour qu'ils diffusent la même source en synchro
-- serrée (horloge de référence + WebRTC, géré côté client dans
-- lib/zone-sync.ts). Leader désigné manuellement dans le dashboard pour ce
-- premier jet — pas d'élection automatique (complexité de test/edge cases
-- jugée disproportionnée pour un usage mono-admin actuel).

create table player_zones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,
  leader_player_id uuid references players(id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_player_zones_store on player_zones(store_id);

alter table players add column zone_id uuid references player_zones(id) on delete set null;
create index idx_players_zone on players(zone_id);

create policy player_zones_select on player_zones for select
  using (auth_is_org_member(organization_id) or (auth_is_player() and organization_id = auth_player_org_id()));
create policy player_zones_write on player_zones for all
  using (auth_is_org_member(organization_id)) with check (auth_is_org_member(organization_id));
