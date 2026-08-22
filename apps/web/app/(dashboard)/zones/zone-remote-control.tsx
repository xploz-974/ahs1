"use client";

import { useState } from "react";
import { openPlayerChannel, type PlayerCommand } from "@/lib/player-realtime";

// Diffuse une commande à un player et referme le canal une fois envoyée —
// contrairement à la télécommande individuelle (players/[id]/remote), pas
// besoin de rester connecté pour écouter l'état en retour, c'est un envoi
// "à la volée" pour chaque appareil du groupe.
function sendCommandTo(playerId: string, command: PlayerCommand) {
  const channel = openPlayerChannel(playerId);
  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      channel.send({ type: "broadcast", event: "command", payload: command });
      setTimeout(() => channel.unsubscribe(), 500);
    }
  });
}

// Contrôle groupé d'une zone : play/pause/volume s'appliquent à TOUS les
// membres (chaque appareil garde son propre haut-parleur, donc "même
// volume partout" a du sens) ; le resync, lui, ne concerne que le leader
// (qui seul pilote le choix des titres — voir zone-sync.ts et forceResync
// dans app/player/page.tsx).
export function ZoneRemoteControl({ memberIds, leaderPlayerId }: { memberIds: string[]; leaderPlayerId: string | null }) {
  const [volume, setVolume] = useState(1);

  function broadcastToAll(command: PlayerCommand) {
    for (const id of memberIds) sendCommandTo(id, command);
  }

  return (
    <div className="mt-3 border-t border-ink-700 pt-3">
      <p className="mb-2 text-[11px] uppercase tracking-wide text-ink-400">Contrôle groupé (toute la zone)</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => broadcastToAll({ type: "play" })}
          className="rounded-md border border-ink-600 px-2.5 py-1 text-xs text-ink-200 transition hover:bg-ink-800"
        >
          ▶ Tous
        </button>
        <button
          type="button"
          onClick={() => broadcastToAll({ type: "pause" })}
          className="rounded-md border border-ink-600 px-2.5 py-1 text-xs text-ink-200 transition hover:bg-ink-800"
        >
          ⏸ Tous
        </button>
        {leaderPlayerId && (
          <button
            type="button"
            onClick={() => sendCommandTo(leaderPlayerId, { type: "resync" })}
            title="Relance le titre en cours sur le leader et re-diffuse l'instant de départ à tous les followers"
            className="rounded-md border border-signal/40 px-2.5 py-1 text-xs text-signal transition hover:bg-signal/10"
          >
            🔁 Resynchroniser
          </button>
        )}
        <div className="flex-1">
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => {
              const v = Number(e.target.value);
              setVolume(v);
              broadcastToAll({ type: "set_volume", value: v });
            }}
            className="w-full accent-signal"
          />
        </div>
        <span className="w-9 text-right font-mono text-[11px] text-ink-500">{Math.round(volume * 100)}%</span>
      </div>
    </div>
  );
}
