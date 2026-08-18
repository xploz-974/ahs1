// Types partagés dérivés du schéma Postgres (supabase/migrations/0001_init.sql).
// Source de vérité = le schéma DB ; ce fichier sera remplacé en Phase 3+ par une
// génération automatique (ex. supabase gen types typescript) une fois le schéma stabilisé.

export type PlayerType = "ANDROID" | "RASPBERRY" | "DESKTOP" | "WEB";

export type PlayerStatus =
  | "PENDING"
  | "ONLINE"
  | "OFFLINE_BUT_PLAYING"
  | "OFFLINE_CRITICAL"
  | "SYNCING"
  | "ERROR";

export type AudioCategory = "music" | "jingle" | "advertisement" | "temporary";

export type PlaybackType = "MUSIC" | "ADVERTISEMENT" | "JINGLE";

export type AlertType =
  | "PLAYER_OFFLINE"
  | "CACHE_LOW"
  | "STORAGE_LOW"
  | "SYNC_FAILED"
  | "NO_CONTENT"
  | "INVALID_AUDIO"
  | "PLAYER_OUTDATED"
  | "CONNECTION_FAILURE";

export type AlertSeverity = "INFO" | "WARNING" | "CRITICAL";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface Store {
  id: string;
  organization_id: string;
  name: string;
  region: string | null;
  timezone: string;
  address: string | null;
  created_at: string;
}

export interface Player {
  id: string;
  organization_id: string;
  store_id: string;
  name: string;
  type: PlayerType;
  status: PlayerStatus;
  activation_code: string | null;
  activated_at: string | null;
  app_version: string | null;
  last_seen: string | null;
  configuration: Record<string, unknown>;
  created_at: string;
}

export interface AudioFile {
  id: string;
  organization_id: string;
  title: string;
  artist_id: string | null;
  album_id: string | null;
  genre_id: string | null;
  duration_ms: number;
  format: "mp3" | "wav" | "flac";
  bitrate: number | null;
  sample_rate: number | null;
  file_size: number;
  storage_path: string;
  checksum: string;
  category: AudioCategory;
  created_at: string;
  updated_at: string;
}

export interface SyncManifest {
  music_version: number;
  advertisements_version: number;
  jingles_version: number;
  playlist_version: number;
}

export interface SyncItem {
  id: string;
  audio_file_id: string;
  version: number;
  size: number | null;
  checksum: string | null;
  category: string | null;
}

export interface PlaybackEvent {
  client_event_id: string;
  type: PlaybackType;
  audio_id: string | null;
  campaign_id: string | null;
  played_at: string;
  duration_ms: number | null;
  status: string;
}

export interface Heartbeat {
  player_id: string;
  network: string | null;
  current_track: string | null;
  current_ad: string | null;
  storage_available: number | null;
  cache_status: string | null;
  app_version: string | null;
}

export interface PlayerAlert {
  id: string;
  organization_id: string;
  player_id: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string | null;
  acknowledged_at: string | null;
  created_at: string;
}
