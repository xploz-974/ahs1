// AHS1 Core — Scheduler / AutoDJ
//
// Logique pure : reçoit des données déjà résolues (piste actives d'une
// playlist, jingles actifs, publicités actives, règles AutoDJ) et produit la
// séquence de diffusion sur une fenêtre de temps donnée. Ne fait aucun accès
// réseau/DB — c'est à l'appelant (AHS1 Cloud aujourd'hui, AHS1 Scheduler
// serveur plus tard) de fournir ces données déjà filtrées par store/date.

export interface ScheduleTrack {
  id: string;
  title: string;
  artistName: string | null;
  durationMs: number;
}

export interface ScheduleJingle {
  id: string;
  title: string;
  durationMs: number;
  frequencyEveryNTracks: number;
}

export interface ScheduleAd {
  id: string;
  campaignName: string;
  title: string;
  durationMs: number;
}

export interface AutoDjRules {
  adEveryNMinutes: number;
  maxConsecutiveAds: number;
}

export const DEFAULT_AUTODJ_RULES: AutoDjRules = {
  adEveryNMinutes: 15,
  maxConsecutiveAds: 2,
};

export interface ResolvedSlot {
  type: "MUSIC" | "JINGLE" | "ADVERTISEMENT";
  id: string;
  title: string;
  subtitle?: string;
  durationMs: number;
}

const MAX_SLOTS = 500; // garde-fou anti boucle infinie (ex. durationMs=0)

export function resolvePlayback(params: {
  tracks: ScheduleTrack[];
  jingles: ScheduleJingle[];
  ads: ScheduleAd[];
  rules: AutoDjRules;
  windowMs: number;
}): ResolvedSlot[] {
  const { tracks, jingles, ads, rules, windowMs } = params;
  const result: ResolvedSlot[] = [];
  if (tracks.length === 0) return result;

  const adIntervalMs = Math.max(1, rules.adEveryNMinutes) * 60_000;

  let elapsedMs = 0;
  let trackCount = 0;
  let msSinceLastAd = 0;
  let adIndex = 0;
  let trackIndex = 0;

  while (elapsedMs < windowMs && result.length < MAX_SLOTS) {
    const track = tracks[trackIndex % tracks.length];
    result.push({
      type: "MUSIC",
      id: track.id,
      title: track.title,
      subtitle: track.artistName ?? undefined,
      durationMs: track.durationMs,
    });
    elapsedMs += Math.max(track.durationMs, 1000);
    msSinceLastAd += Math.max(track.durationMs, 1000);
    trackCount++;
    trackIndex++;

    for (const jingle of jingles) {
      if (jingle.frequencyEveryNTracks > 0 && trackCount % jingle.frequencyEveryNTracks === 0) {
        result.push({ type: "JINGLE", id: jingle.id, title: jingle.title, durationMs: jingle.durationMs });
        elapsedMs += jingle.durationMs;
      }
    }

    if (ads.length > 0 && msSinceLastAd >= adIntervalMs) {
      const burstsDue = Math.floor(msSinceLastAd / adIntervalMs);
      const adsToInsert = Math.min(burstsDue, rules.maxConsecutiveAds);
      for (let i = 0; i < adsToInsert; i++) {
        const ad = ads[adIndex % ads.length];
        result.push({
          type: "ADVERTISEMENT",
          id: ad.id,
          title: ad.title,
          subtitle: ad.campaignName,
          durationMs: ad.durationMs,
        });
        elapsedMs += ad.durationMs;
        adIndex++;
      }
      msSinceLastAd = 0;
    }
  }

  return result;
}

// §19 — jour de semaine (0 = dimanche, comme days_of_week en DB) + heure
// courante dans la plage [start_time, end_time) d'un schedule_item.
export function isScheduleItemActiveAt(
  item: { start_time: string; end_time: string; days_of_week: number[] },
  at: Date
): boolean {
  const day = at.getDay();
  if (!item.days_of_week.includes(day)) return false;

  const hhmm = at.toTimeString().slice(0, 8);
  if (item.start_time <= item.end_time) {
    return hhmm >= item.start_time && hhmm < item.end_time;
  }
  // plage traversant minuit (ex. 22:00 → 02:00)
  return hhmm >= item.start_time || hhmm < item.end_time;
}
