import { describe, expect, it } from "vitest";
import { DEFAULT_AUTODJ_RULES, isScheduleItemActiveAt, resolvePlayback } from "./scheduler";
import type { ScheduleAd, ScheduleJingle, ScheduleTrack } from "./scheduler";

const track = (id: string, durationMs = 180_000): ScheduleTrack => ({
  id,
  title: `Track ${id}`,
  artistName: "Artiste",
  durationMs,
});

const jingle = (id: string, everyN: number, durationMs = 10_000): ScheduleJingle => ({
  id,
  title: `Jingle ${id}`,
  durationMs,
  frequencyEveryNTracks: everyN,
});

const ad = (id: string, durationMs = 20_000): ScheduleAd => ({
  id,
  campaignName: "Campagne",
  title: `Pub ${id}`,
  durationMs,
});

describe("resolvePlayback", () => {
  it("renvoie une liste vide sans pistes", () => {
    const result = resolvePlayback({
      tracks: [],
      jingles: [],
      ads: [],
      rules: DEFAULT_AUTODJ_RULES,
      windowMs: 60_000,
    });
    expect(result).toEqual([]);
  });

  it("boucle sur les pistes jusqu'à couvrir la fenêtre demandée", () => {
    const tracks = [track("a", 60_000), track("b", 60_000)];
    const result = resolvePlayback({ tracks, jingles: [], ads: [], rules: DEFAULT_AUTODJ_RULES, windowMs: 150_000 });
    const musicSlots = result.filter((s) => s.type === "MUSIC");
    expect(musicSlots.map((s) => s.id)).toEqual(["a", "b", "a"]);
  });

  it("insère un jingle tous les N morceaux", () => {
    const tracks = [track("a", 60_000)];
    const jingles = [jingle("j1", 2)];
    const result = resolvePlayback({ tracks, jingles, ads: [], rules: DEFAULT_AUTODJ_RULES, windowMs: 250_000 });
    const jingleSlots = result.filter((s) => s.type === "JINGLE");
    // 4 pistes de 60s dans 250s de fenêtre -> jingle après la 2e et la 4e piste
    expect(jingleSlots).toHaveLength(2);
    expect(jingleSlots.every((s) => s.id === "j1")).toBe(true);
  });

  it("insère une publicité une fois l'intervalle écoulé, plafonnée à maxConsecutiveAds", () => {
    const tracks = [track("a", 60_000)];
    const ads = [ad("ad1"), ad("ad2")];
    // Intervalle de 1 minute, fenêtre de 3 pistes (180s) -> largement au-delà de 3 intervalles.
    const rules = { adEveryNMinutes: 1, maxConsecutiveAds: 2 };
    const result = resolvePlayback({ tracks, jingles: [], ads, rules, windowMs: 180_000 });
    const adSlots = result.filter((s) => s.type === "ADVERTISEMENT");
    expect(adSlots.length).toBeGreaterThan(0);
    // Jamais plus de maxConsecutiveAds pubs d'affilée dans le résultat brut
    let consecutive = 0;
    let maxConsecutive = 0;
    for (const slot of result) {
      consecutive = slot.type === "ADVERTISEMENT" ? consecutive + 1 : 0;
      maxConsecutive = Math.max(maxConsecutive, consecutive);
    }
    expect(maxConsecutive).toBeLessThanOrEqual(rules.maxConsecutiveAds);
  });

  it("ne dépasse jamais MAX_SLOTS même avec des durées nulles", () => {
    const tracks = [track("a", 0)];
    const result = resolvePlayback({ tracks, jingles: [], ads: [], rules: DEFAULT_AUTODJ_RULES, windowMs: 1_000_000_000 });
    expect(result.length).toBeLessThanOrEqual(500);
  });

  it("n'insère pas de publicité si aucune pub n'est fournie", () => {
    const tracks = [track("a", 60_000)];
    const rules = { adEveryNMinutes: 1, maxConsecutiveAds: 2 };
    const result = resolvePlayback({ tracks, jingles: [], ads: [], rules, windowMs: 180_000 });
    expect(result.every((s) => s.type !== "ADVERTISEMENT")).toBe(true);
  });
});

describe("isScheduleItemActiveAt", () => {
  it("reconnaît un jour actif à une heure dans la plage", () => {
    const item = { start_time: "08:00:00", end_time: "20:00:00", days_of_week: [1, 2, 3, 4, 5] };
    const monday10am = new Date("2026-08-24T10:00:00"); // un lundi
    expect(isScheduleItemActiveAt(item, monday10am)).toBe(true);
  });

  it("rejette un jour non listé", () => {
    const item = { start_time: "08:00:00", end_time: "20:00:00", days_of_week: [1, 2, 3, 4, 5] };
    const sunday10am = new Date("2026-08-23T10:00:00"); // un dimanche
    expect(isScheduleItemActiveAt(item, sunday10am)).toBe(false);
  });

  it("rejette une heure hors plage le même jour", () => {
    const item = { start_time: "08:00:00", end_time: "20:00:00", days_of_week: [1, 2, 3, 4, 5] };
    const monday6am = new Date("2026-08-24T06:00:00");
    expect(isScheduleItemActiveAt(item, monday6am)).toBe(false);
  });

  it("gère une plage traversant minuit", () => {
    const item = { start_time: "22:00:00", end_time: "02:00:00", days_of_week: [5] };
    const friday11pm = new Date("2026-08-28T23:00:00"); // un vendredi
    const friday1am = new Date("2026-08-28T01:00:00");
    expect(isScheduleItemActiveAt(item, friday11pm)).toBe(true);
    expect(isScheduleItemActiveAt(item, friday1am)).toBe(true);
  });

  it("plage traversant minuit : rejette une heure hors plage", () => {
    const item = { start_time: "22:00:00", end_time: "02:00:00", days_of_week: [5] };
    const friday3pm = new Date("2026-08-28T15:00:00");
    expect(isScheduleItemActiveAt(item, friday3pm)).toBe(false);
  });
});
