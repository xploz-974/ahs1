import { createClient } from "@/lib/supabase/server";
import { reconcileOfflineAlerts } from "./actions";
import { AlertsTable, type AlertRow } from "./alerts-table";

export default async function AlertsPage() {
  await reconcileOfflineAlerts();

  const supabase = createClient();

  const { data: active } = await supabase
    .from("player_alerts")
    .select("id, type, severity, message, created_at, acknowledged_at, players(name)")
    .is("acknowledged_at", null)
    .order("created_at", { ascending: false })
    .returns<AlertRow[]>();

  const { data: resolved } = await supabase
    .from("player_alerts")
    .select("id, type, severity, message, created_at, acknowledged_at, players(name)")
    .not("acknowledged_at", "is", null)
    .order("acknowledged_at", { ascending: false })
    .limit(20)
    .returns<AlertRow[]>();

  return (
    <div className="p-8">
      <h1 className="text-lg font-medium text-ink-100">Alertes</h1>
      <p className="mt-1 text-sm text-ink-400">
        Players hors ligne, cache faible, synchronisation en échec — vérifié à chaque visite de cette page.
      </p>

      <h2 className="mb-2 mt-6 text-sm font-medium text-ink-200">Actives ({active?.length ?? 0})</h2>
      <AlertsTable alerts={active ?? []} />

      <h2 className="mb-2 mt-8 text-sm font-medium text-ink-200">Résolues récemment</h2>
      <div className="overflow-hidden rounded-lg border border-ink-700 opacity-60">
        <table className="w-full text-left text-sm">
          <tbody className="divide-y divide-ink-700 bg-ink-950">
            {(resolved ?? []).length === 0 && (
              <tr>
                <td className="px-4 py-3 text-sm text-ink-500">Rien à afficher.</td>
              </tr>
            )}
            {(resolved ?? []).map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-3 text-xs text-ink-400">{a.players?.name ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-ink-500">{a.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
