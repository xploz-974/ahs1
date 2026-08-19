import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlayerAuth } from "@/lib/api-auth";

interface HeartbeatBody {
  network?: string;
  current_track?: string;
  current_ad?: string;
  storage_available?: number;
  cache_status?: string;
  app_version?: string;
}

const CACHE_STATUS_TO_PLAYER_STATUS: Record<string, string> = {
  OK: "ONLINE",
  LOW: "OFFLINE_CRITICAL",
  CRITICAL: "OFFLINE_CRITICAL",
};

export async function POST(request: Request) {
  const auth = await requirePlayerAuth(request);
  if ("error" in auth) return auth.error;
  const { claims } = auth;

  let body: HeartbeatBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { error: insertError } = await supabase.from("player_heartbeats").insert({
    player_id: claims.playerId,
    network: body.network ?? null,
    current_track: body.current_track ?? null,
    current_ad: body.current_ad ?? null,
    storage_available: body.storage_available ?? null,
    cache_status: body.cache_status ?? null,
    app_version: body.app_version ?? null,
  });
  if (insertError) {
    return NextResponse.json({ error: "heartbeat_insert_failed" }, { status: 500 });
  }

  const status = body.cache_status ? CACHE_STATUS_TO_PLAYER_STATUS[body.cache_status] ?? "ONLINE" : "ONLINE";

  await supabase
    .from("players")
    .update({
      last_seen: new Date().toISOString(),
      app_version: body.app_version ?? undefined,
      status,
    })
    .eq("id", claims.playerId);

  if (body.cache_status === "LOW" || body.cache_status === "CRITICAL") {
    await supabase.from("player_alerts").insert({
      organization_id: claims.organizationId,
      player_id: claims.playerId,
      type: "CACHE_LOW",
      severity: body.cache_status === "CRITICAL" ? "CRITICAL" : "WARNING",
      message: `Cache status: ${body.cache_status}`,
    });
  }

  return NextResponse.json({ ok: true, status });
}
