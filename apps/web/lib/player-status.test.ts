import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeLiveStatus } from "./player-status";

const NOW = new Date("2026-08-22T12:00:00Z");

function minutesAgo(mins: number): string {
  return new Date(NOW.getTime() - mins * 60_000).toISOString();
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("computeLiveStatus", () => {
  it("reste PENDING avant toute activation, quel que soit last_seen", () => {
    expect(computeLiveStatus({ status: "PENDING", lastSeen: null, lastCacheStatus: null })).toBe("PENDING");
    expect(computeLiveStatus({ status: "PENDING", lastSeen: minutesAgo(0), lastCacheStatus: null })).toBe("PENDING");
  });

  it("est ERROR si last_seen est absent (jamais contacté)", () => {
    expect(computeLiveStatus({ status: "ONLINE", lastSeen: null, lastCacheStatus: null })).toBe("ERROR");
  });

  it("est ONLINE sous le seuil de fraîcheur", () => {
    expect(computeLiveStatus({ status: "ONLINE", lastSeen: minutesAgo(1), lastCacheStatus: null })).toBe("ONLINE");
  });

  it("passe hors ligne (mais joue encore) entre les deux seuils", () => {
    expect(computeLiveStatus({ status: "ONLINE", lastSeen: minutesAgo(10), lastCacheStatus: null })).toBe(
      "OFFLINE_BUT_PLAYING"
    );
  });

  it("passe en cache critique si hors ligne et cache faible/critique", () => {
    expect(computeLiveStatus({ status: "ONLINE", lastSeen: minutesAgo(10), lastCacheStatus: "LOW" })).toBe(
      "OFFLINE_CRITICAL"
    );
    expect(computeLiveStatus({ status: "ONLINE", lastSeen: minutesAgo(10), lastCacheStatus: "CRITICAL" })).toBe(
      "OFFLINE_CRITICAL"
    );
  });

  it("devient ERROR au-delà du seuil critique, même avec un bon cache", () => {
    expect(computeLiveStatus({ status: "ONLINE", lastSeen: minutesAgo(31), lastCacheStatus: "OK" })).toBe("ERROR");
  });

  it("est cohérent aux bornes exactes des seuils", () => {
    // < 2 min -> ONLINE ; à exactement 2 min -> plus ONLINE
    expect(computeLiveStatus({ status: "ONLINE", lastSeen: minutesAgo(2), lastCacheStatus: null })).not.toBe(
      "ONLINE"
    );
    // > 30 min -> ERROR ; à exactement 30 min -> pas encore ERROR
    expect(computeLiveStatus({ status: "ONLINE", lastSeen: minutesAgo(30), lastCacheStatus: null })).not.toBe(
      "ERROR"
    );
  });
});
