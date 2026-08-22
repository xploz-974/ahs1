import { describe, expect, it } from "vitest";
import { describeEntry, diagnose, type TimelineEntry } from "./activity-diagnostics";

const NOW = new Date("2026-08-22T16:50:00Z");

function playback(at: string): TimelineEntry {
  return { id: `pb-${at}`, at, kind: "playback", playbackType: "MUSIC" };
}
function device(deviceType: TimelineEntry["deviceType"], at: string, extra: Partial<TimelineEntry> = {}): TimelineEntry {
  return { id: `dv-${at}-${deviceType}`, at, kind: "device", deviceType, ...extra };
}

describe("describeEntry", () => {
  it("décrit un événement de lecture", () => {
    expect(describeEntry(playback("2026-08-22T16:00:00Z"))).toMatch(/Diffusion : Musique/);
  });

  it("décrit un changement de volume avec la valeur en pourcentage", () => {
    const entry = device("VOLUME_CHANGE", "2026-08-22T16:00:00Z", { value: 0.04, source: "touch" });
    expect(describeEntry(entry)).toMatch(/4%/);
    expect(describeEntry(entry)).toMatch(/tactile/);
  });

  it("distingue une source distante d'une source tactile", () => {
    const entry = device("PAUSE", "2026-08-22T16:00:00Z", { source: "remote" });
    expect(describeEntry(entry)).toMatch(/à distance/);
  });
});

describe("diagnose", () => {
  it("ne signale rien si une diffusion récente a eu lieu", () => {
    const entries = [playback("2026-08-22T16:45:00Z")];
    expect(diagnose(entries, NOW)).toBeNull();
  });

  it("ne signale rien s'il n'y a aucune donnée", () => {
    expect(diagnose([], NOW)).toBeNull();
  });

  it("explique un silence par un volume proche de zéro", () => {
    const entries = [
      playback("2026-08-22T16:00:00Z"),
      device("VOLUME_CHANGE", "2026-08-22T16:00:30Z", { value: 0.04, source: "touch" }),
    ];
    const result = diagnose(entries, NOW);
    expect(result).toMatch(/volume/i);
    expect(result).toMatch(/4%/);
  });

  it("explique un silence par une pause jamais reprise", () => {
    const entries = [playback("2026-08-22T16:00:00Z"), device("PAUSE", "2026-08-22T16:15:00Z", { source: "touch" })];
    const result = diagnose(entries, NOW);
    expect(result).toMatch(/pause/i);
    expect(result).toMatch(/jamais reprise/);
  });

  it("ne signale pas de pause non reprise si une reprise a eu lieu après", () => {
    const entries = [
      playback("2026-08-22T16:00:00Z"),
      device("PAUSE", "2026-08-22T16:15:00Z"),
      device("PLAY", "2026-08-22T16:20:00Z"),
    ];
    // Toujours en silence depuis > 20 min (16h20 -> 16h50) mais sans volume bas
    // ni pause non reprise : doit tomber sur le message générique.
    const result = diagnose(entries, NOW);
    expect(result).not.toMatch(/jamais reprise/);
    expect(result).toMatch(/sans cause identifiée/);
  });

  it("priorise le volume bas sur une pause plus ancienne", () => {
    const entries = [
      playback("2026-08-22T16:00:00Z"),
      device("PAUSE", "2026-08-22T16:10:00Z"),
      device("VOLUME_CHANGE", "2026-08-22T16:20:00Z", { value: 0.02 }),
    ];
    const result = diagnose(entries, NOW);
    expect(result).toMatch(/volume/i);
  });
});
