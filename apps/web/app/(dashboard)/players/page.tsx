import { createClient } from "@/lib/supabase/server";
import { CreatePlayerForm } from "./create-player-form";
import { PlayersTable, type PlayerRow } from "./players-table";

export default async function PlayersPage() {
  const supabase = createClient();

  const { data: stores } = await supabase.from("stores").select("id, name").order("name");

  const { data: players, error } = await supabase
    .from("players")
    .select(
      "id, name, type, status, activation_code, activation_code_expires_at, last_seen, app_version, configuration, security_enabled, home_lat, home_lng, last_lat, last_lng, last_location_at, stores(name)"
    )
    .order("created_at", { ascending: false })
    .returns<PlayerRow[]>();

  const { data: heartbeats } = await supabase
    .from("player_heartbeats")
    .select("player_id, cache_status, received_at")
    .order("received_at", { ascending: false });

  const lastCacheStatusByPlayer = new Map<string, string | null>();
  for (const h of heartbeats ?? []) {
    if (!lastCacheStatusByPlayer.has(h.player_id)) lastCacheStatusByPlayer.set(h.player_id, h.cache_status);
  }

  return (
    <div className="p-8">
      <h1 className="text-lg font-medium text-ink-100">Players</h1>
      <p className="mt-1 text-sm text-ink-400">
        Crée un player pour obtenir un code d&apos;activation à saisir dans l&apos;app (ou via{" "}
        <code className="font-mono text-ink-300">POST /api/player/enroll</code>).
      </p>

      <div className="mt-6">
        <CreatePlayerForm stores={stores ?? []} />
      </div>

      {error && (
        <div className="mt-6 rounded-md border border-status-critical/30 bg-status-critical/10 px-4 py-3 text-sm text-status-critical">
          Erreur : {error.message}
        </div>
      )}

      {!error && (
        <PlayersTable
          players={players ?? []}
          lastCacheStatusByPlayer={Object.fromEntries(lastCacheStatusByPlayer)}
        />
      )}
    </div>
  );
}
