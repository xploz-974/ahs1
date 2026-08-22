// Journal d'activité "lisible" : transforme les événements bruts
// (playback_history + device_events) en phrases françaises, et propose une
// explication simple quand la diffusion semble arrêtée sans raison évidente.
// Heuristique par règles (pas d'IA) — un diagnostic proposé, pas une preuve :
// à vérifier sur site en cas de doute.

export type DeviceEventType =
  | "SCREEN_VISIBLE"
  | "SCREEN_HIDDEN"
  | "VOLUME_CHANGE"
  | "PLAY"
  | "PAUSE"
  | "TECHNICIAN_MODE_ENTER"
  | "TECHNICIAN_MODE_EXIT";

export type EventSource = "touch" | "remote" | "system";

export interface TimelineEntry {
  id: string;
  at: string; // ISO
  kind: "playback" | "device";
  playbackType?: "MUSIC" | "ADVERTISEMENT" | "JINGLE";
  deviceType?: DeviceEventType;
  source?: EventSource;
  value?: number | null;
}

const LOW_VOLUME_THRESHOLD = 0.05;
const SILENCE_GAP_MS = 20 * 60_000; // en dessous, rien d'anormal à signaler

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function sourceLabel(source: EventSource | undefined): string {
  if (source === "remote") return "à distance";
  if (source === "system") return "automatique";
  return "tactile";
}

function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest}`;
}

const PLAYBACK_LABEL: Record<string, string> = { MUSIC: "Musique", ADVERTISEMENT: "Publicité", JINGLE: "Jingle" };

export function describeEntry(entry: TimelineEntry): string {
  const time = formatTime(entry.at);
  if (entry.kind === "playback") {
    return `${time} — Diffusion : ${PLAYBACK_LABEL[entry.playbackType ?? ""] ?? entry.playbackType}`;
  }
  switch (entry.deviceType) {
    case "VOLUME_CHANGE":
      return `${time} — Volume réglé à ${Math.round((entry.value ?? 0) * 100)}% (${sourceLabel(entry.source)})`;
    case "PLAY":
      return `${time} — Reprise de la lecture (${sourceLabel(entry.source)})`;
    case "PAUSE":
      return `${time} — Mise en pause (${sourceLabel(entry.source)})`;
    case "SCREEN_VISIBLE":
      return `${time} — Écran/onglet redevenu actif`;
    case "SCREEN_HIDDEN":
      return `${time} — Écran/onglet passé en arrière-plan`;
    case "TECHNICIAN_MODE_ENTER":
      return `${time} — Entrée en mode technicien`;
    case "TECHNICIAN_MODE_EXIT":
      return `${time} — Sortie du mode technicien`;
    default:
      return `${time} — Événement inconnu`;
  }
}

// Retourne une phrase d'explication si la diffusion semble arrêtée sans
// cause déjà visible ailleurs (alertes), ou null si rien d'anormal.
export function diagnose(entries: TimelineEntry[], now: Date = new Date()): string | null {
  const sorted = [...entries].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  if (sorted.length === 0) return null;

  const lastPlayback = sorted.find((e) => e.kind === "playback");
  const silenceMs = lastPlayback ? now.getTime() - new Date(lastPlayback.at).getTime() : Infinity;
  if (silenceMs < SILENCE_GAP_MS) return null;

  const lastVolume = sorted.find((e) => e.deviceType === "VOLUME_CHANGE");
  if (lastVolume && (lastVolume.value ?? 1) < LOW_VOLUME_THRESHOLD) {
    return `Silence depuis ${formatDuration(silenceMs)} : le volume a été réglé à ${Math.round(
      (lastVolume.value ?? 0) * 100
    )}% (${sourceLabel(lastVolume.source)}) à ${formatTime(lastVolume.at)}.`;
  }

  const lastPause = sorted.find((e) => e.deviceType === "PAUSE");
  const lastPlay = sorted.find((e) => e.deviceType === "PLAY");
  if (lastPause && (!lastPlay || new Date(lastPlay.at).getTime() < new Date(lastPause.at).getTime())) {
    return `Silence depuis ${formatDuration(silenceMs)} : mise en pause (${sourceLabel(lastPause.source)}) à ${formatTime(
      lastPause.at
    )}, jamais reprise depuis.`;
  }

  return `Aucune diffusion depuis ${formatDuration(
    silenceMs
  )}, sans cause identifiée dans le journal — vérifier la connexion réseau ou le contenu programmé.`;
}
