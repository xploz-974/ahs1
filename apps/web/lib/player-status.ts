// §31 — le statut d'un player n'est pas juste la colonne `players.status`
// (qui ne se met à jour que lorsqu'un heartbeat arrive : si le réseau est
// totalement coupé, plus aucun heartbeat n'arrive et la colonne resterait
// bloquée sur "ONLINE"). On le recalcule à la lecture à partir de la
// fraîcheur de last_seen + du dernier cache_status connu.

export type LiveStatus = "PENDING" | "ONLINE" | "OFFLINE_BUT_PLAYING" | "OFFLINE_CRITICAL" | "ERROR";

export interface LiveStatusInput {
  status: string; // colonne stockée (utile pour PENDING avant toute activation)
  lastSeen: string | null;
  lastCacheStatus: string | null;
}

const ONLINE_THRESHOLD_MIN = 2;
const ERROR_THRESHOLD_MIN = 30;

export function computeLiveStatus({ status, lastSeen, lastCacheStatus }: LiveStatusInput): LiveStatus {
  if (status === "PENDING") return "PENDING";
  if (!lastSeen) return "ERROR";

  const minutesAgo = (Date.now() - new Date(lastSeen).getTime()) / 60_000;

  if (minutesAgo < ONLINE_THRESHOLD_MIN) return "ONLINE";
  if (minutesAgo > ERROR_THRESHOLD_MIN) return "ERROR";
  if (lastCacheStatus === "LOW" || lastCacheStatus === "CRITICAL") return "OFFLINE_CRITICAL";
  return "OFFLINE_BUT_PLAYING";
}

export const STATUS_LABEL: Record<LiveStatus, string> = {
  PENDING: "En attente",
  ONLINE: "En ligne",
  OFFLINE_BUT_PLAYING: "Hors ligne (diffuse depuis le cache)",
  OFFLINE_CRITICAL: "Cache critique",
  ERROR: "Injoignable",
};

export const STATUS_DOT: Record<LiveStatus, string> = {
  PENDING: "⚪",
  ONLINE: "🟢",
  OFFLINE_BUT_PLAYING: "🟠",
  OFFLINE_CRITICAL: "🔴",
  ERROR: "🔴",
};
