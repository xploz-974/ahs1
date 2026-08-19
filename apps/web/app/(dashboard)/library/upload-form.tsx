"use client";

import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { detectFormat, CATEGORY_BUCKET } from "@/lib/audio-shared";
import { finalizeAudioUpload } from "./actions";

export function UploadForm({ organizationId }: { organizationId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(null);

    const file = formData.get("file");
    const category = String(formData.get("category") ?? "music");

    if (!(file instanceof File) || file.size === 0) {
      setError("Sélectionne un fichier audio.");
      return;
    }

    const format = detectFormat(file.type, file.name);
    if (!format) {
      setError("Format non supporté (MP3, WAV ou FLAC uniquement).");
      return;
    }

    const bucket = CATEGORY_BUCKET[category];
    if (!bucket) {
      setError("Catégorie invalide.");
      return;
    }

    const storagePath = `${organizationId}/${crypto.randomUUID()}-${file.name}`;
    const supabase = createClient();

    const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, file, {
      contentType: file.type || `audio/${format}`,
      upsert: false,
    });

    if (uploadError) {
      setError(`Échec de l'upload : ${uploadError.message}`);
      return;
    }

    startTransition(async () => {
      const result = await finalizeAudioUpload({
        bucket,
        storagePath,
        category,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || `audio/${format}`,
      });

      if (result.error) {
        setError(result.error);
        await supabase.storage.from(bucket).remove([storagePath]);
      } else {
        setSuccess(result.success);
        formRef.current?.reset();
      }
    });
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
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

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-signal px-4 py-2 text-sm font-medium text-ink-950 transition hover:bg-signal-dim disabled:opacity-60"
      >
        {isPending ? "Import en cours…" : "Importer"}
      </button>

      {error && <p className="text-xs text-status-critical">{error}</p>}
      {success && <p className="text-xs text-status-online">{success}</p>}
    </form>
  );
}
