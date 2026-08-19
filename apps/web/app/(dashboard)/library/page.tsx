import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganizationId } from "@/lib/org";
import { UploadForm } from "./upload-form";

type AudioFileRow = {
  id: string;
  title: string;
  duration_ms: number;
  format: string;
  bitrate: number | null;
  sample_rate: number | null;
  file_size: number;
  checksum: string;
  category: string;
  created_at: string;
  artists: { name: string } | null;
  genres: { name: string } | null;
};

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

const CATEGORY_LABEL: Record<string, string> = {
  music: "Musique",
  jingle: "Jingle",
  advertisement: "Publicité",
  temporary: "Temporaire",
};

export default async function LibraryPage() {
  const supabase = createClient();
  const organizationId = await getCurrentOrganizationId(supabase);

  const { data: files, error } = await supabase
    .from("audio_files")
    .select(
      "id, title, duration_ms, format, bitrate, sample_rate, file_size, checksum, category, created_at, artists(name), genres(name)"
    )
    .order("created_at", { ascending: false })
    .returns<AudioFileRow[]>();

  return (
    <div className="p-8">
      <h1 className="text-lg font-medium text-ink-100">Bibliothèque audio</h1>
      <p className="mt-1 text-sm text-ink-400">
        Import, extraction des métadonnées (durée, bitrate, sample rate) et checksum SHA-256 automatiques.
      </p>

      <div className="mt-6">
        {organizationId ? (
          <UploadForm organizationId={organizationId} />
        ) : (
          <div className="rounded-md border border-status-warning/30 bg-status-warning/10 px-4 py-3 text-sm text-status-warning">
            Aucune organisation associée à ce compte — impossible d&apos;importer.
          </div>
        )}
      </div>

      {error && (
        <div className="mt-6 rounded-md border border-status-critical/30 bg-status-critical/10 px-4 py-3 text-sm text-status-critical">
          Erreur : {error.message}
        </div>
      )}

      {!error && files && files.length === 0 && (
        <div className="mt-6 rounded-md border border-ink-700 bg-ink-900 px-4 py-3 text-sm text-ink-400">
          Aucun fichier importé pour l&apos;instant.
        </div>
      )}

      {!error && files && files.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-lg border border-ink-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink-900 text-xs uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-4 py-3 font-medium">Titre</th>
                <th className="px-4 py-3 font-medium">Artiste</th>
                <th className="px-4 py-3 font-medium">Genre</th>
                <th className="px-4 py-3 font-medium">Catégorie</th>
                <th className="px-4 py-3 font-medium">Durée</th>
                <th className="px-4 py-3 font-medium">Format</th>
                <th className="px-4 py-3 font-medium">Bitrate</th>
                <th className="px-4 py-3 font-medium">Taille</th>
                <th className="px-4 py-3 font-medium">Checksum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700 bg-ink-950">
              {files.map((f) => (
                <tr key={f.id}>
                  <td className="px-4 py-3 text-ink-100">{f.title}</td>
                  <td className="px-4 py-3 text-ink-300">{f.artists?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-300">{f.genres?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-300">{CATEGORY_LABEL[f.category] ?? f.category}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-400">{formatDuration(f.duration_ms)}</td>
                  <td className="px-4 py-3 font-mono text-xs uppercase text-ink-400">{f.format}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-400">
                    {f.bitrate ? `${Math.round(f.bitrate / 1000)} kb/s` : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-400">{formatSize(f.file_size)}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-ink-600" title={f.checksum}>
                    {f.checksum.slice(0, 12)}…
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
