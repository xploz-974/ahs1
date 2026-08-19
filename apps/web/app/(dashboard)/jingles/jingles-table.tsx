"use client";

import { useMemo, useState, useTransition } from "react";
import { deleteJingle, updateJingle } from "./actions";

export type JingleRow = {
  id: string;
  frequency_every_n_tracks: number;
  priority: number;
  start_date: string | null;
  end_date: string | null;
  status: string;
  version: number;
  store_id: string;
  audio_files: { title: string } | null;
  stores: { name: string } | null;
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Actif",
  PAUSED: "En pause",
  ARCHIVED: "Archivé",
};

const MAX_RECOMMENDED = 5;

function EditRow({
  jingle,
  stores,
  onDone,
}: {
  jingle: JingleRow;
  stores: { id: string; name: string }[];
  onDone: () => void;
}) {
  const [storeId, setStoreId] = useState(jingle.store_id);
  const [frequency, setFrequency] = useState(jingle.frequency_every_n_tracks);
  const [priority, setPriority] = useState(jingle.priority);
  const [startDate, setStartDate] = useState(jingle.start_date ?? "");
  const [endDate, setEndDate] = useState(jingle.end_date ?? "");
  const [status, setStatus] = useState(jingle.status);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  function handleSave() {
    setError(null);
    startSave(async () => {
      const result = await updateJingle({
        id: jingle.id,
        storeId,
        frequency,
        priority,
        startDate,
        endDate,
        status,
      });
      if (result.error) setError(result.error);
      else onDone();
    });
  }

  const inputClass =
    "w-full rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1.5 text-sm text-ink-100 outline-none focus:border-signal";

  return (
    <tr className="bg-ink-900">
      <td colSpan={8} className="px-4 py-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <div>
            <label className="mb-1 block text-xs text-ink-400">Magasin</label>
            <select className={inputClass} value={storeId} onChange={(e) => setStoreId(e.target.value)}>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-400">Toutes les N pistes</label>
            <input
              type="number"
              min={1}
              className={inputClass}
              value={frequency}
              onChange={(e) => setFrequency(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-400">Priorité</label>
            <input
              type="number"
              className={inputClass}
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-400">Début</label>
            <input
              type="date"
              className={inputClass}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-400">Fin</label>
            <input type="date" className={inputClass} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-400">Statut</label>
            <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="ACTIVE">Actif</option>
              <option value="PAUSED">En pause</option>
              <option value="ARCHIVED">Archivé</option>
            </select>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-signal px-3 py-1.5 text-xs font-medium text-ink-950 transition hover:bg-signal-dim disabled:opacity-60"
          >
            {saving ? "…" : "Enregistrer"}
          </button>
          <button
            type="button"
            onClick={onDone}
            className="rounded-md px-3 py-1.5 text-xs text-ink-400 transition hover:bg-ink-800"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm("Supprimer ce jingle ?")) startSave(() => deleteJingle(jingle.id));
            }}
            className="ml-auto rounded-md border border-status-critical/40 px-3 py-1.5 text-xs text-status-critical transition hover:bg-status-critical/10"
          >
            Supprimer
          </button>
          {error && <span className="text-xs text-status-critical">{error}</span>}
        </div>
      </td>
    </tr>
  );
}

export function JinglesTable({
  jingles,
  stores,
}: {
  jingles: JingleRow[];
  stores: { id: string; name: string }[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const activeCountByStore = useMemo(() => {
    const counts = new Map<string, number>();
    for (const j of jingles) {
      if (j.status === "ACTIVE") counts.set(j.store_id, (counts.get(j.store_id) ?? 0) + 1);
    }
    return counts;
  }, [jingles]);

  const storesOverLimit = useMemo(
    () => stores.filter((s) => (activeCountByStore.get(s.id) ?? 0) > MAX_RECOMMENDED),
    [stores, activeCountByStore]
  );

  return (
    <div className="mt-6">
      {storesOverLimit.length > 0 && (
        <div className="mb-3 rounded-md border border-status-warning/30 bg-status-warning/10 px-4 py-3 text-sm text-status-warning">
          Plus de {MAX_RECOMMENDED} jingles actifs (recommandation §17) sur :{" "}
          {storesOverLimit.map((s) => `${s.name} (${activeCountByStore.get(s.id)})`).join(", ")}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-ink-700">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-900 text-xs uppercase tracking-wide text-ink-400">
            <tr>
              <th className="px-4 py-3 font-medium">Fichier</th>
              <th className="px-4 py-3 font-medium">Magasin</th>
              <th className="px-4 py-3 font-medium">Fréquence</th>
              <th className="px-4 py-3 font-medium">Priorité</th>
              <th className="px-4 py-3 font-medium">Période</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 font-medium">Version</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-700 bg-ink-950">
            {jingles.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-3 text-sm text-ink-400">
                  Aucun jingle pour l&apos;instant.
                </td>
              </tr>
            )}
            {jingles.map((j) =>
              editingId === j.id ? (
                <EditRow key={j.id} jingle={j} stores={stores} onDone={() => setEditingId(null)} />
              ) : (
                <tr key={j.id}>
                  <td className="px-4 py-3 text-ink-100">{j.audio_files?.title ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-300">{j.stores?.name ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-400">1 / {j.frequency_every_n_tracks}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-400">{j.priority}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-400">
                    {j.start_date ?? "—"} → {j.end_date ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-300">{STATUS_LABEL[j.status] ?? j.status}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-600">v{j.version}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setEditingId(j.id)}
                      className="rounded-md border border-ink-600 px-2.5 py-1 text-xs text-ink-300 transition hover:bg-ink-800"
                    >
                      Modifier
                    </button>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
