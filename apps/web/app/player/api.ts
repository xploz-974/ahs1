"use client";

// Client API Player — reproduit le comportement de PlayerRepository côté
// Android : Bearer token, retry unique après un /refresh sur 401. Tourne
// entièrement côté navigateur (localStorage), cette page n'est pas un compte
// Supabase Auth.

const STORAGE_KEYS = {
  access: "ahs1_access_token",
  refresh: "ahs1_refresh_token",
  playerId: "ahs1_player_id",
  playerName: "ahs1_player_name",
  storeName: "ahs1_store_name",
} as const;

export interface SyncFile {
  id: string;
  title: string;
  category: string;
  format: string;
  checksum: string;
  size: number;
  duration_ms: number;
  trim_start_ms: number;
  trim_end_ms: number | null;
  fade_in_ms: number;
  fade_out_ms: number;
  url: string | null;
}

export interface SyncResponse {
  manifest: {
    music_version: number;
    advertisements_version: number;
    jingles_version: number;
    playlist_version: number;
  } | null;
  files: SyncFile[];
}

export function getStoredSession() {
  if (typeof window === "undefined") return null;
  const access = localStorage.getItem(STORAGE_KEYS.access);
  const refresh = localStorage.getItem(STORAGE_KEYS.refresh);
  if (!access || !refresh) return null;
  return {
    access,
    refresh,
    playerId: localStorage.getItem(STORAGE_KEYS.playerId),
    playerName: localStorage.getItem(STORAGE_KEYS.playerName),
    storeName: localStorage.getItem(STORAGE_KEYS.storeName),
  };
}

export function clearSession() {
  Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
}

export async function enroll(activationCode: string): Promise<{ error: string | null }> {
  const res = await fetch("/api/player/enroll", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ activation_code: activationCode.trim() }),
  });
  const data = await res.json();
  if (!res.ok) {
    const messages: Record<string, string> = {
      invalid_activation_code: "Code d'activation invalide.",
      already_activated: "Ce player est déjà activé.",
      activation_code_expired: "Code expiré — régénère-le depuis le dashboard.",
    };
    return { error: messages[data.error] ?? "Échec de l'activation." };
  }
  localStorage.setItem(STORAGE_KEYS.access, data.access_token);
  localStorage.setItem(STORAGE_KEYS.refresh, data.refresh_token);
  localStorage.setItem(STORAGE_KEYS.playerId, data.player.id);
  localStorage.setItem(STORAGE_KEYS.playerName, data.player.name);
  if (data.player.store) localStorage.setItem(STORAGE_KEYS.storeName, data.player.store);
  return { error: null };
}

async function refreshAccessToken(): Promise<boolean> {
  const refresh = localStorage.getItem(STORAGE_KEYS.refresh);
  if (!refresh) return false;
  const res = await fetch("/api/player/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
  });
  if (!res.ok) {
    if (res.status === 401) clearSession();
    return false;
  }
  const data = await res.json();
  localStorage.setItem(STORAGE_KEYS.access, data.access_token);
  return true;
}

async function authorizedFetch(path: string, init?: RequestInit): Promise<Response | null> {
  const access = localStorage.getItem(STORAGE_KEYS.access);
  if (!access) return null;

  const doFetch = (token: string) =>
    fetch(path, {
      ...init,
      headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
    });

  let res = await doFetch(access);
  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) return res;
    const newAccess = localStorage.getItem(STORAGE_KEYS.access)!;
    res = await doFetch(newAccess);
  }
  return res;
}

export async function fetchPin(): Promise<string> {
  const res = await authorizedFetch("/api/player/config");
  if (!res || !res.ok) return "1990";
  const data = await res.json();
  return data.player?.configuration?.pin ?? "1990";
}

export async function fetchSync(): Promise<SyncResponse | null> {
  const res = await authorizedFetch("/api/player/sync");
  if (!res || !res.ok) return null;
  return res.json();
}

export async function sendHeartbeat(currentTrack: string | null) {
  await authorizedFetch("/api/player/heartbeat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      network: navigator.onLine ? "wifi" : "offline",
      current_track: currentTrack,
      cache_status: "OK",
      app_version: "web-1.0.0",
    }),
  });
}

export interface SupportMessage {
  id: string;
  sender: "store" | "admin";
  body: string;
  created_at: string;
}

export async function fetchSupportMessages(): Promise<SupportMessage[]> {
  const res = await authorizedFetch("/api/player/support");
  if (!res || !res.ok) return [];
  const data = await res.json();
  return data.messages ?? [];
}

export async function sendSupportMessage(body: string): Promise<boolean> {
  const res = await authorizedFetch("/api/player/support", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
  return !!res && res.ok;
}

export async function sendPlaybackEvent(file: SyncFile) {
  await authorizedFetch("/api/player/playback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      events: [
        {
          client_event_id: crypto.randomUUID(),
          type: file.category === "advertisement" ? "ADVERTISEMENT" : file.category === "jingle" ? "JINGLE" : "MUSIC",
          audio_id: file.id,
          played_at: new Date().toISOString(),
          duration_ms: file.duration_ms,
          status: "COMPLETED",
        },
      ],
    }),
  });
}
