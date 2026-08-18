-- AHS1 — Audio Hub Stream v1
-- Migration 0001: schema initial + RLS multi-tenant
-- Voir docs/database.md pour le détail de chaque table.

create extension if not exists "pgcrypto";

-- =========================================================================
-- ORGANISATIONS & UTILISATEURS
-- =========================================================================

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  created_at timestamptz not null default now()
);

create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text unique not null,
  created_at timestamptz not null default now()
);

create table organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('owner','admin','manager','viewer')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index idx_org_members_user on organization_members(user_id);
create index idx_org_members_org on organization_members(organization_id);

-- =========================================================================
-- MAGASINS & PLAYERS
-- =========================================================================

create table stores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  region text,
  timezone text not null default 'Indian/Reunion',
  address text,
  created_at timestamptz not null default now()
);
create index idx_stores_org on stores(organization_id);

create table players (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,
  type text not null check (type in ('ANDROID','RASPBERRY','DESKTOP','WEB')),
  status text not null default 'PENDING' check (status in
    ('PENDING','ONLINE','OFFLINE_BUT_PLAYING','OFFLINE_CRITICAL','SYNCING','ERROR')),
  activation_code text unique,
  activation_code_expires_at timestamptz,
  activated_at timestamptz,
  app_version text,
  last_seen timestamptz,
  configuration jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index idx_players_org on players(organization_id);
create index idx_players_store on players(store_id);
create index idx_players_status on players(status);

create table player_tokens (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_player_tokens_player on player_tokens(player_id);

-- =========================================================================
-- BIBLIOTHÈQUE AUDIO
-- =========================================================================

create table artists (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null
);
create index idx_artists_org on artists(organization_id);

create table albums (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  artist_id uuid references artists(id) on delete set null,
  title text not null
);
create index idx_albums_org on albums(organization_id);

create table genres (
  id uuid primary key default gen_random_uuid(),
  name text unique not null
);

create table audio_files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  artist_id uuid references artists(id) on delete set null,
  album_id uuid references albums(id) on delete set null,
  genre_id uuid references genres(id) on delete set null,
  duration_ms integer not null,
  format text not null check (format in ('mp3','wav','flac')),
  bitrate integer,
  sample_rate integer,
  file_size bigint not null,
  storage_path text not null,
  checksum text not null,
  category text not null check (category in ('music','jingle','advertisement','temporary')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_audio_org_category on audio_files(organization_id, category);

-- =========================================================================
-- PLAYLISTS
-- =========================================================================

create table playlists (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  priority integer not null default 0,
  schedule jsonb not null default '{}',
  version integer not null default 1,
  created_at timestamptz not null default now()
);
create index idx_playlists_org on playlists(organization_id);

create table playlist_items (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references playlists(id) on delete cascade,
  audio_file_id uuid not null references audio_files(id) on delete cascade,
  position integer not null
);
create index idx_playlist_items_playlist on playlist_items(playlist_id);

create table playlist_stores (
  playlist_id uuid not null references playlists(id) on delete cascade,
  store_id uuid not null references stores(id) on delete cascade,
  primary key (playlist_id, store_id)
);
create index idx_playlist_stores_store on playlist_stores(store_id);

-- =========================================================================
-- JINGLES
-- =========================================================================

create table jingles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  audio_file_id uuid not null references audio_files(id) on delete cascade,
  store_id uuid not null references stores(id) on delete cascade,
  frequency_every_n_tracks integer not null default 5,
  priority integer not null default 0,
  start_date date,
  end_date date,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','PAUSED','ARCHIVED')),
  version integer not null default 1,
  created_at timestamptz not null default now()
);
create index idx_jingles_org on jingles(organization_id);
create index idx_jingles_store on jingles(store_id);

-- =========================================================================
-- PUBLICITÉS
-- =========================================================================

create table advertisers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null
);
create index idx_advertisers_org on advertisers(organization_id);

create table advertisement_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  advertiser_id uuid references advertisers(id) on delete set null,
  name text not null,
  start_date date not null,
  end_date date not null,
  start_time time,
  end_time time,
  passes_per_day integer,
  priority integer not null default 0,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','PAUSED','ENDED')),
  version integer not null default 1,
  created_at timestamptz not null default now()
);
create index idx_campaigns_org on advertisement_campaigns(organization_id);

create table advertisement_assets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references advertisement_campaigns(id) on delete cascade,
  audio_file_id uuid not null references audio_files(id) on delete cascade
);
create index idx_ad_assets_campaign on advertisement_assets(campaign_id);

create table campaign_stores (
  campaign_id uuid not null references advertisement_campaigns(id) on delete cascade,
  store_id uuid not null references stores(id) on delete cascade,
  primary key (campaign_id, store_id)
);
create index idx_campaign_stores_store on campaign_stores(store_id);

-- =========================================================================
-- PROGRAMMATION
-- =========================================================================

create table schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,
  is_active boolean not null default true
);
create index idx_schedules_store on schedules(store_id);

create table schedule_items (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references schedules(id) on delete cascade,
  start_time time not null,
  end_time time not null,
  playlist_id uuid references playlists(id) on delete set null,
  days_of_week integer[] not null default '{0,1,2,3,4,5,6}'
);
create index idx_schedule_items_schedule on schedule_items(schedule_id);

-- =========================================================================
-- HISTORIQUE & TÉLÉMÉTRIE
-- =========================================================================

create table playback_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  store_id uuid not null references stores(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  type text not null check (type in ('MUSIC','ADVERTISEMENT','JINGLE')),
  audio_id uuid,
  campaign_id uuid,
  played_at timestamptz not null,
  duration_ms integer,
  status text not null default 'COMPLETED',
  client_event_id uuid not null,
  synced_at timestamptz not null default now(),
  unique (player_id, client_event_id)
);
create index idx_playback_store_time on playback_history(store_id, played_at desc);

create table player_heartbeats (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  network text,
  current_track text,
  current_ad text,
  storage_available bigint,
  cache_status text,
  app_version text,
  received_at timestamptz not null default now()
);
create index idx_heartbeat_player_time on player_heartbeats(player_id, received_at desc);

create table player_alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  type text not null check (type in
    ('PLAYER_OFFLINE','CACHE_LOW','STORAGE_LOW','SYNC_FAILED',
     'NO_CONTENT','INVALID_AUDIO','PLAYER_OUTDATED','CONNECTION_FAILURE')),
  severity text not null default 'WARNING' check (severity in ('INFO','WARNING','CRITICAL')),
  message text,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_alerts_player on player_alerts(player_id, created_at desc);
create index idx_alerts_org on player_alerts(organization_id);

-- =========================================================================
-- SYNCHRONISATION
-- =========================================================================

create table sync_manifests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  store_id uuid not null references stores(id) on delete cascade,
  music_version integer not null default 0,
  advertisements_version integer not null default 0,
  jingles_version integer not null default 0,
  playlist_version integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (store_id)
);

create table sync_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  audio_file_id uuid not null references audio_files(id) on delete cascade,
  version integer not null,
  size bigint,
  checksum text,
  category text
);
create index idx_sync_items_store on sync_items(store_id, version);

-- =========================================================================
-- PARAMÈTRES
-- =========================================================================

create table settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  key text not null,
  value jsonb not null,
  unique (organization_id, key)
);

-- =========================================================================
-- HELPERS RLS
--
-- Deux populations de JWT :
--  - utilisateurs admin (Supabase Auth standard) -> organization_members
--  - players (JWT signé par AHS1 API avec claims custom : scope=player,
--    organization_id, store_id, player_id)
-- =========================================================================

create or replace function auth_is_org_member(target_org uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from organization_members m
    where m.organization_id = target_org
      and m.user_id = auth.uid()
  );
$$;

create or replace function auth_is_player()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'scope', '') = 'player';
$$;

create or replace function auth_player_org_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'organization_id', '')::uuid;
$$;

create or replace function auth_player_store_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'store_id', '')::uuid;
$$;

-- =========================================================================
-- RLS
-- =========================================================================

alter table organizations enable row level security;
alter table users enable row level security;
alter table organization_members enable row level security;
alter table stores enable row level security;
alter table players enable row level security;
alter table player_tokens enable row level security;
alter table artists enable row level security;
alter table albums enable row level security;
alter table genres enable row level security;
alter table audio_files enable row level security;
alter table playlists enable row level security;
alter table playlist_items enable row level security;
alter table playlist_stores enable row level security;
alter table jingles enable row level security;
alter table advertisers enable row level security;
alter table advertisement_campaigns enable row level security;
alter table advertisement_assets enable row level security;
alter table campaign_stores enable row level security;
alter table schedules enable row level security;
alter table schedule_items enable row level security;
alter table playback_history enable row level security;
alter table player_heartbeats enable row level security;
alter table player_alerts enable row level security;
alter table sync_manifests enable row level security;
alter table sync_items enable row level security;
alter table settings enable row level security;

-- organizations : visible par ses membres uniquement
create policy org_select on organizations for select
  using (auth_is_org_member(id));
create policy org_update on organizations for update
  using (auth_is_org_member(id));

-- users : chacun voit son propre profil ; les membres d'une même org se voient entre eux
create policy users_select on users for select
  using (id = auth.uid() or exists (
    select 1 from organization_members m1, organization_members m2
    where m1.user_id = auth.uid() and m2.user_id = users.id
      and m1.organization_id = m2.organization_id
  ));

create policy org_members_select on organization_members for select
  using (auth_is_org_member(organization_id));

-- Toutes les tables scoped organization_id (admin) + option player (scope+org match)
create policy stores_select on stores for select
  using (auth_is_org_member(organization_id) or (auth_is_player() and organization_id = auth_player_org_id()));
create policy stores_write on stores for all
  using (auth_is_org_member(organization_id)) with check (auth_is_org_member(organization_id));

create policy players_select on players for select
  using (auth_is_org_member(organization_id) or (auth_is_player() and id::text = auth.jwt() ->> 'player_id'));
create policy players_write on players for all
  using (auth_is_org_member(organization_id)) with check (auth_is_org_member(organization_id));

create policy player_tokens_admin on player_tokens for all
  using (exists (select 1 from players p where p.id = player_tokens.player_id and auth_is_org_member(p.organization_id)));

create policy artists_rw on artists for all
  using (auth_is_org_member(organization_id)) with check (auth_is_org_member(organization_id));
create policy albums_rw on albums for all
  using (auth_is_org_member(organization_id)) with check (auth_is_org_member(organization_id));
create policy genres_select on genres for select using (true);

create policy audio_files_select on audio_files for select
  using (auth_is_org_member(organization_id) or (auth_is_player() and organization_id = auth_player_org_id()));
create policy audio_files_write on audio_files for all
  using (auth_is_org_member(organization_id)) with check (auth_is_org_member(organization_id));

create policy playlists_select on playlists for select
  using (auth_is_org_member(organization_id) or (auth_is_player() and organization_id = auth_player_org_id()));
create policy playlists_write on playlists for all
  using (auth_is_org_member(organization_id)) with check (auth_is_org_member(organization_id));

create policy playlist_items_select on playlist_items for select
  using (exists (select 1 from playlists pl where pl.id = playlist_items.playlist_id
    and (auth_is_org_member(pl.organization_id) or (auth_is_player() and pl.organization_id = auth_player_org_id()))));
create policy playlist_items_write on playlist_items for all
  using (exists (select 1 from playlists pl where pl.id = playlist_items.playlist_id and auth_is_org_member(pl.organization_id)));

create policy playlist_stores_select on playlist_stores for select
  using (auth_is_player() and store_id = auth_player_store_id()
    or exists (select 1 from stores s where s.id = playlist_stores.store_id and auth_is_org_member(s.organization_id)));
create policy playlist_stores_write on playlist_stores for all
  using (exists (select 1 from stores s where s.id = playlist_stores.store_id and auth_is_org_member(s.organization_id)));

create policy jingles_select on jingles for select
  using (auth_is_org_member(organization_id) or (auth_is_player() and store_id = auth_player_store_id()));
create policy jingles_write on jingles for all
  using (auth_is_org_member(organization_id)) with check (auth_is_org_member(organization_id));

create policy advertisers_rw on advertisers for all
  using (auth_is_org_member(organization_id)) with check (auth_is_org_member(organization_id));

create policy campaigns_select on advertisement_campaigns for select
  using (auth_is_org_member(organization_id) or (auth_is_player() and organization_id = auth_player_org_id()));
create policy campaigns_write on advertisement_campaigns for all
  using (auth_is_org_member(organization_id)) with check (auth_is_org_member(organization_id));

create policy ad_assets_select on advertisement_assets for select
  using (exists (select 1 from advertisement_campaigns c where c.id = advertisement_assets.campaign_id
    and (auth_is_org_member(c.organization_id) or (auth_is_player() and c.organization_id = auth_player_org_id()))));
create policy ad_assets_write on advertisement_assets for all
  using (exists (select 1 from advertisement_campaigns c where c.id = advertisement_assets.campaign_id and auth_is_org_member(c.organization_id)));

create policy campaign_stores_select on campaign_stores for select
  using (auth_is_player() and store_id = auth_player_store_id()
    or exists (select 1 from stores s where s.id = campaign_stores.store_id and auth_is_org_member(s.organization_id)));
create policy campaign_stores_write on campaign_stores for all
  using (exists (select 1 from stores s where s.id = campaign_stores.store_id and auth_is_org_member(s.organization_id)));

create policy schedules_select on schedules for select
  using (auth_is_org_member(organization_id) or (auth_is_player() and store_id = auth_player_store_id()));
create policy schedules_write on schedules for all
  using (auth_is_org_member(organization_id)) with check (auth_is_org_member(organization_id));

create policy schedule_items_select on schedule_items for select
  using (exists (select 1 from schedules sc where sc.id = schedule_items.schedule_id
    and (auth_is_org_member(sc.organization_id) or (auth_is_player() and sc.store_id = auth_player_store_id()))));
create policy schedule_items_write on schedule_items for all
  using (exists (select 1 from schedules sc where sc.id = schedule_items.schedule_id and auth_is_org_member(sc.organization_id)));

-- playback_history : le player n'insère que ses propres événements ; l'admin lit tout
create policy playback_history_select on playback_history for select
  using (auth_is_org_member(organization_id));
create policy playback_history_insert on playback_history for insert
  with check (auth_is_player() and organization_id = auth_player_org_id() and store_id = auth_player_store_id()
    and player_id::text = auth.jwt() ->> 'player_id');

-- heartbeats : le player insère les siens ; l'admin lit ceux de son org
create policy heartbeats_insert on player_heartbeats for insert
  with check (auth_is_player() and player_id::text = auth.jwt() ->> 'player_id');
create policy heartbeats_select on player_heartbeats for select
  using (exists (select 1 from players p where p.id = player_heartbeats.player_id and auth_is_org_member(p.organization_id)));

create policy alerts_select on player_alerts for select
  using (auth_is_org_member(organization_id));
create policy alerts_update on player_alerts for update
  using (auth_is_org_member(organization_id));
create policy alerts_insert on player_alerts for insert
  with check (auth_is_org_member(organization_id) or auth_is_player());

create policy sync_manifests_select on sync_manifests for select
  using (auth_is_org_member(organization_id) or (auth_is_player() and store_id = auth_player_store_id()));
create policy sync_manifests_write on sync_manifests for all
  using (auth_is_org_member(organization_id)) with check (auth_is_org_member(organization_id));

create policy sync_items_select on sync_items for select
  using (auth_is_player() and store_id = auth_player_store_id()
    or exists (select 1 from stores s where s.id = sync_items.store_id and auth_is_org_member(s.organization_id)));
create policy sync_items_write on sync_items for all
  using (exists (select 1 from stores s where s.id = sync_items.store_id and auth_is_org_member(s.organization_id)));

create policy settings_rw on settings for all
  using (auth_is_org_member(organization_id)) with check (auth_is_org_member(organization_id));
