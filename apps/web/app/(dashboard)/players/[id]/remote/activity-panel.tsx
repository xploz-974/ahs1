import { getPlayerTimeline } from "./actions";
import { describeEntry, diagnose, type TimelineEntry } from "@/lib/activity-diagnostics";

export async function ActivityPanel({ playerId }: { playerId: string }) {
  const { playback, deviceEvents } = await getPlayerTimeline(playerId);

  const entries: TimelineEntry[] = [
    ...playback.map((p) => ({ id: p.id, at: p.played_at, kind: "playback" as const, playbackType: p.type })),
    ...deviceEvents.map((e) => ({
      id: e.id,
      at: e.occurred_at,
      kind: "device" as const,
      deviceType: e.type as TimelineEntry["deviceType"],
      source: e.source as TimelineEntry["source"],
      value: e.value,
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const explanation = diagnose(entries);

  return (
    <div className="mt-6 rounded-lg border border-ink-700 bg-ink-900">
      <div className="border-b border-ink-700 px-4 py-3">
        <p className="text-sm font-medium text-ink-100">Journal d&apos;activité</p>
      </div>

      {explanation && (
        <div className="mx-4 mt-3 rounded-md border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs text-status-warning">
          💡 {explanation}
        </div>
      )}

      <div className="max-h-72 overflow-y-auto p-4">
        {entries.length === 0 && <p className="text-xs text-ink-500">Aucune activité enregistrée pour l&apos;instant.</p>}
        <ul className="space-y-1.5">
          {entries.map((e) => (
            <li key={e.id} className="text-xs text-ink-300">
              {describeEntry(e)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
