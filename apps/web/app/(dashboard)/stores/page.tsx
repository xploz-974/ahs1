import { createClient } from "@/lib/supabase/server";
import { CreateStoreForm } from "./create-store-form";
import { StoresTable, type StoreRow } from "./stores-table";

export default async function StoresPage() {
  const supabase = createClient();

  const { data: stores, error } = await supabase
    .from("stores")
    .select("id, name, region, timezone, address")
    .order("name");

  const { data: players } = await supabase.from("players").select("store_id");

  const playerCountByStore = new Map<string, number>();
  for (const p of players ?? []) {
    playerCountByStore.set(p.store_id, (playerCountByStore.get(p.store_id) ?? 0) + 1);
  }

  const rows: StoreRow[] = (stores ?? []).map((s) => ({
    ...s,
    player_count: playerCountByStore.get(s.id) ?? 0,
  }));

  return (
    <div className="p-8">
      <h1 className="text-lg font-medium text-ink-100">Magasins</h1>
      <p className="mt-1 text-sm text-ink-400">Les points de diffusion rattachés à ton organisation.</p>

      <div className="mt-6">
        <CreateStoreForm />
      </div>

      {error && (
        <div className="mt-6 rounded-md border border-status-critical/30 bg-status-critical/10 px-4 py-3 text-sm text-status-critical">
          Erreur : {error.message}
        </div>
      )}

      {!error && <StoresTable stores={rows} />}
    </div>
  );
}
