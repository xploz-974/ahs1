import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganizationId } from "@/lib/org";
import { CreateJingleForm } from "./create-jingle-form";
import { JinglesTable, type JingleRow } from "./jingles-table";

export default async function JinglesPage() {
  const supabase = createClient();
  const organizationId = await getCurrentOrganizationId(supabase);

  const { data: jingles, error } = await supabase
    .from("jingles")
    .select(
      "id, frequency_every_n_tracks, priority, start_date, end_date, status, version, store_id, audio_files(title), stores(name)"
    )
    .order("created_at", { ascending: false })
    .returns<JingleRow[]>();

  const { data: stores } = await supabase.from("stores").select("id, name").order("name");

  const { data: audioFiles } = await supabase
    .from("audio_files")
    .select("id, title")
    .eq("organization_id", organizationId ?? "")
    .eq("category", "jingle")
    .order("title");

  return (
    <div className="p-8">
      <h1 className="text-lg font-medium text-ink-100">Jingles</h1>
      <p className="mt-1 text-sm text-ink-400">
        Un jingle par magasin, avec sa fréquence de rotation dans la programmation musicale.
      </p>

      <div className="mt-6">
        <CreateJingleForm audioFiles={audioFiles ?? []} stores={stores ?? []} />
      </div>

      {error && (
        <div className="mt-6 rounded-md border border-status-critical/30 bg-status-critical/10 px-4 py-3 text-sm text-status-critical">
          Erreur : {error.message}
        </div>
      )}

      {!error && <JinglesTable jingles={jingles ?? []} stores={stores ?? []} />}
    </div>
  );
}
