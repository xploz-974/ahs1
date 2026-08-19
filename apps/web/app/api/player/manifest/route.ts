import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlayerAuth } from "@/lib/api-auth";

export async function GET(request: Request) {
  const auth = await requirePlayerAuth(request);
  if ("error" in auth) return auth.error;
  const { claims } = auth;

  const supabase = createAdminClient();
  const { data: manifest } = await supabase
    .from("sync_manifests")
    .select("music_version, advertisements_version, jingles_version, playlist_version, updated_at")
    .eq("store_id", claims.storeId)
    .maybeSingle();

  return NextResponse.json(
    manifest ?? {
      music_version: 0,
      advertisements_version: 0,
      jingles_version: 0,
      playlist_version: 0,
      updated_at: null,
    }
  );
}
