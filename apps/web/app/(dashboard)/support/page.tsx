import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default async function SupportPage() {
  const supabase = createClient();

  const { data: messages } = await supabase
    .from("support_messages")
    .select("id, store_id, sender, body, created_at, stores(name)")
    .order("created_at", { ascending: false })
    .limit(500);

  const { data: players } = await supabase.from("players").select("id, store_id");
  const playerByStore = new Map<string, string>();
  for (const p of players ?? []) {
    if (!playerByStore.has(p.store_id)) playerByStore.set(p.store_id, p.id);
  }

  type Thread = {
    storeId: string;
    storeName: string;
    lastBody: string;
    lastSender: string;
    lastAt: string;
    count: number;
  };
  const threads = new Map<string, Thread>();
  for (const m of messages ?? []) {
    const storeName = (m.stores as unknown as { name: string } | null)?.name ?? "—";
    const existing = threads.get(m.store_id);
    if (existing) {
      existing.count += 1;
    } else {
      threads.set(m.store_id, {
        storeId: m.store_id,
        storeName,
        lastBody: m.body,
        lastSender: m.sender,
        lastAt: m.created_at,
        count: 1,
      });
    }
  }
  const list = Array.from(threads.values());

  return (
    <div className="p-8">
      <h1 className="text-lg font-medium text-ink-100">Support</h1>
      <p className="mt-1 text-sm text-ink-400">
        Messagerie datée entre les magasins et l&apos;équipe technique — chaque conversation se traite depuis la
        télécommande du player concerné.
      </p>

      {list.length === 0 && (
        <div className="mt-6 rounded-md border border-ink-700 bg-ink-900 px-4 py-3 text-sm text-ink-400">
          Aucun message de support pour l&apos;instant.
        </div>
      )}

      {list.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-lg border border-ink-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink-900 text-xs uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-4 py-3 font-medium">Magasin</th>
                <th className="px-4 py-3 font-medium">Dernier message</th>
                <th className="px-4 py-3 font-medium">De</th>
                <th className="px-4 py-3 font-medium">Quand</th>
                <th className="px-4 py-3 font-medium">Messages</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700 bg-ink-950">
              {list.map((t) => {
                const playerId = playerByStore.get(t.storeId);
                return (
                  <tr key={t.storeId}>
                    <td className="px-4 py-3 text-ink-100">{t.storeName}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-ink-300">{t.lastBody}</td>
                    <td className="px-4 py-3 text-xs text-ink-400">{t.lastSender === "admin" ? "Technicien" : "Magasin"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-500">{formatDateTime(t.lastAt)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-500">{t.count}</td>
                    <td className="px-4 py-3 text-right">
                      {playerId ? (
                        <Link
                          href={`/players/${playerId}/remote`}
                          className="rounded-md border border-signal/40 px-2.5 py-1 text-xs text-signal transition hover:bg-signal/10"
                        >
                          Répondre
                        </Link>
                      ) : (
                        <span className="text-xs text-ink-600">Aucun player</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
