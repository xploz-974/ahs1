import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateRefreshToken, signPlayerAccessToken, REFRESH_TOKEN_TTL_DAYS } from "@/lib/player-auth";

export async function POST(request: Request) {
  let body: { activation_code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const activationCode = body.activation_code?.trim();
  if (!activationCode) {
    return NextResponse.json({ error: "activation_code_required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  type PlayerWithStore = {
    id: string;
    organization_id: string;
    store_id: string;
    name: string;
    type: string;
    status: string;
    activation_code_expires_at: string | null;
    stores: { name: string } | null;
  };

  const { data: player, error } = await supabase
    .from("players")
    .select("id, organization_id, store_id, name, type, status, activation_code_expires_at, stores(name)")
    .eq("activation_code", activationCode)
    .maybeSingle()
    .returns<PlayerWithStore>();

  if (error || !player) {
    return NextResponse.json({ error: "invalid_activation_code" }, { status: 404 });
  }

  if (player.status !== "PENDING") {
    return NextResponse.json({ error: "already_activated" }, { status: 409 });
  }

  if (player.activation_code_expires_at && new Date(player.activation_code_expires_at) < new Date()) {
    return NextResponse.json({ error: "activation_code_expired" }, { status: 410 });
  }

  // Transition atomique PENDING -> ONLINE : deux requêtes d'activation
  // simultanées avec le même code ne doivent produire qu'un seul jeu de
  // tokens valide. La condition .eq("status", "PENDING") fait que seule la
  // première requête à committer affecte une ligne ; la seconde reçoit un
  // tableau vide et échoue proprement au lieu d'émettre un second token.
  const { data: activated, error: updateError } = await supabase
    .from("players")
    .update({
      status: "ONLINE",
      activated_at: new Date().toISOString(),
      activation_code: null,
      activation_code_expires_at: null,
      last_seen: new Date().toISOString(),
    })
    .eq("id", player.id)
    .eq("status", "PENDING")
    .select("id")
    .maybeSingle();

  if (updateError) {
    return NextResponse.json({ error: "activation_failed" }, { status: 500 });
  }
  if (!activated) {
    return NextResponse.json({ error: "already_activated" }, { status: 409 });
  }

  const accessToken = await signPlayerAccessToken({
    playerId: player.id,
    organizationId: player.organization_id,
    storeId: player.store_id,
  });

  const { token: refreshToken, hash: refreshTokenHash } = generateRefreshToken();
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { error: tokenError } = await supabase.from("player_tokens").insert({
    player_id: player.id,
    token_hash: refreshTokenHash,
    expires_at: refreshExpiresAt,
  });
  if (tokenError) {
    return NextResponse.json({ error: "token_persist_failed" }, { status: 500 });
  }

  return NextResponse.json({
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: 3600,
    player: {
      id: player.id,
      name: player.name,
      type: player.type,
      store: player.stores?.name ?? null,
    },
  });
}
