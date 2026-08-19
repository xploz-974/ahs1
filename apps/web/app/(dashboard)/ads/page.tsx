import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CreateCampaignForm } from "./create-campaign-form";

type CampaignRow = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  priority: number;
  advertisers: { name: string } | null;
  advertisement_assets: { id: string }[];
  campaign_stores: { store_id: string }[];
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  PAUSED: "En pause",
  ENDED: "Terminée",
};

const STATUS_CLASS: Record<string, string> = {
  ACTIVE: "text-status-online",
  PAUSED: "text-status-warning",
  ENDED: "text-ink-500",
};

export default async function AdsPage() {
  const supabase = createClient();

  const { data: campaigns, error } = await supabase
    .from("advertisement_campaigns")
    .select(
      "id, name, start_date, end_date, status, priority, advertisers(name), advertisement_assets(id), campaign_stores(store_id)"
    )
    .order("start_date", { ascending: false })
    .returns<CampaignRow[]>();

  return (
    <div className="p-8">
      <h1 className="text-lg font-medium text-ink-100">Publicités</h1>
      <p className="mt-1 text-sm text-ink-400">Campagnes publicitaires par client, ciblées par magasin.</p>

      <div className="mt-6">
        <CreateCampaignForm />
      </div>

      {error && (
        <div className="mt-6 rounded-md border border-status-critical/30 bg-status-critical/10 px-4 py-3 text-sm text-status-critical">
          Erreur : {error.message}
        </div>
      )}

      {!error && campaigns && campaigns.length === 0 && (
        <div className="mt-6 rounded-md border border-ink-700 bg-ink-900 px-4 py-3 text-sm text-ink-400">
          Aucune campagne pour l&apos;instant.
        </div>
      )}

      {!error && campaigns && campaigns.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-lg border border-ink-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink-900 text-xs uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-4 py-3 font-medium">Campagne</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Période</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Audios</th>
                <th className="px-4 py-3 font-medium">Magasins</th>
                <th className="px-4 py-3 font-medium">Priorité</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700 bg-ink-950">
              {campaigns.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 text-ink-100">
                    <Link href={`/ads/${c.id}`} className="hover:text-signal">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-300">{c.advertisers?.name ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-400">
                    {c.start_date} → {c.end_date}
                  </td>
                  <td className={`px-4 py-3 text-xs font-medium ${STATUS_CLASS[c.status] ?? "text-ink-400"}`}>
                    {STATUS_LABEL[c.status] ?? c.status}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-400">{c.advertisement_assets.length}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-400">{c.campaign_stores.length}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-400">{c.priority}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
