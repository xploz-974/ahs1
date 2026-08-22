"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { ALERT_TYPE_LABEL } from "@/lib/alert-labels";

type RuleMap = Record<string, { sound: boolean; push: boolean }>;

interface AlertPayload {
  type: string;
  message: string | null;
  severity: string;
}

// Monté une seule fois dans le layout dashboard : écoute en direct les
// nouvelles alertes (Postgres Changes sur player_alerts) et les restitue en
// son + notification navigateur selon les réglages de Paramètres > Notifications
// — c'est la seule façon dont l'anti-vol se manifeste : jamais sur l'appareil
// du magasin, toujours ici, sur l'interface du technicien.
export function LiveNotifications({ organizationId, rules }: { organizationId: string; rules: RuleMap }) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rulesRef = useRef(rules);
  rulesRef.current = rules;

  useEffect(() => {
    if (!organizationId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`org-alerts-${organizationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "player_alerts", filter: `organization_id=eq.${organizationId}` },
        ({ new: alert }: { new: AlertPayload }) => {
          const rule = rulesRef.current[alert.type] ?? { sound: true, push: false };
          if (rule.sound) playBeep();
          if (rule.push && typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            new Notification(ALERT_TYPE_LABEL[alert.type as keyof typeof ALERT_TYPE_LABEL] ?? alert.type, {
              body: alert.message ?? undefined,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId]);

  function playBeep() {
    if (typeof window === "undefined") return;
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = audioCtxRef.current ?? new Ctor();
    audioCtxRef.current = ctx;
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
    gain.connect(ctx.destination);
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(720, now);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.6);
  }

  return null;
}
