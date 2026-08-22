"use client";

import { useFormState, useFormStatus } from "react-dom";
import { inviteMember, type ActionState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-signal px-4 py-2 text-sm font-medium text-ink-950 transition hover:bg-signal-dim disabled:opacity-60"
    >
      {pending ? "Envoi…" : "Inviter"}
    </button>
  );
}

export function InviteForm() {
  const [state, formAction] = useFormState<ActionState, FormData>(inviteMember, { error: null, success: null });

  const inputClass =
    "w-full rounded-md border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none focus:border-signal";

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-lg border border-ink-700 bg-ink-900 p-4">
      <div className="min-w-[220px] flex-1">
        <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-ink-400">
          Email
        </label>
        <input id="email" name="email" type="email" required className={inputClass} placeholder="collegue@exemple.com" />
      </div>
      <div>
        <label htmlFor="role" className="mb-1.5 block text-xs font-medium text-ink-400">
          Rôle
        </label>
        <select id="role" name="role" defaultValue="manager" className={inputClass}>
          <option value="owner">owner</option>
          <option value="admin">admin</option>
          <option value="manager">manager</option>
          <option value="viewer">viewer</option>
        </select>
      </div>
      <SubmitButton />
      {state.error && <p className="w-full text-xs text-status-critical">{state.error}</p>}
      {state.success && <p className="w-full text-xs text-status-online">{state.success}</p>}
    </form>
  );
}
