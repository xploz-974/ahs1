import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlayerAuth } from "@/lib/api-auth";

export async function GET(request: Request) {
  const auth = await requirePlayerAuth(request);
  if ("error" in auth) return auth.error;
  const { claims } = auth;

  const supabase = createAdminClient();
  const { data: player, error } = await supabase
    .from("players")
    .select("id, name, type, status, app_version, configuration, stores(id, name, timezone)")
    .eq("id", claims.playerId)
    .eq("organization_id", claims.organizationId)
    .maybeSingle();

  if (error || !player) {
    return NextResponse.json({ error: "player_not_found" }, { status: 404 });
  }

  return NextResponse.json({ player });
}
