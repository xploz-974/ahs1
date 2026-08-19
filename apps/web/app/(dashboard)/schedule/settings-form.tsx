"use client";

import { useState, useTransition } from "react";
import { updateAutoDjRules } from "./actions";
import type { AutoDjRules } from "@ahs1/core";

export function SettingsForm({ initialRules }: { initialRules: AutoDjRules }) {
  const [rules, setRules] = useState(initialRules);
  const [saving, startSave] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function save() {
    setMessage(null);
    startSave(async () => {
      const result = await updateAutoDjRules(rules);
      setMessage(result.error ?? result.success);
    });
  }

  const inputClass =
    "w-24 rounded-md border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none focus:border-signal";

  return (
    <div className="rounded-lg border border-ink-700 bg-ink-900 p-4">
      <h2 className="mb-3 text-sm font-medium text-ink-200">Règles AutoDJ (§20)</h2>
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1.5 block text-xs text-ink-400">Publicité toutes les (min)</label>
          <input
            type="number"
            min={1}
            className={inputClass}
            value={rules.adEveryNMinutes}
            onChange={(e) => setRules({ ...rules, adEveryNMinutes: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs text-ink-400">Max publicités consécutives</label>
          <input
            type="number"
            min={1}
            className={inputClass}
            value={rules.maxConsecutiveAds}
            onChange={(e) => setRules({ ...rules, maxConsecutiveAds: Number(e.target.value) })}
          />
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-md bg-signal px-4 py-2 text-sm font-medium text-ink-950 transition hover:bg-signal-dim disabled:opacity-60"
        >
          {saving ? "…" : "Enregistrer"}
        </button>
        {message && <span className="text-xs text-ink-400">{message}</span>}
      </div>
      <p className="mt-2 text-[11px] text-ink-600">
        La fréquence des jingles se règle individuellement sur chaque jingle (page Jingles).
      </p>
    </div>
  );
}
