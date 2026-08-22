-- Notifications techniciennes : l'anti-vol (et les autres alertes) ne
-- sonnent plus sur l'appareil du magasin — seulement sur l'interface du
-- technicien (dashboard), en son + notification navigateur, avec un
-- réglage par type d'alerte dans Paramètres.
create table notification_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  alert_type text not null,
  sound_enabled boolean not null default true,
  browser_push_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, alert_type)
);

create policy notification_rules_rw on notification_rules for all
  using (auth_is_org_member(organization_id)) with check (auth_is_org_member(organization_id));

-- Nécessaire pour que le dashboard reçoive les nouvelles alertes en direct
-- (Postgres Changes) plutôt que de devoir revisiter la page Alertes.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'player_alerts'
  ) then
    alter publication supabase_realtime add table player_alerts;
  end if;
end $$;

-- Journal d'activité détaillé : événements bruts côté appareil (visibilité
-- d'écran, changement de volume, play/pause, entrée/sortie mode technicien)
-- pour reconstituer une explication lisible en cas de souci (ex. "volume
-- baissé à 4% au tactile à 16h, jamais remonté depuis").
create table device_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  store_id uuid not null references stores(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  type text not null check (type in
    ('SCREEN_VISIBLE','SCREEN_HIDDEN','VOLUME_CHANGE','PLAY','PAUSE',
     'TECHNICIAN_MODE_ENTER','TECHNICIAN_MODE_EXIT')),
  source text not null default 'touch' check (source in ('touch','remote','system')),
  value numeric,
  occurred_at timestamptz not null default now()
);
create index idx_device_events_player_time on device_events(player_id, occurred_at desc);

create policy device_events_admin on device_events for all
  using (auth_is_org_member(organization_id)) with check (auth_is_org_member(organization_id));
