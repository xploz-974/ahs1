"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganizationId } from "@/lib/org";
import { parseAudioBuffer, sha256 } from "@/lib/audio";
import { detectFormat, type AudioFormat } from "@/lib/audio-shared";
import { searchMusicBrainz } from "@/lib/musicbrainz";
import { isSpotifyConfigured, searchSpotify } from "@/lib/spotify";
import type { MetadataCandidate } from "@/lib/metadata-types";

export type UploadState = { error: string | null; success: string | null };

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

export interface FinalizeUploadInput {
  bucket: string;
  storagePath: string;
  category: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

// Le fichier a déjà été envoyé directement du navigateur vers Supabase Storage
// (voir upload-form.tsx) — on ne reçoit ici que des métadonnées, jamais les
// octets du fichier, pour rester sous la limite de payload des Server Actions.
export async function finalizeAudioUpload(input: FinalizeUploadInput): Promise<UploadState> {
  const supabase = createClient();

  const organizationId = await getCurrentOrganizationId(supabase);
  if (!organizationId) {
    return { error: "Aucune organisation associée à ce compte.", success: null };
  }

  if (!input.storagePath.startsWith(`${organizationId}/`)) {
    return { error: "Chemin de stockage invalide.", success: null };
  }

  const format: AudioFormat | null = detectFormat(input.mimeType, input.fileName);
  if (!format) {
    return { error: "Format non supporté (MP3, WAV ou FLAC uniquement).", success: null };
  }

  const { data: downloaded, error: downloadError } = await supabase.storage
    .from(input.bucket)
    .download(input.storagePath);
  if (downloadError || !downloaded) {
    return { error: `Fichier introuvable dans le stockage : ${downloadError?.message ?? ""}`, success: null };
  }

  const buffer = Buffer.from(await downloaded.arrayBuffer());
  const checksum = sha256(buffer);

  let parsed;
  try {
    parsed = await parseAudioBuffer(buffer, input.mimeType || `audio/${format}`);
  } catch {
    await supabase.storage.from(input.bucket).remove([input.storagePath]);
    return { error: "Impossible de lire les métadonnées de ce fichier audio.", success: null };
  }

  const title = parsed.title ?? input.fileName.replace(/\.[^.]+$/, "");
  let artistId: string | null = null;
  let albumId: string | null = null;
  let genreId: string | null = null;
  try {
    artistId = parsed.artist ? await findOrCreateArtist(supabase, organizationId, parsed.artist) : null;
    albumId = parsed.album
      ? await findOrCreateAlbum(supabase, organizationId, parsed.album, artistId)
      : null;
    genreId = parsed.genre ? await findOrCreateGenre(supabase, parsed.genre) : null;
  } catch (e) {
    await supabase.storage.from(input.bucket).remove([input.storagePath]);
    const message = e instanceof Error ? e.message : "erreur inconnue";
    return { error: `Échec de la résolution artiste/album/genre : ${message}`, success: null };
  }

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
    file_size: input.fileSize,
    storage_path: input.storagePath,
    checksum,
    category: input.category,
  });

  if (insertError) {
    await supabase.storage.from(input.bucket).remove([input.storagePath]);
    return { error: `Échec de l'enregistrement : ${insertError.message}`, success: null };
  }

  revalidatePath("/library");
  return { error: null, success: `« ${title} » importé avec succès.` };
}

export interface MetadataSearchResult {
  candidates: MetadataCandidate[];
  spotifyEnabled: boolean;
}

export async function searchMetadata(title: string, artist: string): Promise<MetadataSearchResult> {
  const spotifyEnabled = isSpotifyConfigured();

  const [musicbrainz, spotify] = await Promise.all([
    searchMusicBrainz(title, artist).catch(() => []),
    spotifyEnabled ? searchSpotify(title, artist).catch(() => []) : Promise.resolve([]),
  ]);

  return { candidates: [...spotify, ...musicbrainz], spotifyEnabled };
}

export interface UpdateAudioFileInput {
  id: string;
  title: string;
  artistName: string;
  albumTitle: string;
  genreName: string;
  category: string;
}

export async function updateAudioFile(input: UpdateAudioFileInput): Promise<UploadState> {
  const supabase = createClient();

  const organizationId = await getCurrentOrganizationId(supabase);
  if (!organizationId) {
    return { error: "Aucune organisation associée à ce compte.", success: null };
  }

  const title = input.title.trim();
  if (!title) {
    return { error: "Le titre ne peut pas être vide.", success: null };
  }

  let artistId: string | null = null;
  let albumId: string | null = null;
  let genreId: string | null = null;
  try {
    artistId = input.artistName.trim()
      ? await findOrCreateArtist(supabase, organizationId, input.artistName.trim())
      : null;
    albumId = input.albumTitle.trim()
      ? await findOrCreateAlbum(supabase, organizationId, input.albumTitle.trim(), artistId)
      : null;
    genreId = input.genreName.trim() ? await findOrCreateGenre(supabase, input.genreName.trim()) : null;
  } catch (e) {
    const message = e instanceof Error ? e.message : "erreur inconnue";
    return { error: `Échec de la résolution artiste/album/genre : ${message}`, success: null };
  }

  const { error } = await supabase
    .from("audio_files")
    .update({
      title,
      artist_id: artistId,
      album_id: albumId,
      genre_id: genreId,
      category: input.category,
    })
    .eq("id", input.id);

  if (error) {
    return { error: `Échec de la mise à jour : ${error.message}`, success: null };
  }

  revalidatePath("/library");
  return { error: null, success: `« ${title} » mis à jour.` };
}
