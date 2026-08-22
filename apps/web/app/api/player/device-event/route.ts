import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlayerAuth } from "@/lib/api-auth";

interface DeviceEventInput {
  type: "SCREEN_VISIBLE" | "SCREEN_HIDDEN" | "VOLUME_CHANGE" | "PLAY" | "PAUSE" | "TECHNICIAN_MODE_ENTER" | "TECHNICIAN_MODE_EXIT";
  source?: "touch" | "remote" | "system";
  value?: number | null;
  occurred_at?: string;
}

const MAX_EVENTS_PER_REQUEST = 20;

export async function POST(request: Request) {
  const auth = await requirePlayerAuth(request);
  if ("error" in auth) return auth.error;
  const { claims } = auth;

  let body: { events?: DeviceEventInput[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const events = (body.events ?? []).slice(0, MAX_EVENTS_PER_REQUEST);
  if (events.length === 0) {
    return NextResponse.json({ error: "events_required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const rows = events.map((e) => ({
    organization_id: claims.organizationId,
    store_id: claims.storeId,
    player_id: claims.playerId,
    type: e.type,
    source: e.source ?? "touch",
    value: e.value ?? null,
    occurred_at: e.occurred_at ?? new Date().toISOString(),
  }));

  const { error } = await supabase.from("device_events").insert(rows);
  if (error) {
    return NextResponse.json({ error: "insert_failed", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
