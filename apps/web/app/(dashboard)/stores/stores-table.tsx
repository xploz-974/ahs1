"use client";

import { useState, useTransition } from "react";
import { deleteStore, updateStore, type ActionState } from "./actions";

export type StoreRow = {
  id: string;
  name: string;
  region: string | null;
  timezone: string;
  address: string | null;
  player_count: number;
};

function EditableRow({ store, onCancel }: { store: StoreRow; onCancel: () => void }) {
  const [name, setName] = useState(store.name);
  const [region, setRegion] = useState(store.region ?? "");
  const [timezone, setTimezone] = useState(store.timezone);
  const [address, setAddress] = useState(store.address ?? "");
  const [pending, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const inputClass =
    "w-full rounded border border-ink-600 bg-ink-800 px-2 py-1 text-xs text-ink-100 outline-none focus:border-signal";

  return (
    <tr className="bg-ink-900/40">
      <td className="px-4 py-2">
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </td>
      <td className="px-4 py-2">
        <input value={region} onChange={(e) => setRegion(e.target.value)} className={inputClass} />
      </td>
      <td className="px-4 py-2">
        <input value={timezone} onChange={(e) => setTimezone(e.target.value)} className={inputClass} />
      </td>
      <td className="px-4 py-2">
        <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
      </td>
      <td className="px-4 py-2 text-xs text-ink-500">{store.player_count}</td>
      <td className="px-4 py-2 text-right">
        <div className="inline-flex items-center gap-1">
          {error && <span className="text-[10px] text-status-critical">{error}</span>}
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startSave(async () => {
                const result: ActionState = await updateStore(store.id, { name, region, timezone, address });
                if (result.error) setError(result.error);
                else onCancel();
              })
            }
            className="rounded-md border border-signal/40 px-2.5 py-1 text-xs text-signal transition hover:bg-signal/10"
          >
            Enregistrer
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-ink-600 px-2.5 py-1 text-xs text-ink-300 transition hover:bg-ink-800"
          >
            Annuler
          </button>
        </div>
      </td>
    </tr>
  );
}

export function StoresTable({ stores }: { stores: StoreRow[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, startAction] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  return (
    <div className="mt-6 overflow-x-auto rounded-lg border border-ink-700">
      <table className="w-full text-left text-sm">
        <thead className="bg-ink-900 text-xs uppercase tracking-wide text-ink-400">
          <tr>
            <th className="px-4 py-3 font-medium">Nom</th>
            <th className="px-4 py-3 font-medium">Région</th>
            <th className="px-4 py-3 font-medium">Fuseau horaire</th>
            <th className="px-4 py-3 font-medium">Adresse</th>
            <th className="px-4 py-3 font-medium">Players</th>
            <th className="px-4 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-700 bg-ink-950">
          {stores.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-3 text-sm text-ink-400">
                Aucun magasin pour l&apos;instant.
              </td>
            </tr>
          )}
          {stores.map((s) =>
            editingId === s.id ? (
              <EditableRow key={s.id} store={s} onCancel={() => setEditingId(null)} />
            ) : (
              <tr key={s.id}>
                <td className="px-4 py-3 text-ink-100">{s.name}</td>
                <td className="px-4 py-3 text-ink-300">{s.region ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-xs text-ink-400">{s.timezone}</td>
                <td className="px-4 py-3 text-ink-400">{s.address ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-ink-500">{s.player_count}</td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingId(s.id)}
                      className="rounded-md border border-ink-600 px-2.5 py-1 text-xs text-ink-300 transition hover:bg-ink-800"
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        const warning =
                          s.player_count > 0
                            ? `Supprimer « ${s.name} » supprimera aussi ses ${s.player_count} player(s) associé(s). Continuer ?`
                            : `Supprimer le magasin « ${s.name} » ?`;
                        if (confirm(warning)) {
                          startAction(async () => {
                            const result = await deleteStore(s.id);
                            if (result.error) setDeleteError(result.error);
                          });
                        }
                      }}
                      className="rounded-md border border-status-critical/40 px-2.5 py-1 text-xs text-status-critical transition hover:bg-status-critical/10"
                    >
                      Supprimer
                    </button>
                  </div>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
      {deleteError && <p className="px-4 py-2 text-xs text-status-critical">{deleteError}</p>}
    </div>
  );
}
