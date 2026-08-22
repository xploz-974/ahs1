import { describe, expect, it } from "vitest";
import { ClockSync } from "./zone-sync";

// Simule un échange ping/pong entre deux horloges décalées d'un offset connu
// et une latence réseau donnée, pour vérifier que ClockSync le retrouve.
function simulateExchange(clockSync: ClockSync, realOffsetMs: number, oneWayLatencyMs: number, localT0: number) {
  const t0 = localT0; // horloge locale (follower) à l'envoi du ping
  const t1 = t0 + realOffsetMs + oneWayLatencyMs; // horloge leader à la réception
  const t2 = t1; // horloge leader au renvoi (traitement instantané)
  const t3 = t0 + 2 * oneWayLatencyMs; // horloge locale à la réception du pong
  clockSync.addSample(t0, t1, t2, t3);
}

describe("ClockSync", () => {
  it("retrouve l'offset exact avec une latence symétrique et nulle", () => {
    const clockSync = new ClockSync();
    simulateExchange(clockSync, 500, 0, 1000);
    expect(clockSync.getOffsetMs()).toBeCloseTo(500, 5);
    expect(clockSync.getBestRttMs()).toBeCloseTo(0, 5);
  });

  it("retrouve l'offset exact malgré une latence réseau symétrique non nulle", () => {
    const clockSync = new ClockSync();
    simulateExchange(clockSync, -1200, 15, 5000);
    expect(clockSync.getOffsetMs()).toBeCloseTo(-1200, 5);
    expect(clockSync.getBestRttMs()).toBeCloseTo(30, 5);
  });

  it("retourne null tant qu'aucune mesure n'est disponible", () => {
    const clockSync = new ClockSync();
    expect(clockSync.getOffsetMs()).toBeNull();
    expect(clockSync.getBestRttMs()).toBeNull();
  });

  it("privilégie les mesures au RTT le plus faible face à un pic de latence isolé", () => {
    const clockSync = new ClockSync();
    // Cinq mesures propres à latence quasi nulle...
    for (let i = 0; i < 5; i++) {
      simulateExchange(clockSync, 300, 1, 10_000 + i * 100);
    }
    // ...puis un pic de latence ponctuel (jitter réseau) qui biaiserait une
    // simple moyenne si on ne filtrait pas sur le RTT.
    simulateExchange(clockSync, 300, 200, 20_000);
    expect(clockSync.getOffsetMs()).toBeCloseTo(300, 0);
  });

  it("ne garde que les MAX_OFFSET_SAMPLES dernières mesures", () => {
    const clockSync = new ClockSync();
    simulateExchange(clockSync, 9999, 0, 0); // mesure très ancienne, doit finir éjectée
    for (let i = 1; i <= 8; i++) {
      simulateExchange(clockSync, 100, 0, i * 1000);
    }
    expect(clockSync.getOffsetMs()).toBeCloseTo(100, 5);
  });
});
