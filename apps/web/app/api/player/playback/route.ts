import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlayerAuth } from "@/lib/api-auth";

interface PlaybackEvent {
  client_event_id: string;
  type: "MUSIC" | "ADVERTISEMENT" | "JINGLE";
  audio_id?: string | null;
  campaign_id?: string | null;
  played_at: string;
  duration_ms?: number | null;
  status?: string;
}

export async function POST(request: Request) {
  const auth = await requirePlayerAuth(request);
  if ("error" in auth) return auth.error;
  const { claims } = auth;

  let body: { events?: PlaybackEvent[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const events = body.events ?? [];
  if (events.length === 0) {
    return NextResponse.json({ error: "events_required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const rows = events.map((e) => ({
    organization_id: claims.organizationId,
    store_id: claims.storeId,
    player_id: claims.playerId,
    type: e.type,
    audio_id: e.audio_id ?? null,
    campaign_id: e.campaign_id ?? null,
    played_at: e.played_at,
    duration_ms: e.duration_ms ?? null,
    status: e.status ?? "COMPLETED",
    client_event_id: e.client_event_id,
  }));

  // upsert idempotent sur (player_id, client_event_id) — un renvoi après
  // coupure réseau ne crée jamais de doublon (§29).
  const { error, count } = await supabase
    .from("playback_history")
    .upsert(rows, { onConflict: "player_id,client_event_id", ignoreDuplicates: true, count: "exact" });

  if (error) {
    return NextResponse.json({ error: "playback_insert_failed", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, received: events.length, inserted: count ?? null });
}
