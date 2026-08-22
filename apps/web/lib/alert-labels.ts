// Labels partagés entre la page Alertes, le dashboard, et les réglages de
// notifications — une seule source de vérité pour les types d'alerte.
export const ALERT_TYPES = [
  "PLAYER_OFFLINE",
  "CACHE_LOW",
  "STORAGE_LOW",
  "SYNC_FAILED",
  "NO_CONTENT",
  "INVALID_AUDIO",
  "PLAYER_OUTDATED",
  "CONNECTION_FAILURE",
  "DEVICE_MOVED",
  "DEVICE_OUT_OF_ZONE",
] as const;

export type AlertType = (typeof ALERT_TYPES)[number];

export const ALERT_TYPE_LABEL: Record<AlertType, string> = {
  PLAYER_OFFLINE: "Player hors ligne",
  CACHE_LOW: "Cache faible",
  STORAGE_LOW: "Stockage faible",
  SYNC_FAILED: "Échec de synchronisation",
  NO_CONTENT: "Aucun contenu disponible",
  INVALID_AUDIO: "Fichier audio invalide",
  PLAYER_OUTDATED: "Version obsolète",
  CONNECTION_FAILURE: "Échecs de connexion répétés",
  DEVICE_MOVED: "🛡️ Mouvement détecté (anti-vol)",
  DEVICE_OUT_OF_ZONE: "🛡️ Appareil hors zone (anti-vol)",
};
