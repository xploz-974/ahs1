"use client";

import { useMemo, useState, useTransition } from "react";
import { addScheduleItem, removeScheduleItem, resolveStorePreview } from "./actions";
import type { ResolvedSlot } from "@ahs1/core";

export type ScheduleItemRow = {
  id: string;
  start_time: string;
  end_time: string;
  days_of_week: number[];
  playlist_id: string | null;
  playlists: { name: string } | null;
  schedules: { store_id: string } | null;
};

const DAYS = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mer" },
  { value: 4, label: "Jeu" },
  { value: 5, label: "Ven" },
  { value: 6, label: "Sam" },
  { value: 0, label: "Dim" },
];

const SLOT_LABEL: Record<ResolvedSlot["type"], string> = {
  MUSIC: "🎵",
  JINGLE: "🎙️",
  ADVERTISEMENT: "📢",
};

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

export function SchedulePanel({
  stores,
  playlists,
  items,
}: {
  stores: { id: string; name: string }[];
  playlists: { id: string; name: string }[];
  items: ScheduleItemRow[];
}) {
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [playlistId, setPlaylistId] = useState(playlists[0]?.id ?? "");
  const [days, setDays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5, 6, 0]));
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  const [preview, setPreview] = useState<{ slots: ResolvedSlot[]; label: string | null; error: string | null } | null>(
    null
  );
  const [loadingPreview, startPreview] = useTransition();

  const storeItems = useMemo(
    () => items.filter((it) => it.schedules?.store_id === storeId),
    [items, storeId]
  );

  function toggleDay(d: number) {
    setDays((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  }

  function handleAdd() {
    setError(null);
    if (!playlistId) {
      setError("Choisis une playlist.");
      return;
    }
    startSave(async () => {
      const result = await addScheduleItem({
        storeId,
        startTime,
        endTime,
        playlistId,
        daysOfWeek: Array.from(days),
      });
      if (result.error) setError(result.error);
    });
  }

  function handlePreview() {
    setPreview(null);
    startPreview(async () => {
      const result = await resolveStorePreview(storeId);
      setPreview({ slots: result.slots, label: result.scheduleItemLabel, error: result.error });
    });
  }

  const inputClass =
    "rounded-md border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none focus:border-signal";

  return (
    <div className="mt-6">
      <div className="mb-4 flex items-center gap-3">
        <label className="text-xs font-medium text-ink-400">Magasin</label>
        <select value={storeId} onChange={(e) => setStoreId(e.target.value)} className={inputClass}>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handlePreview}
          disabled={loadingPreview || !storeId}
          className="ml-auto rounded-md border border-ink-600 px-3 py-2 text-xs text-ink-200 transition hover:bg-ink-800 disabled:opacity-50"
        >
          {loadingPreview ? "Résolution…" : "Aperçu de la programmation (2h)"}
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-ink-700">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-900 text-xs uppercase tracking-wide text-ink-400">
            <tr>
              <th className="px-4 py-3 font-medium">Horaire</th>
              <th className="px-4 py-3 font-medium">Jours</th>
              <th className="px-4 py-3 font-medium">Playlist</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-700 bg-ink-950">
            {storeItems.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-3 text-sm text-ink-400">
                  Aucun créneau pour ce magasin.
                </td>
              </tr>
            )}
            {storeItems.map((it) => (
              <tr key={it.id}>
                <td className="px-4 py-3 font-mono text-xs text-ink-300">
                  {it.start_time.slice(0, 5)}–{it.end_time.slice(0, 5)}
                </td>
                <td className="px-4 py-3 text-xs text-ink-400">
                  {DAYS.filter((d) => it.days_of_week.includes(d.value))
                    .map((d) => d.label)
                    .join(" ")}
                </td>
                <td className="px-4 py-3 text-ink-100">{it.playlists?.name ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => startSave(() => removeScheduleItem(it.id, storeId))}
                    className="rounded-md border border-status-critical/40 px-2.5 py-1 text-xs text-status-critical transition hover:bg-status-critical/10"
                  >
                    Retirer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border border-ink-700 bg-ink-900 p-4">
        <div>
          <label className="mb-1.5 block text-xs text-ink-400">Début</label>
          <input type="time" className={inputClass} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs text-ink-400">Fin</label>
          <input type="time" className={inputClass} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
        <div className="min-w-[180px]">
          <label className="mb-1.5 block text-xs text-ink-400">Playlist</label>
          <select className={inputClass} value={playlistId} onChange={(e) => setPlaylistId(e.target.value)}>
            {playlists.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs text-ink-400">Jours</label>
          <div className="flex gap-1">
            {DAYS.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => toggleDay(d.value)}
                className={`rounded px-2 py-1.5 text-xs transition ${
                  days.has(d.value) ? "bg-signal text-ink-950" : "border border-ink-600 text-ink-300 hover:bg-ink-800"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={saving || !storeId}
          className="rounded-md bg-signal px-4 py-2 text-sm font-medium text-ink-950 transition hover:bg-signal-dim disabled:opacity-60"
        >
          {saving ? "…" : "Ajouter le créneau"}
        </button>
        {error && <p className="w-full text-xs text-status-critical">{error}</p>}
      </div>

      {preview && (
        <div className="mt-4 rounded-lg border border-ink-700 bg-ink-900 p-4">
          {preview.error && <p className="text-sm text-status-warning">{preview.error}</p>}
          {!preview.error && (
            <>
              <p className="mb-2 text-xs text-ink-400">Créneau actif : {preview.label}</p>
              <div className="max-h-80 overflow-y-auto">
                <ol className="space-y-1">
                  {preview.slots.map((s, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-ink-300">
                      <span>{SLOT_LABEL[s.type]}</span>
                      <span className="flex-1 truncate text-ink-100">
                        {s.title}
                        {s.subtitle ? ` — ${s.subtitle}` : ""}
                      </span>
                      <span className="font-mono text-ink-600">{formatDuration(s.durationMs)}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
