"use client";

import { useTransition } from "react";
import { acknowledgeAlert } from "./actions";

export type AlertRow = {
  id: string;
  type: string;
  severity: string;
  message: string | null;
  created_at: string;
  acknowledged_at: string | null;
  players: { name: string } | null;
};

const TYPE_LABEL: Record<string, string> = {
  PLAYER_OFFLINE: "Player hors ligne",
  CACHE_LOW: "Cache faible",
  STORAGE_LOW: "Stockage faible",
  SYNC_FAILED: "Échec de synchronisation",
  NO_CONTENT: "Aucun contenu disponible",
  INVALID_AUDIO: "Fichier audio invalide",
  PLAYER_OUTDATED: "Version obsolète",
  CONNECTION_FAILURE: "Échecs de connexion répétés",
};

const SEVERITY_STYLE: Record<string, string> = {
  INFO: "text-ink-400",
  WARNING: "text-status-warning",
  CRITICAL: "text-status-critical",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function AlertsTable({ alerts }: { alerts: AlertRow[] }) {
  const [pending, startAction] = useTransition();

  return (
    <div className="overflow-hidden rounded-lg border border-ink-700">
      <table className="w-full text-left text-sm">
        <thead className="bg-ink-900 text-xs uppercase tracking-wide text-ink-400">
          <tr>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium">Player</th>
            <th className="px-4 py-3 font-medium">Message</th>
            <th className="px-4 py-3 font-medium">Quand</th>
            <th className="px-4 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-700 bg-ink-950">
          {alerts.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-3 text-sm text-ink-400">
                Aucune alerte active.
              </td>
            </tr>
          )}
          {alerts.map((a) => (
            <tr key={a.id}>
              <td className={`px-4 py-3 text-xs font-medium ${SEVERITY_STYLE[a.severity] ?? "text-ink-300"}`}>
                {TYPE_LABEL[a.type] ?? a.type}
              </td>
              <td className="px-4 py-3 text-ink-100">{a.players?.name ?? "—"}</td>
              <td className="max-w-sm truncate px-4 py-3 text-ink-400">{a.message ?? "—"}</td>
              <td className="px-4 py-3 font-mono text-xs text-ink-500">{formatDateTime(a.created_at)}</td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => startAction(() => acknowledgeAlert(a.id))}
                  className="rounded-md border border-ink-600 px-2.5 py-1 text-xs text-ink-300 transition hover:bg-ink-800"
                >
                  Acquitter
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
