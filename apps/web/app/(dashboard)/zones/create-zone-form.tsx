"use client";

import { useFormState, useFormStatus } from "react-dom";
import { createZone, type ActionState } from "./actions";

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

export function CreateZoneForm({ stores }: { stores: { id: string; name: string }[] }) {
  const [state, formAction] = useFormState<ActionState, FormData>(createZone, { error: null, success: null });

  const inputClass =
    "w-full rounded-md border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none focus:border-signal";

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-lg border border-ink-700 bg-ink-900 p-4">
      <div className="min-w-[180px] flex-1">
        <label htmlFor="name" className="mb-1.5 block text-xs font-medium text-ink-400">
          Nom de la zone
        </label>
        <input id="name" name="name" required className={inputClass} placeholder="Salle principale" />
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
      <SubmitButton />
      {state.error && <p className="w-full text-xs text-status-critical">{state.error}</p>}
      {state.success && <p className="w-full text-xs text-status-online">{state.success}</p>}
    </form>
  );
}
