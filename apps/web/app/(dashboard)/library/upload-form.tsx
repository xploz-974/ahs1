"use client";

import { useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { uploadAudioFile, type UploadState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-signal px-4 py-2 text-sm font-medium text-ink-950 transition hover:bg-signal-dim disabled:opacity-60"
    >
      {pending ? "Import en cours…" : "Importer"}
    </button>
  );
}

export function UploadForm() {
  const [state, formAction] = useFormState<UploadState, FormData>(uploadAudioFile, {
    error: null,
    success: null,
  });
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await formAction(formData);
        formRef.current?.reset();
      }}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-ink-700 bg-ink-900 p-4"
    >
      <div>
        <label htmlFor="file" className="mb-1.5 block text-xs font-medium text-ink-400">
          Fichier (MP3, WAV, FLAC)
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/flac,audio/x-flac,.mp3,.wav,.flac"
          required
          className="block text-sm text-ink-200 file:mr-3 file:rounded-md file:border-0 file:bg-ink-700 file:px-3 file:py-1.5 file:text-xs file:text-ink-100"
        />
      </div>

      <div>
        <label htmlFor="category" className="mb-1.5 block text-xs font-medium text-ink-400">
          Catégorie
        </label>
        <select
          id="category"
          name="category"
          defaultValue="music"
          className="rounded-md border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none focus:border-signal"
        >
          <option value="music">Musique</option>
          <option value="jingle">Jingle</option>
          <option value="advertisement">Publicité</option>
        </select>
      </div>

      <SubmitButton />

      {state.error && <p className="text-xs text-status-critical">{state.error}</p>}
      {state.success && <p className="text-xs text-status-online">{state.success}</p>}
    </form>
  );
}
