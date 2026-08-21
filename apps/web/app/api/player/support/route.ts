import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlayerAuth } from "@/lib/api-auth";

export async function GET(request: Request) {
  const auth = await requirePlayerAuth(request);
  if ("error" in auth) return auth.error;
  const { claims } = auth;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("support_messages")
    .select("id, sender, body, created_at")
    .eq("store_id", claims.storeId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  return NextResponse.json({ messages: data });
}

export async function POST(request: Request) {
  const auth = await requirePlayerAuth(request);
  if ("error" in auth) return auth.error;
  const { claims } = auth;

  let body: { body?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const text = body.body?.trim();
  if (!text) return NextResponse.json({ error: "body_required" }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase.from("support_messages").insert({
    organization_id: claims.organizationId,
    store_id: claims.storeId,
    sender: "store",
    body: text,
  });

  if (error) return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
