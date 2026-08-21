import { getRecentActivity } from "./actions";

const TYPE_LABEL: Record<string, string> = {
  MUSIC: "🎵 Musique",
  ADVERTISEMENT: "📢 Publicité",
  JINGLE: "🎙️ Jingle",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export async function ActivityPanel({ storeId }: { storeId: string }) {
  const activity = await getRecentActivity(storeId);

  return (
    <div className="mt-6 rounded-lg border border-ink-700 bg-ink-900">
      <div className="border-b border-ink-700 px-4 py-3">
        <p className="text-sm font-medium text-ink-100">Activité récente</p>
      </div>
      <div className="max-h-64 overflow-y-auto p-4">
        {activity.length === 0 && <p className="text-xs text-ink-500">Aucune activité enregistrée pour l&apos;instant.</p>}
        <ul className="space-y-1.5">
          {activity.map((a) => (
            <li key={a.id} className="flex items-center justify-between text-xs">
              <span className="text-ink-300">{TYPE_LABEL[a.type] ?? a.type}</span>
              <span className="font-mono text-ink-500">{formatDateTime(a.played_at)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
