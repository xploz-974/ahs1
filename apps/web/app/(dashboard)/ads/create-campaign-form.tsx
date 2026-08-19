"use client";

import { useFormState, useFormStatus } from "react-dom";
import { createCampaign, type ActionState } from "./actions";

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

export function CreateCampaignForm() {
  const [state, formAction] = useFormState<ActionState, FormData>(createCampaign, {
    error: null,
    success: null,
  });

  const inputClass =
    "w-full rounded-md border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none focus:border-signal";

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-lg border border-ink-700 bg-ink-900 p-4">
      <div className="min-w-[160px] flex-1">
        <label htmlFor="name" className="mb-1.5 block text-xs font-medium text-ink-400">
          Campagne
        </label>
        <input id="name" name="name" required className={inputClass} placeholder="Promotion déjeuner" />
      </div>
      <div className="min-w-[160px] flex-1">
        <label htmlFor="advertiser" className="mb-1.5 block text-xs font-medium text-ink-400">
          Client
        </label>
        <input id="advertiser" name="advertiser" required className={inputClass} placeholder="Restaurant XYZ" />
      </div>
      <div>
        <label htmlFor="start_date" className="mb-1.5 block text-xs font-medium text-ink-400">
          Début
        </label>
        <input id="start_date" name="start_date" type="date" required className={inputClass} />
      </div>
      <div>
        <label htmlFor="end_date" className="mb-1.5 block text-xs font-medium text-ink-400">
          Fin
        </label>
        <input id="end_date" name="end_date" type="date" required className={inputClass} />
      </div>
      <SubmitButton />
      {state.error && <p className="text-xs text-status-critical">{state.error}</p>}
    </form>
  );
}
