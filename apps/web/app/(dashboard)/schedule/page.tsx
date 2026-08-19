import { createClient } from "@/lib/supabase/server";
import { getAutoDjRules } from "./actions";
import { SettingsForm } from "./settings-form";
import { SchedulePanel, type ScheduleItemRow } from "./schedule-panel";

export default async function SchedulePage() {
  const supabase = createClient();

  const { data: stores } = await supabase.from("stores").select("id, name").order("name");
  const { data: playlists } = await supabase.from("playlists").select("id, name").order("name");
  const { data: items } = await supabase
    .from("schedule_items")
    .select("id, start_time, end_time, days_of_week, playlist_id, playlists(name), schedules(store_id)")
    .returns<ScheduleItemRow[]>();

  const rules = await getAutoDjRules();

  return (
    <div className="p-8">
      <h1 className="text-lg font-medium text-ink-100">Programmation</h1>
      <p className="mt-1 text-sm text-ink-400">
        Le Cloud résout la programmation à partir des créneaux, playlists, jingles et publicités actives — le
        player exécutera cette même logique en Phase 8+.
      </p>

      <div className="mt-6">
        <SettingsForm initialRules={rules} />
      </div>

      {(!stores || stores.length === 0) && (
        <div className="mt-6 rounded-md border border-ink-700 bg-ink-900 px-4 py-3 text-sm text-ink-400">
          Aucun magasin — crée-en un d&apos;abord.
        </div>
      )}
      {(!playlists || playlists.length === 0) && stores && stores.length > 0 && (
        <div className="mt-6 rounded-md border border-status-warning/30 bg-status-warning/10 px-4 py-3 text-sm text-status-warning">
          Aucune playlist — crée-en une dans /playlists avant de définir un créneau.
        </div>
      )}

      {stores && stores.length > 0 && playlists && playlists.length > 0 && (
        <SchedulePanel stores={stores} playlists={playlists} items={items ?? []} />
      )}
    </div>
  );
}
