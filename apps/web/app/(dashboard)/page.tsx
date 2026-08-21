import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { computeLiveStatus } from "@/lib/player-status";

type StoreRow = {
  id: string;
  name: string;
  region: string | null;
  timezone: string;
  organizations: { name: string } | null;
};

function StatCard({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="rounded-lg border border-ink-700 bg-ink-900 p-4">
      <p className="text-[11px] uppercase tracking-wide text-ink-400">{label}</p>
      <p className={`mt-1 text-2xl font-medium ${tone ?? "text-ink-100"}`}>{value}</p>
    </div>
  );
}

export default async function DashboardHomePage() {
  const supabase = createClient();

  const { data: stores, error } = await supabase
    .from("stores")
    .select("id, name, region, timezone, organizations(name)")
    .order("name")
    .returns<StoreRow[]>();

  const { data: players } = await supabase.from("players").select("id, status, last_seen");

  const { data: heartbeats } = await supabase
    .from("player_heartbeats")
    .select("player_id, cache_status, received_at")
    .order("received_at", { ascending: false });

  const lastCacheStatusByPlayer = new Map<string, string | null>();
  for (const h of heartbeats ?? []) {
    if (!lastCacheStatusByPlayer.has(h.player_id)) lastCacheStatusByPlayer.set(h.player_id, h.cache_status);
  }

  let online = 0;
  let offline = 0;
  let critical = 0;
  for (const p of players ?? []) {
    const live = computeLiveStatus({
      status: p.status,
      lastSeen: p.last_seen,
      lastCacheStatus: lastCacheStatusByPlayer.get(p.id) ?? null,
    });
    if (live === "ONLINE") online++;
    else if (live === "OFFLINE_BUT_PLAYING") offline++;
    else if (live === "OFFLINE_CRITICAL" || live === "ERROR") critical++;
  }

  const { count: campaignsCount } = await supabase
    .from("advertisement_campaigns")
    .select("id", { count: "exact", head: true })
    .eq("status", "ACTIVE");

  const { data: activeCampaignIds } = await supabase
    .from("advertisement_campaigns")
    .select("id")
    .eq("status", "ACTIVE");

  let activeAdsCount = 0;
  if (activeCampaignIds && activeCampaignIds.length > 0) {
    const { count } = await supabase
      .from("advertisement_assets")
      .select("id", { count: "exact", head: true })
      .in(
        "campaign_id",
        activeCampaignIds.map((c) => c.id)
      );
    activeAdsCount = count ?? 0;
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const { count: playbackTodayCount } = await supabase
    .from("playback_history")
    .select("id", { count: "exact", head: true })
    .gte("played_at", startOfToday.toISOString());

  const { data: recentAlerts } = await supabase
    .from("player_alerts")
    .select("id, type, message, created_at, players(name)")
    .is("acknowledged_at", null)
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <div className="p-8">
      <h1 className="text-lg font-medium text-ink-100">AHS1 — Audio Hub Stream</h1>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Players" value={players?.length ?? 0} />
        <StatCard label="🟢 En ligne" value={online} tone="text-status-online" />
        <StatCard label="🟠 Hors connexion" value={offline} tone="text-status-warning" />
        <StatCard label="🔴 Critique" value={critical} tone="text-status-critical" />
        <StatCard label="Publicités actives" value={activeAdsCount} />
        <StatCard label="Campagnes" value={campaignsCount ?? 0} />
      </div>

      <div className="mt-3">
        <StatCard label="Diffusions aujourd'hui" value={playbackTodayCount ?? 0} />
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink-200">Problèmes récents</h2>
          <Link href="/alerts" className="text-xs text-signal hover:underline">
            Voir tout
          </Link>
        </div>
        <div className="mt-2 overflow-hidden rounded-lg border border-ink-700">
          <table className="w-full text-left text-sm">
            <tbody className="divide-y divide-ink-700 bg-ink-950">
              {(recentAlerts ?? []).length === 0 && (
                <tr>
                  <td className="px-4 py-3 text-sm text-ink-400">Aucun problème actif 🎉</td>
                </tr>
              )}
              {(recentAlerts ?? []).map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3 text-ink-100">{(a.players as unknown as { name: string } | null)?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-400">{a.message ?? a.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <h2 className="mb-2 mt-8 text-sm font-medium text-ink-200">Magasins</h2>

      {error && (
        <div className="mt-2 rounded-md border border-status-critical/30 bg-status-critical/10 px-4 py-3 text-sm text-status-critical">
          Erreur RLS/requête : {error.message}
        </div>
      )}

      {!error && stores?.length === 0 && (
        <div className="mt-2 rounded-md border border-ink-700 bg-ink-900 px-4 py-3 text-sm text-ink-400">
          Aucun magasin visible pour ce compte.
        </div>
      )}

      {!error && stores && stores.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-ink-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink-900 text-xs uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-4 py-3 font-medium">Magasin</th>
                <th className="px-4 py-3 font-medium">Organisation</th>
                <th className="px-4 py-3 font-medium">Région</th>
                <th className="px-4 py-3 font-medium">Fuseau horaire</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700 bg-ink-950">
              {stores.map((store) => (
                <tr key={store.id}>
                  <td className="px-4 py-3 text-ink-100">{store.name}</td>
                  <td className="px-4 py-3 text-ink-300">{store.organizations?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-300">{store.region ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-400">{store.timezone}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
