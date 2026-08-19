"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganizationId } from "@/lib/org";
import { detectFormat, parseAudioBuffer, sha256, type AudioFormat } from "@/lib/audio";

export type UploadState = { error: string | null; success: string | null };

const CATEGORY_BUCKET: Record<string, string> = {
  music: "audio-music",
  jingle: "audio-jingles",
  advertisement: "audio-advertisements",
};

async function findOrCreateArtist(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  name: string
): Promise<string> {
  const { data: existing } = await supabase
    .from("artists")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("name", name)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("artists")
    .insert({ organization_id: organizationId, name })
    .select("id")
    .single();
  if (error) throw error;
  return created.id;
}

async function findOrCreateGenre(
  supabase: ReturnType<typeof createClient>,
  name: string
): Promise<string> {
  const { data: existing } = await supabase
    .from("genres")
    .select("id")
    .eq("name", name)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("genres")
    .insert({ name })
    .select("id")
    .single();
  if (error) throw error;
  return created.id;
}

async function findOrCreateAlbum(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  title: string,
  artistId: string | null
): Promise<string> {
  const { data: existing } = await supabase
    .from("albums")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("title", title)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("albums")
    .insert({ organization_id: organizationId, title, artist_id: artistId })
    .select("id")
    .single();
  if (error) throw error;
  return created.id;
}

export async function uploadAudioFile(
  _prevState: UploadState,
  formData: FormData
): Promise<UploadState> {
  const supabase = createClient();

  const organizationId = await getCurrentOrganizationId(supabase);
  if (!organizationId) {
    return { error: "Aucune organisation associée à ce compte.", success: null };
  }

  const file = formData.get("file");
  const category = String(formData.get("category") ?? "music");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Sélectionne un fichier audio.", success: null };
  }

  const format: AudioFormat | null = detectFormat(file.type, file.name);
  if (!format) {
    return { error: "Format non supporté (MP3, WAV ou FLAC uniquement).", success: null };
  }

  const bucket = CATEGORY_BUCKET[category];
  if (!bucket) {
    return { error: "Catégorie invalide.", success: null };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const checksum = sha256(buffer);

  let parsed;
  try {
    parsed = await parseAudioBuffer(buffer, file.type || `audio/${format}`);
  } catch {
    return { error: "Impossible de lire les métadonnées de ce fichier audio.", success: null };
  }

  const storagePath = `${organizationId}/${randomUUID()}-${file.name}`;

  const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, buffer, {
    contentType: file.type || `audio/${format}`,
    upsert: false,
  });
  if (uploadError) {
    return { error: `Échec de l'upload : ${uploadError.message}`, success: null };
  }

  const title = parsed.title ?? file.name.replace(/\.[^.]+$/, "");
  const artistId = parsed.artist
    ? await findOrCreateArtist(supabase, organizationId, parsed.artist)
    : null;
  const albumId = parsed.album
    ? await findOrCreateAlbum(supabase, organizationId, parsed.album, artistId)
    : null;
  const genreId = parsed.genre ? await findOrCreateGenre(supabase, parsed.genre) : null;

  const { error: insertError } = await supabase.from("audio_files").insert({
    organization_id: organizationId,
    title,
    artist_id: artistId,
    album_id: albumId,
    genre_id: genreId,
    duration_ms: parsed.durationMs,
    format,
    bitrate: parsed.bitrate,
    sample_rate: parsed.sampleRate,
    file_size: file.size,
    storage_path: storagePath,
    checksum,
    category,
  });

  if (insertError) {
    // Nettoyage : ne pas laisser un fichier orphelin sans entrée DB.
    await supabase.storage.from(bucket).remove([storagePath]);
    return { error: `Échec de l'enregistrement : ${insertError.message}`, success: null };
  }

  revalidatePath("/library");
  return { error: null, success: `« ${title} » importé avec succès.` };
}
