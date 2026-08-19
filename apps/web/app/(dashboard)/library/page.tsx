import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganizationId } from "@/lib/org";
import { UploadForm } from "./upload-form";
import { FilterBar } from "./filter-bar";
import { LibraryTable, type AudioFileRow } from "./library-table";

const SELECT_COLUMNS =
  "id, title, duration_ms, format, bitrate, sample_rate, file_size, checksum, category, created_at, artists(name), albums(title), genres(name)";

const SORTABLE_FIELDS = new Set(["created_at", "title", "duration_ms"]);

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: { category?: string; artist?: string; sort?: string };
}) {
  const supabase = createClient();
  const organizationId = await getCurrentOrganizationId(supabase);

  const artistFilter = searchParams.artist?.trim();
  const select = artistFilter ? SELECT_COLUMNS.replace("artists(name)", "artists!inner(name)") : SELECT_COLUMNS;

  let query = supabase.from("audio_files").select(select);

  if (searchParams.category) {
    query = query.eq("category", searchParams.category);
  }
  if (artistFilter) {
    query = query.ilike("artists.name", `%${artistFilter}%`);
  }

  const [sortField, sortDir] = (searchParams.sort ?? "created_at:desc").split(":");
  query = query.order(SORTABLE_FIELDS.has(sortField) ? sortField : "created_at", {
    ascending: sortDir === "asc",
  });

  const { data: files, error } = await query.returns<AudioFileRow[]>();

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

      <div className="mt-6">
        <FilterBar />
      </div>

      {error && (
        <div className="mt-6 rounded-md border border-status-critical/30 bg-status-critical/10 px-4 py-3 text-sm text-status-critical">
          Erreur : {error.message}
        </div>
      )}

      {!error && files && files.length === 0 && (
        <div className="mt-6 rounded-md border border-ink-700 bg-ink-900 px-4 py-3 text-sm text-ink-400">
          Aucun fichier ne correspond à ces filtres.
        </div>
      )}

      {!error && files && files.length > 0 && <LibraryTable files={files} />}
    </div>
  );
}
