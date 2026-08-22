import { createClient } from "@/lib/supabase/server";
import { CreateZoneForm } from "./create-zone-form";
import { ZoneCard, type ZoneCardData } from "./zone-card";

export default async function ZonesPage() {
  const supabase = createClient();

  const { data: stores } = await supabase.from("stores").select("id, name").order("name");

  const { data: zones, error } = await supabase
    .from("player_zones")
    .select("id, name, store_id, leader_player_id")
    .order("name");

  const { data: players } = await supabase.from("players").select("id, name, store_id, zone_id").order("name");

  const storesById = new Map((stores ?? []).map((s) => [s.id, s]));

  const zonesByStore = new Map<string, ZoneCardData[]>();
  for (const z of zones ?? []) {
    const members = (players ?? [])
      .filter((p) => p.zone_id === z.id)
      .map((p) => ({ id: p.id, name: p.name }));
    const list = zonesByStore.get(z.store_id) ?? [];
    list.push({ id: z.id, name: z.name, leaderPlayerId: z.leader_player_id, members });
    zonesByStore.set(z.store_id, list);
  }

  return (
    <div className="p-8">
      <h1 className="text-lg font-medium text-ink-100">Zones multiroom</h1>
      <p className="mt-1 text-sm text-ink-400">
        Regroupe plusieurs players d&apos;un même magasin pour qu&apos;ils diffusent la même source en synchro
        (WebRTC, leader désigné manuellement). Un player sans zone continue de fonctionner indépendamment comme
        avant.
      </p>

      <div className="mt-6">
        <CreateZoneForm stores={stores ?? []} />
      </div>

      {error && (
        <div className="mt-6 rounded-md border border-status-critical/30 bg-status-critical/10 px-4 py-3 text-sm text-status-critical">
          Erreur : {error.message}
        </div>
      )}

      {!error && zonesByStore.size === 0 && (
        <p className="mt-6 text-sm text-ink-400">Aucune zone créée pour l&apos;instant.</p>
      )}

      {!error &&
        [...zonesByStore.entries()].map(([storeId, storeZones]) => (
          <div key={storeId} className="mt-8">
            <h2 className="mb-3 text-sm font-medium text-ink-200">{storesById.get(storeId)?.name ?? "—"}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {storeZones.map((zone) => {
                const unassignedPlayers = (players ?? [])
                  .filter((p) => p.store_id === storeId && !p.zone_id)
                  .map((p) => ({ id: p.id, name: p.name }));
                return <ZoneCard key={zone.id} zone={zone} unassignedPlayers={unassignedPlayers} />;
              })}
            </div>
          </div>
        ))}
    </div>
  );
}
