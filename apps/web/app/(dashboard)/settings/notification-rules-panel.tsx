"use client";

import { useState, useTransition } from "react";
import { setNotificationRule } from "./actions";
import { ALERT_TYPES, ALERT_TYPE_LABEL } from "@/lib/alert-labels";

export type NotificationRuleRow = {
  alert_type: string;
  sound_enabled: boolean;
  browser_push_enabled: boolean;
};

export function NotificationRulesPanel({ rules }: { rules: NotificationRuleRow[] }) {
  const byType = new Map(rules.map((r) => [r.alert_type, r]));
  const [pushPermission, setPushPermission] = useState<NotificationPermission | "unsupported">(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported"
  );
  const [pending, startAction] = useTransition();

  async function requestPushPermission() {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPushPermission(result);
  }

  return (
    <div className="rounded-lg border border-ink-700 bg-ink-900 p-4">
      <p className="mb-3 text-xs text-ink-400">
        Ces alertes ne sonnent jamais sur l&apos;appareil du magasin — uniquement ici, sur ton interface, tant que
        cette page reste ouverte (son) ou via une notification navigateur (même onglet en arrière-plan).
      </p>

      {pushPermission !== "granted" && pushPermission !== "unsupported" && (
        <button
          type="button"
          onClick={requestPushPermission}
          className="mb-3 rounded-md border border-ink-600 px-3 py-1.5 text-xs text-ink-200 transition hover:bg-ink-800"
        >
          Activer les notifications navigateur
        </button>
      )}

      <div className="overflow-hidden rounded-lg border border-ink-700">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-950 text-xs uppercase tracking-wide text-ink-400">
            <tr>
              <th className="px-4 py-2 font-medium">Alerte</th>
              <th className="px-4 py-2 font-medium">Son</th>
              <th className="px-4 py-2 font-medium">Notification navigateur</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-700 bg-ink-950">
            {ALERT_TYPES.map((type) => {
              const rule = byType.get(type);
              const soundEnabled = rule?.sound_enabled ?? true;
              const pushEnabled = rule?.browser_push_enabled ?? false;
              return (
                <tr key={type}>
                  <td className="px-4 py-2 text-ink-200">{ALERT_TYPE_LABEL[type]}</td>
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={soundEnabled}
                      disabled={pending}
                      onChange={(e) =>
                        startAction(async () => {
                          await setNotificationRule(type, { soundEnabled: e.target.checked });
                        })
                      }
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={pushEnabled}
                      disabled={pending || pushPermission !== "granted"}
                      onChange={(e) =>
                        startAction(async () => {
                          await setNotificationRule(type, { browserPushEnabled: e.target.checked });
                        })
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
