"use client";

import { useFormState, useFormStatus } from "react-dom";
import { createJingle, type ActionState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-signal px-4 py-2 text-sm font-medium text-ink-950 transition hover:bg-signal-dim disabled:opacity-60"
    >
      {pending ? "Création…" : "Créer"}
    </button>
  );
}

export function CreateJingleForm({
  audioFiles,
  stores,
}: {
  audioFiles: { id: string; title: string }[];
  stores: { id: string; name: string }[];
}) {
  const [state, formAction] = useFormState<ActionState, FormData>(createJingle, {
    error: null,
    success: null,
  });

  const inputClass =
    "w-full rounded-md border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none focus:border-signal";

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-lg border border-ink-700 bg-ink-900 p-4">
      <div className="min-w-[180px] flex-1">
        <label htmlFor="audio_file_id" className="mb-1.5 block text-xs font-medium text-ink-400">
          Fichier (catégorie Jingle)
        </label>
        <select id="audio_file_id" name="audio_file_id" required className={inputClass}>
          <option value="">—</option>
          {audioFiles.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-[160px] flex-1">
        <label htmlFor="store_id" className="mb-1.5 block text-xs font-medium text-ink-400">
          Magasin
        </label>
        <select id="store_id" name="store_id" required className={inputClass}>
          <option value="">—</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="w-32">
        <label htmlFor="frequency" className="mb-1.5 block text-xs font-medium text-ink-400">
          Toutes les N pistes
        </label>
        <input id="frequency" name="frequency" type="number" min={1} defaultValue={5} className={inputClass} />
      </div>
      <div>
        <label htmlFor="start_date" className="mb-1.5 block text-xs font-medium text-ink-400">
          Début (optionnel)
        </label>
        <input id="start_date" name="start_date" type="date" className={inputClass} />
      </div>
      <div>
        <label htmlFor="end_date" className="mb-1.5 block text-xs font-medium text-ink-400">
          Fin (optionnel)
        </label>
        <input id="end_date" name="end_date" type="date" className={inputClass} />
      </div>
      <SubmitButton />
      {state.error && <p className="text-xs text-status-critical">{state.error}</p>}
      {audioFiles.length === 0 && (
        <p className="w-full text-xs text-status-warning">
          Aucun fichier catégorie « Jingle » — importe-en un dans la Bibliothèque d&apos;abord.
        </p>
      )}
    </form>
  );
}
