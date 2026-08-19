"use client";

import { useFormState, useFormStatus } from "react-dom";
import { createPlaylist, type ActionState } from "./actions";

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

export function CreatePlaylistForm() {
  const [state, formAction] = useFormState<ActionState, FormData>(createPlaylist, {
    error: null,
    success: null,
  });

  const inputClass =
    "w-full rounded-md border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none focus:border-signal";

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-lg border border-ink-700 bg-ink-900 p-4">
      <div className="min-w-[200px] flex-1">
        <label htmlFor="name" className="mb-1.5 block text-xs font-medium text-ink-400">
          Nom
        </label>
        <input id="name" name="name" required className={inputClass} placeholder="Ambiance boutique" />
      </div>
      <div className="min-w-[240px] flex-[2]">
        <label htmlFor="description" className="mb-1.5 block text-xs font-medium text-ink-400">
          Description (optionnelle)
        </label>
        <input id="description" name="description" className={inputClass} />
      </div>
      <SubmitButton />
      {state.error && <p className="text-xs text-status-critical">{state.error}</p>}
    </form>
  );
}
