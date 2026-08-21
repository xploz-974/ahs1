import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlayerAuth } from "@/lib/api-auth";

export async function GET(request: Request) {
  const auth = await requirePlayerAuth(request);
  if ("error" in auth) return auth.error;
  const { claims } = auth;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("store_contacts")
    .select("id, name")
    .eq("store_id", claims.storeId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  return NextResponse.json({ contacts: data });
}
