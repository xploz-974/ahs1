"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deletePlayer, regeneratePlayerCode, resetHomePosition, setPlayerSecurity, updatePlayerPin } from "./actions";
import { computeLiveStatus, STATUS_LABEL } from "@/lib/player-status";

export type PlayerRow = {
  id: string;
  name: string;
  type: string;
  status: string;
  activation_code: string | null;
  activation_code_expires_at: string | null;
  last_seen: string | null;
  app_version: string | null;
  configuration: { pin?: string } | null;
  security_enabled: boolean;
  home_lat: number | null;
  home_lng: number | null;
  last_lat: number | null;
  last_lng: number | null;
  last_location_at: string | null;
  stores: { name: string } | null;
};

const STATUS_STYLE: Record<string, string> = {
  ONLINE: "text-status-online",
  OFFLINE_BUT_PLAYING: "text-status-warning",
  OFFLINE_CRITICAL: "text-status-critical",
  ERROR: "text-status-critical",
  PENDING: "text-ink-500",
};

function timeAgo(iso: string | null): string {
  if (!iso) return "jamais";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.floor(hours / 24)} j`;
}

function PinCell({ playerId, initialPin }: { playerId: string; initialPin: string }) {
  const [pin, setPin] = useState(initialPin);
  const [editing, setEditing] = useState(false);
  const [saving, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="rounded border border-ink-700 px-2 py-0.5 font-mono text-xs text-ink-300 transition hover:border-ink-500"
        title="Cliquer pour modifier"
      >
        {pin}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        maxLength={8}
        className="w-20 rounded border border-ink-600 bg-ink-800 px-2 py-1 font-mono text-xs text-ink-100 outline-none focus:border-signal"
      />
      <button
        type="button"
        disabled={saving}
        onClick={() =>
          startSave(async () => {
            const result = await updatePlayerPin(playerId, pin);
            if (result.error) setError(result.error);
            else setEditing(false);
          })
        }
        className="rounded border border-ink-600 px-2 py-1 text-xs text-ink-300 hover:bg-ink-800"
      >
        OK
      </button>
      {error && <span className="text-[10px] text-status-critical">{error}</span>}
    </div>
  );
}

function timeAgoShort(iso: string | null): string {
  if (!iso) return "";
  return ` (${timeAgo(iso)})`;
}

function SecurityCell({ player }: { player: PlayerRow }) {
  const [enabled, setEnabled] = useState(player.security_enabled);
  const [pending, startAction] = useTransition();

  const mapsUrl =
    player.last_lat != null && player.last_lng != null
      ? `https://www.google.com/maps?q=${player.last_lat},${player.last_lng}`
      : null;

  return (
    <div className="flex flex-col gap-1 text-xs">
      <label className="flex items-center gap-1.5 text-ink-300">
        <input
          type="checkbox"
          checked={enabled}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.checked;
            setEnabled(next);
            startAction(async () => {
              await setPlayerSecurity(player.id, next);
            });
          }}
        />
        Anti-vol
      </label>
      {enabled && mapsUrl && (
        <a href={mapsUrl} target="_blank" rel="noreferrer" className="text-signal hover:underline">
          Voir position{timeAgoShort(player.last_location_at)}
        </a>
      )}
      {enabled && player.home_lat != null && (
        <button
          type="button"
          disabled={pending}
          onClick={() => startAction(async () => { await resetHomePosition(player.id); })}
          className="text-left text-ink-500 hover:text-ink-300"
        >
          Réinitialiser la référence
        </button>
      )}
    </div>
  );
}

export function PlayersTable({
  players,
  lastCacheStatusByPlayer,
}: {
  players: PlayerRow[];
  lastCacheStatusByPlayer?: Record<string, string | null>;
}) {
  const [pending, startAction] = useTransition();

  return (
    <div className="mt-6 overflow-x-auto rounded-lg border border-ink-700">
      <table className="w-full text-left text-sm">
        <thead className="bg-ink-900 text-xs uppercase tracking-wide text-ink-400">
          <tr>
            <th className="px-4 py-3 font-medium">Nom</th>
            <th className="px-4 py-3 font-medium">Magasin</th>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium">Statut</th>
            <th className="px-4 py-3 font-medium">Code d&apos;activation</th>
            <th className="px-4 py-3 font-medium">Code PIN</th>
            <th className="px-4 py-3 font-medium">Dernier contact</th>
            <th className="px-4 py-3 font-medium">Version app</th>
            <th className="px-4 py-3 font-medium">Sécurité</th>
            <th className="px-4 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-700 bg-ink-950">
          {players.length === 0 && (
            <tr>
              <td colSpan={10} className="px-4 py-3 text-sm text-ink-400">
                Aucun player pour l&apos;instant.
              </td>
            </tr>
          )}
          {players.map((p) => {
            const live = computeLiveStatus({
              status: p.status,
              lastSeen: p.last_seen,
              lastCacheStatus: lastCacheStatusByPlayer?.[p.id] ?? null,
            });
            return (
            <tr key={p.id}>
              <td className="px-4 py-3 text-ink-100">{p.name}</td>
              <td className="px-4 py-3 text-ink-300">{p.stores?.name ?? "—"}</td>
              <td className="px-4 py-3 text-xs text-ink-400">{p.type}</td>
              <td className={`px-4 py-3 text-xs font-medium ${STATUS_STYLE[live] ?? "text-ink-400"}`}>
                {STATUS_LABEL[live] ?? live}
              </td>
              <td className="px-4 py-3 font-mono text-xs text-ink-300">
                {p.status === "PENDING" ? p.activation_code : "—"}
              </td>
              <td className="px-4 py-3">
                <PinCell playerId={p.id} initialPin={p.configuration?.pin ?? "1990"} />
              </td>
              <td className="px-4 py-3 text-xs text-ink-400">{timeAgo(p.last_seen)}</td>
              <td className="px-4 py-3 font-mono text-xs text-ink-500">{p.app_version ?? "—"}</td>
              <td className="px-4 py-3">
                <SecurityCell player={p} />
              </td>
              <td className="px-4 py-3 text-right">
                <div className="inline-flex gap-1">
                  <Link
                    href={`/players/${p.id}/remote`}
                    className="rounded-md border border-signal/40 px-2.5 py-1 text-xs text-signal transition hover:bg-signal/10"
                  >
                    Contrôler
                  </Link>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      startAction(async () => {
                        await regeneratePlayerCode(p.id);
                      })
                    }
                    className="rounded-md border border-ink-600 px-2.5 py-1 text-xs text-ink-300 transition hover:bg-ink-800"
                  >
                    Régénérer le code
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (confirm(`Supprimer le player « ${p.name} » ?`)) startAction(() => deletePlayer(p.id));
                    }}
                    className="rounded-md border border-status-critical/40 px-2.5 py-1 text-xs text-status-critical transition hover:bg-status-critical/10"
                  >
                    Supprimer
                  </button>
                </div>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
