"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { openPlayerChannel, type PlayerState } from "@/lib/player-realtime";

// Vue technicien à distance : rejoint le même canal broadcast que la page
// /player de l'appareil. Aucun code PIN nécessaire ici — l'accès dashboard
// (compte admin authentifié) fait déjà office d'autorisation, ce qui évite
// justement au technicien d'avoir à taper le code sur la tablette elle-même.
export function RemoteControl({ playerId, playerName }: { playerId: string; playerName: string }) {
  const [state, setState] = useState<PlayerState | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [pendingPlaying, setPendingPlaying] = useState<boolean | null>(null);
  const channelRef = useRef<ReturnType<typeof openPlayerChannel> | null>(null);
  const pendingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const channel = openPlayerChannel(playerId);
    channelRef.current = channel;
    channel.on("broadcast", { event: "state" }, ({ payload }: { payload: PlayerState }) => {
      setState(payload);
      setLastUpdate(Date.now());
      // Confirmation reçue du player : l'affichage optimiste n'est plus nécessaire.
      setPendingPlaying((prev) => (prev === payload.isPlaying ? null : prev));
    });
    channel.subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, [playerId]);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const isLive = lastUpdate !== null && now - lastUpdate < 8000;

  function send(command: Parameters<NonNullable<typeof channelRef.current>["send"]>[0]["payload"]) {
    channelRef.current?.send({ type: "broadcast", event: "command", payload: command });
  }

  function togglePlay() {
    if (!state) return;
    const next = !(pendingPlaying ?? state.isPlaying);
    setPendingPlaying(next);
    send(next ? { type: "play" } : { type: "pause" });

    if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
    pendingTimeoutRef.current = setTimeout(() => setPendingPlaying(null), 6000);
  }

  const displayIsPlaying = state ? pendingPlaying ?? state.isPlaying : false;

  return (
    <div className="max-w-md">
      <Link href="/players" className="text-xs text-ink-400 hover:text-signal">
        ← Players
      </Link>

      <h1 className="mt-2 text-lg font-medium text-ink-100">Télécommande — {playerName}</h1>

      <div className="mt-4 rounded-lg border border-ink-700 bg-ink-900 p-4">
        <p className={`text-xs font-medium ${isLive ? "text-status-online" : "text-ink-500"}`}>
          {isLive ? "🟢 En ligne — état en direct" : "🟠 En attente d'un signal du player…"}
        </p>

        {state && (
          <>
            <p className="mt-4 text-[11px] uppercase tracking-wide text-ink-400">Magasin</p>
            <p className="text-sm text-ink-100">{state.storeName ?? "—"}</p>

            <p className="mt-3 text-[11px] uppercase tracking-wide text-ink-400">En lecture</p>
            <p className="text-base font-medium text-ink-100">{state.currentTitle ?? "—"}</p>
            <p className="text-xs text-ink-500">
              {displayIsPlaying ? "▶ Lecture" : "⏸ En pause"}
              {pendingPlaying !== null && <span className="ml-1 text-ink-600">(en cours…)</span>} · mode{" "}
              {state.mode === "technician" ? "technicien" : "verrouillé"}
            </p>

            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={togglePlay}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-signal text-xl text-ink-950"
              >
                {displayIsPlaying ? "⏸" : "▶"}
              </button>
              <button
                type="button"
                onClick={() => send({ type: "next" })}
                className="flex h-12 w-12 items-center justify-center rounded-full border border-ink-600 text-lg text-ink-100"
              >
                ⏭
              </button>
              <div className="flex-1">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={state.volume}
                  onChange={(e) => send({ type: "set_volume", value: Number(e.target.value) })}
                  className="w-full accent-signal"
                />
                <p className="text-right font-mono text-xs text-ink-500">{Math.round(state.volume * 100)}%</p>
              </div>
            </div>

            {state.queue.length > 0 && (
              <div className="mt-5">
                <p className="text-[11px] uppercase tracking-wide text-ink-400">File de lecture</p>
                <ol className="mt-1 space-y-0.5">
                  {state.queue.map((title, i) => (
                    <li key={i} className={`truncate text-xs ${i === 0 ? "text-signal" : "text-ink-400"}`}>
                      {title}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </>
        )}

        {!state && <p className="mt-4 text-sm text-ink-500">Aucun état reçu pour l&apos;instant — vérifie que le player est ouvert et connecté sur sa tablette.</p>}
      </div>
    </div>
  );
}
