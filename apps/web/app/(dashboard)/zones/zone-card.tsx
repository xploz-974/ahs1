"use client";

import { useTransition } from "react";
import { assignPlayerToZone, deleteZone, setZoneLeader } from "./actions";
import { ZoneRemoteControl } from "./zone-remote-control";

export type ZoneCardData = {
  id: string;
  name: string;
  leaderPlayerId: string | null;
  members: { id: string; name: string }[];
};

export function ZoneCard({
  zone,
  unassignedPlayers,
}: {
  zone: ZoneCardData;
  unassignedPlayers: { id: string; name: string }[];
}) {
  const [pending, startAction] = useTransition();

  return (
    <div className="rounded-lg border border-ink-700 bg-ink-900 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-ink-100">{zone.name}</h3>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (confirm(`Supprimer la zone « ${zone.name} » ? Les players redeviendront indépendants.`)) {
              startAction(async () => {
                await deleteZone(zone.id);
              });
            }
          }}
          className="rounded-md border border-status-critical/40 px-2.5 py-1 text-xs text-status-critical transition hover:bg-status-critical/10"
        >
          Supprimer
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {zone.members.length === 0 && <p className="text-xs text-ink-500">Aucun player dans cette zone.</p>}
        {zone.members.map((m) => (
          <div key={m.id} className="flex items-center justify-between rounded border border-ink-700 bg-ink-950 px-3 py-2">
            <span className="text-sm text-ink-200">
              {m.name}
              {zone.leaderPlayerId === m.id && (
                <span className="ml-2 rounded bg-signal/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-signal">
                  leader
                </span>
              )}
            </span>
            <div className="flex gap-1">
              {zone.leaderPlayerId !== m.id && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => startAction(async () => { await setZoneLeader(zone.id, m.id); })}
                  className="rounded-md border border-ink-600 px-2 py-1 text-[11px] text-ink-300 transition hover:bg-ink-800"
                >
                  Désigner leader
                </button>
              )}
              <button
                type="button"
                disabled={pending}
                onClick={() => startAction(async () => { await assignPlayerToZone(m.id, null); })}
                className="rounded-md border border-ink-600 px-2 py-1 text-[11px] text-ink-300 transition hover:bg-ink-800"
              >
                Retirer
              </button>
            </div>
          </div>
        ))}
      </div>

      {zone.members.length > 0 && (
        <ZoneRemoteControl memberIds={zone.members.map((m) => m.id)} leaderPlayerId={zone.leaderPlayerId} />
      )}

      {unassignedPlayers.length > 0 && (
        <form
          className="mt-3 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const select = e.currentTarget.elements.namedItem("player_id") as HTMLSelectElement;
            const playerId = select.value;
            if (!playerId) return;
            startAction(async () => {
              await assignPlayerToZone(playerId, zone.id);
            });
            select.value = "";
          }}
        >
          <select
            name="player_id"
            defaultValue=""
            className="flex-1 rounded-md border border-ink-600 bg-ink-800 px-2 py-1.5 text-xs text-ink-100 outline-none focus:border-signal"
          >
            <option value="">Ajouter un player…</option>
            {unassignedPlayers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md border border-signal/40 px-2.5 py-1.5 text-xs text-signal transition hover:bg-signal/10"
          >
            Ajouter
          </button>
        </form>
      )}
    </div>
  );
}
