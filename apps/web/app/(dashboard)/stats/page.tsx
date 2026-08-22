import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-ink-700 bg-ink-900 p-4">
      <p className="text-[11px] uppercase tracking-wide text-ink-400">{label}</p>
      <p className="mt-1 text-2xl font-medium text-ink-100">{value}</p>
    </div>
  );
}

function formatHours(totalMs: number): string {
  const hours = totalMs / 3_600_000;
  if (hours < 1) return `${Math.round(totalMs / 60_000)} min`;
  return `${hours.toFixed(1)} h`;
}

export default async function StatsPage({
  searchParams,
}: {
  searchParams: { store_id?: string; from?: string; to?: string };
}) {
  const supabase = createClient();

  const { data: stores } = await supabase.from("stores").select("id, name").order("name");

  const defaultFrom = new Date();
  defaultFrom.setDate(defaultFrom.getDate() - 7);
  const from = searchParams.from ? new Date(searchParams.from) : defaultFrom;
  const to = searchParams.to ? new Date(searchParams.to) : new Date();
  to.setHours(23, 59, 59, 999);

  let query = supabase
    .from("playback_history")
    .select("type, duration_ms, audio_id, store_id, stores(name)")
    .gte("played_at", from.toISOString())
    .lte("played_at", to.toISOString());

  if (searchParams.store_id) query = query.eq("store_id", searchParams.store_id);

  const { data: rows, error } = await query.returns<
    { type: string; duration_ms: number | null; audio_id: string | null; store_id: string; stores: { name: string } | null }[]
  >();

  const byType = new Map<string, number>();
  const byStore = new Map<string, { name: string; count: number }>();
  const byAudio = new Map<string, number>();
  let totalDurationMs = 0;

  for (const r of rows ?? []) {
    byType.set(r.type, (byType.get(r.type) ?? 0) + 1);
    totalDurationMs += r.duration_ms ?? 0;
    const storeEntry = byStore.get(r.store_id) ?? { name: r.stores?.name ?? "—", count: 0 };
    storeEntry.count += 1;
    byStore.set(r.store_id, storeEntry);
    if (r.audio_id) byAudio.set(r.audio_id, (byAudio.get(r.audio_id) ?? 0) + 1);
  }

  const topAudioIds = [...byAudio.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const { data: audioFiles } = topAudioIds.length
    ? await supabase
        .from("audio_files")
        .select("id, title, artists(name)")
        .in(
          "id",
          topAudioIds.map(([id]) => id)
        )
    : { data: [] };

  const audioById = new Map((audioFiles ?? []).map((a) => [a.id, a]));
  const topTitles = topAudioIds.map(([id, count]) => ({
    id,
    count,
    title: audioById.get(id)?.title ?? "Titre supprimé",
    artist: (audioById.get(id)?.artists as unknown as { name: string } | null)?.name ?? null,
  }));

  const total = rows?.length ?? 0;
  const maxTitleCount = topTitles[0]?.count ?? 1;
  const topStores = [...byStore.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 10);
  const maxStoreCount = topStores[0]?.[1].count ?? 1;

  const selectClass =
    "rounded-md border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none focus:border-signal";
  const isoFrom = from.toISOString().slice(0, 10);
  const isoTo = (searchParams.to ? to : new Date()).toISOString().slice(0, 10);

  return (
    <div className="p-8">
      <h1 className="text-lg font-medium text-ink-100">Statistiques</h1>
      <p className="mt-1 text-sm text-ink-400">Agrégats calculés sur l&apos;historique des diffusions.</p>

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-ink-700 bg-ink-900 p-4">
        <div>
          <label htmlFor="store_id" className="mb-1.5 block text-xs font-medium text-ink-400">
            Magasin
          </label>
          <select id="store_id" name="store_id" defaultValue={searchParams.store_id ?? ""} className={selectClass}>
            <option value="">Tous</option>
            {(stores ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="from" className="mb-1.5 block text-xs font-medium text-ink-400">
            Du
          </label>
          <input id="from" type="date" name="from" defaultValue={isoFrom} className={selectClass} />
        </div>
        <div>
          <label htmlFor="to" className="mb-1.5 block text-xs font-medium text-ink-400">
            Au
          </label>
          <input id="to" type="date" name="to" defaultValue={isoTo} className={selectClass} />
        </div>
        <button
          type="submit"
          className="rounded-md bg-signal px-4 py-2 text-sm font-medium text-ink-950 transition hover:bg-signal-dim"
        >
          Filtrer
        </button>
        <Link href="/history" className="text-xs text-ink-400 hover:underline">
          Voir le détail dans l&apos;historique
        </Link>
      </form>

      {error && (
        <div className="mt-6 rounded-md border border-status-critical/30 bg-status-critical/10 px-4 py-3 text-sm text-status-critical">
          Erreur : {error.message}
        </div>
      )}

      {!error && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Diffusions" value={total} />
            <StatCard label="Musique" value={byType.get("MUSIC") ?? 0} />
            <StatCard label="Publicités" value={byType.get("ADVERTISEMENT") ?? 0} />
            <StatCard label="Jingles" value={byType.get("JINGLE") ?? 0} />
          </div>
          <div className="mt-3">
            <StatCard label="Temps de diffusion cumulé" value={formatHours(totalDurationMs)} />
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <div>
              <h2 className="mb-2 text-sm font-medium text-ink-200">Top 10 titres</h2>
              <div className="space-y-2 rounded-lg border border-ink-700 bg-ink-950 p-4">
                {topTitles.length === 0 && <p className="text-sm text-ink-500">Aucune donnée sur cette période.</p>}
                {topTitles.map((t) => (
                  <div key={t.id}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="truncate text-ink-200">
                        {t.title}
                        {t.artist ? ` — ${t.artist}` : ""}
                      </span>
                      <span className="ml-2 shrink-0 text-ink-500">{t.count}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded bg-ink-800">
                      <div
                        className="h-1.5 rounded bg-signal"
                        style={{ width: `${(t.count / maxTitleCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="mb-2 text-sm font-medium text-ink-200">Diffusions par magasin</h2>
              <div className="space-y-2 rounded-lg border border-ink-700 bg-ink-950 p-4">
                {topStores.length === 0 && <p className="text-sm text-ink-500">Aucune donnée sur cette période.</p>}
                {topStores.map(([storeId, s]) => (
                  <div key={storeId}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="truncate text-ink-200">{s.name}</span>
                      <span className="ml-2 shrink-0 text-ink-500">{s.count}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded bg-ink-800">
                      <div
                        className="h-1.5 rounded bg-signal"
                        style={{ width: `${(s.count / maxStoreCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
