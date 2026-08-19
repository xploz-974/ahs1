import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlayerAuth } from "@/lib/api-auth";
import { CATEGORY_BUCKET } from "@/lib/audio-shared";

interface AudioFileRef {
  id: string;
  title: string;
  category: string;
  storage_path: string;
  checksum: string;
  file_size: number;
  format: string;
  duration_ms: number;
  trim_start_ms: number;
  trim_end_ms: number | null;
  fade_in_ms: number;
  fade_out_ms: number;
}

export async function GET(request: Request) {
  const auth = await requirePlayerAuth(request);
  if ("error" in auth) return auth.error;
  const { claims } = auth;

  const supabase = createAdminClient();
  const filesById = new Map<string, AudioFileRef>();

  // Musique : fichiers des playlists affectées à ce magasin.
  const { data: playlistLinks } = await supabase
    .from("playlist_stores")
    .select("playlists(playlist_items(audio_files(*)))")
    .eq("store_id", claims.storeId);

  for (const link of playlistLinks ?? []) {
    const playlist = link.playlists as unknown as {
      playlist_items: { audio_files: AudioFileRef | null }[];
    } | null;
    for (const item of playlist?.playlist_items ?? []) {
      if (item.audio_files) filesById.set(item.audio_files.id, item.audio_files);
    }
  }

  // Jingles actifs de ce magasin.
  const { data: jingleRows } = await supabase
    .from("jingles")
    .select("audio_files(*)")
    .eq("store_id", claims.storeId)
    .eq("status", "ACTIVE");

  for (const row of jingleRows ?? []) {
    const f = row.audio_files as unknown as AudioFileRef | null;
    if (f) filesById.set(f.id, f);
  }

  // Publicités des campagnes actives ciblant ce magasin.
  const today = new Date().toISOString().slice(0, 10);
  const { data: campaignLinks } = await supabase
    .from("campaign_stores")
    .select("advertisement_campaigns(status, start_date, end_date, advertisement_assets(audio_files(*)))")
    .eq("store_id", claims.storeId);

  for (const link of campaignLinks ?? []) {
    const campaign = link.advertisement_campaigns as unknown as {
      status: string;
      start_date: string;
      end_date: string;
      advertisement_assets: { audio_files: AudioFileRef | null }[];
    } | null;
    if (!campaign || campaign.status !== "ACTIVE" || campaign.start_date > today || campaign.end_date < today) {
      continue;
    }
    for (const asset of campaign.advertisement_assets ?? []) {
      if (asset.audio_files) filesById.set(asset.audio_files.id, asset.audio_files);
    }
  }

  const files = await Promise.all(
    Array.from(filesById.values()).map(async (f) => {
      const bucket = CATEGORY_BUCKET[f.category];
      let signedUrl: string | null = null;
      if (bucket) {
        const { data } = await supabase.storage.from(bucket).createSignedUrl(f.storage_path, 3600);
        signedUrl = data?.signedUrl ?? null;
      }
      return {
        id: f.id,
        title: f.title,
        category: f.category,
        format: f.format,
        checksum: f.checksum,
        size: f.file_size,
        duration_ms: f.duration_ms,
        trim_start_ms: f.trim_start_ms,
        trim_end_ms: f.trim_end_ms,
        fade_in_ms: f.fade_in_ms,
        fade_out_ms: f.fade_out_ms,
        url: signedUrl,
      };
    })
  );

  const { data: manifest } = await supabase
    .from("sync_manifests")
    .select("music_version, advertisements_version, jingles_version, playlist_version")
    .eq("store_id", claims.storeId)
    .maybeSingle();

  return NextResponse.json({ manifest: manifest ?? null, files });
}
