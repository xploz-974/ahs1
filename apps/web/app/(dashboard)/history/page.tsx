import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 50;

const TYPE_LABEL: Record<string, string> = {
  MUSIC: "Musique",
  ADVERTISEMENT: "Publicité",
  JINGLE: "Jingle",
};

type HistoryRow = {
  id: string;
  type: string;
  played_at: string;
  duration_ms: number | null;
  status: string;
  stores: { name: string } | null;
  players: { name: string } | null;
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(ms: number | null): string {
  if (!ms) return "—";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function buildQuery(params: Record<string, string | undefined>, overrides: Record<string, string | number>) {
  const merged = { ...params, ...overrides };
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `/history?${qs}` : "/history";
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: { store_id?: string; type?: string; from?: string; to?: string; page?: string };
}) {
  const supabase = createClient();

  const { data: stores } = await supabase.from("stores").select("id, name").order("name");

  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("playback_history")
    .select("id, type, played_at, duration_ms, status, stores(name), players(name)", { count: "exact" })
    .order("played_at", { ascending: false })
    .range(from, to);

  if (searchParams.store_id) query = query.eq("store_id", searchParams.store_id);
  if (searchParams.type) query = query.eq("type", searchParams.type);
  if (searchParams.from) query = query.gte("played_at", new Date(searchParams.from).toISOString());
  if (searchParams.to) {
    const toDate = new Date(searchParams.to);
    toDate.setHours(23, 59, 59, 999);
    query = query.lte("played_at", toDate.toISOString());
  }

  const { data: rows, count, error } = await query.returns<HistoryRow[]>();

  const totalPages = count ? Math.max(1, Math.ceil(count / PAGE_SIZE)) : 1;
  const selectClass =
    "rounded-md border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none focus:border-signal";

  return (
    <div className="p-8">
      <h1 className="text-lg font-medium text-ink-100">Historique</h1>
      <p className="mt-1 text-sm text-ink-400">Journal des diffusions remontées par les players.</p>

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
          <label htmlFor="type" className="mb-1.5 block text-xs font-medium text-ink-400">
            Type
          </label>
          <select id="type" name="type" defaultValue={searchParams.type ?? ""} className={selectClass}>
            <option value="">Tous</option>
            <option value="MUSIC">Musique</option>
            <option value="ADVERTISEMENT">Publicité</option>
            <option value="JINGLE">Jingle</option>
          </select>
        </div>
        <div>
          <label htmlFor="from" className="mb-1.5 block text-xs font-medium text-ink-400">
            Du
          </label>
          <input id="from" type="date" name="from" defaultValue={searchParams.from ?? ""} className={selectClass} />
        </div>
        <div>
          <label htmlFor="to" className="mb-1.5 block text-xs font-medium text-ink-400">
            Au
          </label>
          <input id="to" type="date" name="to" defaultValue={searchParams.to ?? ""} className={selectClass} />
        </div>
        <button
          type="submit"
          className="rounded-md bg-signal px-4 py-2 text-sm font-medium text-ink-950 transition hover:bg-signal-dim"
        >
          Filtrer
        </button>
        {(searchParams.store_id || searchParams.type || searchParams.from || searchParams.to) && (
          <Link href="/history" className="text-xs text-ink-400 hover:underline">
            Réinitialiser
          </Link>
        )}
      </form>

      {error && (
        <div className="mt-6 rounded-md border border-status-critical/30 bg-status-critical/10 px-4 py-3 text-sm text-status-critical">
          Erreur : {error.message}
        </div>
      )}

      {!error && (
        <>
          <div className="mt-6 overflow-x-auto rounded-lg border border-ink-700">
            <table className="w-full text-left text-sm">
              <thead className="bg-ink-900 text-xs uppercase tracking-wide text-ink-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Quand</th>
                  <th className="px-4 py-3 font-medium">Magasin</th>
                  <th className="px-4 py-3 font-medium">Player</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Durée</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700 bg-ink-950">
                {(rows ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-3 text-sm text-ink-400">
                      Aucune diffusion pour ces filtres.
                    </td>
                  </tr>
                )}
                {(rows ?? []).map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-mono text-xs text-ink-400">{formatDateTime(r.played_at)}</td>
                    <td className="px-4 py-3 text-ink-300">{r.stores?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-300">{r.players?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-ink-400">{TYPE_LABEL[r.type] ?? r.type}</td>
                    <td className="px-4 py-3 text-xs text-ink-500">{formatDuration(r.duration_ms)}</td>
                    <td className="px-4 py-3 text-xs text-ink-400">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-ink-400">
            <span>
              {count ?? 0} diffusion{(count ?? 0) > 1 ? "s" : ""} — page {page} / {totalPages}
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={buildQuery(searchParams, { page: page - 1 })}
                  className="rounded-md border border-ink-600 px-2.5 py-1 transition hover:bg-ink-800"
                >
                  Précédent
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={buildQuery(searchParams, { page: page + 1 })}
                  className="rounded-md border border-ink-600 px-2.5 py-1 transition hover:bg-ink-800"
                >
                  Suivant
                </Link>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
