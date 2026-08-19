// AHS1 — Audio Hub Stream v1
// Edge Function: ingestion automatique des fichiers déposés directement
// dans un bucket Storage (sans passer par le formulaire d'upload du dashboard).
//
// Déclenchée par un Database Webhook sur storage.objects (INSERT).
// Convention de chemin obligatoire : {organization_id}/{nom-de-fichier}
//
// Utilise la service role key (auto-injectée par Supabase) : contourne
// volontairement les RLS, car l'organization_id est dérivé du chemin de
// stockage (lui-même protégé par les policies storage.objects) plutôt que
// d'une session utilisateur — il n'y a pas d'utilisateur authentifié ici.

import { createClient } from "npm:@supabase/supabase-js@2";
import { parseBuffer } from "npm:music-metadata@10";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CATEGORY_BY_BUCKET: Record<string, string> = {
  "audio-music": "music",
  "audio-jingles": "jingle",
  "audio-advertisements": "advertisement",
};

function detectFormat(objectName: string): "mp3" | "wav" | "flac" | null {
  const ext = objectName.split(".").pop()?.toLowerCase();
  if (ext === "mp3" || ext === "wav" || ext === "flac") return ext;
  return null;
}

async function sha256(buffer: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const record = payload.record as { bucket_id?: string; name?: string; metadata?: { size?: number } } | undefined;

    if (!record?.bucket_id || !record?.name) {
      return new Response("ignored: no record", { status: 200 });
    }

    const category = CATEGORY_BY_BUCKET[record.bucket_id];
    if (!category) {
      return new Response(`ignored: unmanaged bucket ${record.bucket_id}`, { status: 200 });
    }

    const objectName = record.name;
    const organizationId = objectName.split("/")[0];
    if (!organizationId) {
      return new Response("ignored: no organization prefix in path", { status: 200 });
    }

    const format = detectFormat(objectName);
    if (!format) {
      return new Response("ignored: unsupported format", { status: 200 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Idempotence : évite de réingérer un fichier déjà traité (ex. webhook rejoué).
    const { data: existing } = await supabase
      .from("audio_files")
      .select("id")
      .eq("storage_path", objectName)
      .maybeSingle();
    if (existing) {
      return new Response("skipped: already ingested", { status: 200 });
    }

    const { data: downloaded, error: downloadError } = await supabase.storage
      .from(record.bucket_id)
      .download(objectName);
    if (downloadError || !downloaded) {
      return new Response(`download failed: ${downloadError?.message}`, { status: 200 });
    }

    const buffer = new Uint8Array(await downloaded.arrayBuffer());
    const checksum = await sha256(buffer);

    let parsed;
    try {
      parsed = await parseBuffer(buffer, `audio/${format}`, { duration: true });
    } catch (e) {
      return new Response(`metadata parse failed: ${e instanceof Error ? e.message : e}`, { status: 200 });
    }

    const title = parsed.common.title ?? objectName.split("/").pop()!.replace(/\.[^.]+$/, "");
    const artistName = parsed.common.artist ?? null;
    const albumTitle = parsed.common.album ?? null;
    const genreName = parsed.common.genre?.[0] ?? null;

    async function findOrCreateArtist(name: string): Promise<string | null> {
      const { data: found } = await supabase
        .from("artists")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("name", name)
        .maybeSingle();
      if (found) return found.id;
      const { data } = await supabase
        .from("artists")
        .insert({ organization_id: organizationId, name })
        .select("id")
        .single();
      return data?.id ?? null;
    }

    async function findOrCreateAlbum(albTitle: string, artistId: string | null): Promise<string | null> {
      const { data: found } = await supabase
        .from("albums")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("title", albTitle)
        .maybeSingle();
      if (found) return found.id;
      const { data } = await supabase
        .from("albums")
        .insert({ organization_id: organizationId, title: albTitle, artist_id: artistId })
        .select("id")
        .single();
      return data?.id ?? null;
    }

    async function findOrCreateGenre(name: string): Promise<string | null> {
      const { data: found } = await supabase.from("genres").select("id").eq("name", name).maybeSingle();
      if (found) return found.id;
      const { data } = await supabase.from("genres").insert({ name }).select("id").single();
      return data?.id ?? null;
    }

    const artistId = artistName ? await findOrCreateArtist(artistName) : null;
    const albumId = albumTitle ? await findOrCreateAlbum(albumTitle, artistId) : null;
    const genreId = genreName ? await findOrCreateGenre(genreName) : null;

    const { error: insertError } = await supabase.from("audio_files").insert({
      organization_id: organizationId,
      title,
      artist_id: artistId,
      album_id: albumId,
      genre_id: genreId,
      duration_ms: Math.round((parsed.format.duration ?? 0) * 1000),
      format,
      bitrate: parsed.format.bitrate ? Math.round(parsed.format.bitrate) : null,
      sample_rate: parsed.format.sampleRate ?? null,
      file_size: record.metadata?.size ?? buffer.length,
      storage_path: objectName,
      checksum,
      category,
    });

    if (insertError) {
      return new Response(`insert failed: ${insertError.message}`, { status: 200 });
    }

    return new Response(`ok: ingested "${title}"`, { status: 200 });
  } catch (e) {
    return new Response(`unexpected error: ${e instanceof Error ? e.message : e}`, { status: 200 });
  }
});
