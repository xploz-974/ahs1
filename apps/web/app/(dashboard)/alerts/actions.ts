"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganizationId } from "@/lib/org";
import { computeLiveStatus } from "@/lib/player-status";

// Pas de cron dans cette version : on réconcilie les alertes PLAYER_OFFLINE
// "à la lecture", à chaque visite du dashboard — suffisant pour du monitoring
// consulté régulièrement, quitte à ajouter un job planifié plus tard (Phase
// suivante) pour une détection en continu sans dépendre d'une visite admin.
export async function reconcileOfflineAlerts(): Promise<void> {
  const supabase = createClient();
  const organizationId = await getCurrentOrganizationId(supabase);
  if (!organizationId) return;

  const { data: players } = await supabase
    .from("players")
    .select("id, status, last_seen")
    .eq("organization_id", organizationId)
    .neq("status", "PENDING");

  if (!players || players.length === 0) return;

  const { data: heartbeats } = await supabase
    .from("player_heartbeats")
    .select("player_id, cache_status, received_at")
    .in(
      "player_id",
      players.map((p) => p.id)
    )
    .order("received_at", { ascending: false });

  const lastCacheStatusByPlayer = new Map<string, string | null>();
  for (const h of heartbeats ?? []) {
    if (!lastCacheStatusByPlayer.has(h.player_id)) {
      lastCacheStatusByPlayer.set(h.player_id, h.cache_status);
    }
  }

  for (const player of players) {
    const live = computeLiveStatus({
      status: player.status,
      lastSeen: player.last_seen,
      lastCacheStatus: lastCacheStatusByPlayer.get(player.id) ?? null,
    });

    if (live !== "ERROR") continue;

    // Évite de spammer : une seule alerte PLAYER_OFFLINE non acquittée à la fois.
    const { data: existing } = await supabase
      .from("player_alerts")
      .select("id")
      .eq("player_id", player.id)
      .eq("type", "PLAYER_OFFLINE")
      .is("acknowledged_at", null)
      .maybeSingle();

    if (!existing) {
      await supabase.from("player_alerts").insert({
        organization_id: organizationId,
        player_id: player.id,
        type: "PLAYER_OFFLINE",
        severity: "CRITICAL",
        message: `Aucun contact depuis plus de 30 minutes (dernier : ${player.last_seen ?? "jamais"}).`,
      });
    }
  }
}

export async function acknowledgeAlert(alertId: string): Promise<void> {
  const supabase = createClient();
  await supabase.from("player_alerts").update({ acknowledged_at: new Date().toISOString() }).eq("id", alertId);
  revalidatePath("/alerts");
  revalidatePath("/");
}
