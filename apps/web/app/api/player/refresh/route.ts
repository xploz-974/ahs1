import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashRefreshToken, signPlayerAccessToken } from "@/lib/player-auth";

export async function POST(request: Request) {
  let body: { refresh_token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const refreshToken = body.refresh_token?.trim();
  if (!refreshToken) {
    return NextResponse.json({ error: "refresh_token_required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const tokenHash = hashRefreshToken(refreshToken);

  const { data: tokenRow, error } = await supabase
    .from("player_tokens")
    .select("id, player_id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !tokenRow || tokenRow.revoked_at || new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.json({ error: "invalid_or_expired_refresh_token" }, { status: 401 });
  }

  const { data: player } = await supabase
    .from("players")
    .select("id, organization_id, store_id, status")
    .eq("id", tokenRow.player_id)
    .maybeSingle();

  if (!player || player.status === "ERROR") {
    return NextResponse.json({ error: "player_not_found" }, { status: 404 });
  }

  const accessToken = await signPlayerAccessToken({
    playerId: player.id,
    organizationId: player.organization_id,
    storeId: player.store_id,
  });

  return NextResponse.json({ access_token: accessToken, expires_in: 3600 });
}
