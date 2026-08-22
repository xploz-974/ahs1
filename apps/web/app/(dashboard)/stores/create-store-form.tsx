"use client";

import { useFormState, useFormStatus } from "react-dom";
import { createStore, type ActionState } from "./actions";

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

export function CreateStoreForm() {
  const [state, formAction] = useFormState<ActionState, FormData>(createStore, {
    error: null,
    success: null,
  });

  const inputClass =
    "w-full rounded-md border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none focus:border-signal";

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-lg border border-ink-700 bg-ink-900 p-4">
      <div className="min-w-[180px] flex-1">
        <label htmlFor="name" className="mb-1.5 block text-xs font-medium text-ink-400">
          Nom du magasin
        </label>
        <input id="name" name="name" required className={inputClass} placeholder="Carrefour Saint-Denis" />
      </div>
      <div className="min-w-[140px] flex-1">
        <label htmlFor="region" className="mb-1.5 block text-xs font-medium text-ink-400">
          Région
        </label>
        <input id="region" name="region" className={inputClass} placeholder="Réunion" />
      </div>
      <div className="min-w-[180px] flex-1">
        <label htmlFor="timezone" className="mb-1.5 block text-xs font-medium text-ink-400">
          Fuseau horaire
        </label>
        <input
          id="timezone"
          name="timezone"
          defaultValue="Indian/Reunion"
          className={inputClass}
          placeholder="Indian/Reunion"
        />
      </div>
      <div className="min-w-[200px] flex-1">
        <label htmlFor="address" className="mb-1.5 block text-xs font-medium text-ink-400">
          Adresse
        </label>
        <input id="address" name="address" className={inputClass} placeholder="12 rue de la Paix" />
      </div>
      <SubmitButton />
      {state.error && <p className="w-full text-xs text-status-critical">{state.error}</p>}
      {state.success && <p className="w-full text-xs text-status-online">{state.success}</p>}
    </form>
  );
}
