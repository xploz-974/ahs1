import { createClient } from "@/lib/supabase/server";

type StoreRow = {
  id: string;
  name: string;
  region: string | null;
  timezone: string;
  organizations: { name: string } | null;
};

export default async function DashboardHomePage() {
  const supabase = createClient();

  const { data: stores, error } = await supabase
    .from("stores")
    .select("id, name, region, timezone, organizations(name)")
    .order("name")
    .returns<StoreRow[]>();

  return (
    <div className="p-8">
      <h1 className="text-lg font-medium text-ink-100">Magasins</h1>
      <p className="mt-1 text-sm text-ink-400">
        Visible grâce aux règles RLS de ton organisation — si cette liste est vide ou en
        erreur, vérifie que ton compte est bien lié via <code className="font-mono text-ink-300">organization_members</code>.
      </p>

      {error && (
        <div className="mt-6 rounded-md border border-status-critical/30 bg-status-critical/10 px-4 py-3 text-sm text-status-critical">
          Erreur RLS/requête : {error.message}
        </div>
      )}

      {!error && stores?.length === 0 && (
        <div className="mt-6 rounded-md border border-ink-700 bg-ink-900 px-4 py-3 text-sm text-ink-400">
          Aucun magasin visible pour ce compte.
        </div>
      )}

      {!error && stores && stores.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-lg border border-ink-700">
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
