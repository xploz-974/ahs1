import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlayerAuth } from "@/lib/api-auth";

interface PlayerZoneRef {
  id: string;
  name: string;
  leader_player_id: string | null;
}

export async function GET(request: Request) {
  const auth = await requirePlayerAuth(request);
  if ("error" in auth) return auth.error;
  const { claims } = auth;

  const supabase = createAdminClient();
  const { data: player, error } = await supabase
    .from("players")
    .select("id, name, type, status, app_version, configuration, zone_id, stores(id, name, timezone), player_zones(id, name, leader_player_id)")
    .eq("id", claims.playerId)
    .eq("organization_id", claims.organizationId)
    .maybeSingle();

  if (error || !player) {
    return NextResponse.json({ error: "player_not_found" }, { status: 404 });
  }

  const zoneRow = player.player_zones as unknown as PlayerZoneRef | null;
  const zone = zoneRow
    ? {
        zoneId: zoneRow.id,
        zoneName: zoneRow.name,
        leaderPlayerId: zoneRow.leader_player_id,
        isLeader: zoneRow.leader_player_id === player.id,
      }
    : null;

  const { player_zones: _playerZones, ...playerFields } = player;

  return NextResponse.json({ player: { ...playerFields, zone } });
}
