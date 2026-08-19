"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganizationId } from "@/lib/org";
import { bumpStoreManifest } from "@/lib/manifest";

export type ActionState = { error: string | null; success: string | null };

async function bumpVersion(supabase: ReturnType<typeof createClient>, playlistId: string) {
  const { data } = await supabase.from("playlists").select("version").eq("id", playlistId).single();
  await supabase
    .from("playlists")
    .update({ version: (data?.version ?? 1) + 1 })
    .eq("id", playlistId);
}

// Un changement de contenu de playlist affecte tous les magasins où elle est
// diffusée : on incrémente music_version + playlist_version pour chacun.
async function bumpPlaylistStoresManifest(
  supabase: ReturnType<typeof createClient>,
  playlistId: string,
  organizationId: string
) {
  const { data: stores } = await supabase
    .from("playlist_stores")
    .select("store_id")
    .eq("playlist_id", playlistId);

  for (const s of stores ?? []) {
    await bumpStoreManifest(supabase, s.store_id, organizationId, ["music_version", "playlist_version"]);
  }
}

export async function createPlaylist(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const organizationId = await getCurrentOrganizationId(supabase);
  if (!organizationId) {
    return { error: "Aucune organisation associée à ce compte.", success: null };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "Le nom est obligatoire.", success: null };
  }
  const description = String(formData.get("description") ?? "").trim() || null;

  const { data, error } = await supabase
    .from("playlists")
    .insert({ organization_id: organizationId, name, description })
    .select("id")
    .single();

  if (error) {
    return { error: `Échec de la création : ${error.message}`, success: null };
  }

  redirect(`/playlists/${data.id}`);
}

export async function deletePlaylist(playlistId: string): Promise<void> {
  const supabase = createClient();
  await supabase.from("playlists").delete().eq("id", playlistId);
  revalidatePath("/playlists");
  redirect("/playlists");
}

export async function updatePlaylistMeta(input: {
  id: string;
  name: string;
  description: string;
  priority: number;
}): Promise<ActionState> {
  const supabase = createClient();
  const name = input.name.trim();
  if (!name) {
    return { error: "Le nom est obligatoire.", success: null };
  }

  const { error } = await supabase
    .from("playlists")
    .update({ name, description: input.description.trim() || null, priority: input.priority })
    .eq("id", input.id);

  if (error) {
    return { error: `Échec de la mise à jour : ${error.message}`, success: null };
  }

  revalidatePath(`/playlists/${input.id}`);
  revalidatePath("/playlists");
  return { error: null, success: "Playlist mise à jour." };
}

export async function addTrackToPlaylist(playlistId: string, audioFileId: string): Promise<ActionState> {
  const supabase = createClient();
  const organizationId = await getCurrentOrganizationId(supabase);

  const { data: items } = await supabase
    .from("playlist_items")
    .select("position")
    .eq("playlist_id", playlistId)
    .order("position", { ascending: false })
    .limit(1);

  const nextPosition = (items?.[0]?.position ?? -1) + 1;

  const { error } = await supabase
    .from("playlist_items")
    .insert({ playlist_id: playlistId, audio_file_id: audioFileId, position: nextPosition });

  if (error) {
    return { error: `Échec de l'ajout : ${error.message}`, success: null };
  }

  await bumpVersion(supabase, playlistId);
  if (organizationId) await bumpPlaylistStoresManifest(supabase, playlistId, organizationId);
  revalidatePath(`/playlists/${playlistId}`);
  return { error: null, success: "Titre ajouté." };
}

export async function removeTrackFromPlaylist(playlistId: string, itemId: string): Promise<ActionState> {
  const supabase = createClient();
  const organizationId = await getCurrentOrganizationId(supabase);
  const { error } = await supabase.from("playlist_items").delete().eq("id", itemId);

  if (error) {
    return { error: `Échec de la suppression : ${error.message}`, success: null };
  }

  await bumpVersion(supabase, playlistId);
  if (organizationId) await bumpPlaylistStoresManifest(supabase, playlistId, organizationId);
  revalidatePath(`/playlists/${playlistId}`);
  return { error: null, success: null };
}

export async function reorderTrack(
  playlistId: string,
  itemId: string,
  direction: "up" | "down"
): Promise<ActionState> {
  const supabase = createClient();
  const organizationId = await getCurrentOrganizationId(supabase);

  const { data: items, error } = await supabase
    .from("playlist_items")
    .select("id, position")
    .eq("playlist_id", playlistId)
    .order("position", { ascending: true });

  if (error || !items) {
    return { error: "Impossible de charger la playlist.", success: null };
  }

  const index = items.findIndex((i) => i.id === itemId);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapWith < 0 || swapWith >= items.length) {
    return { error: null, success: null };
  }

  const a = items[index];
  const b = items[swapWith];

  await supabase.from("playlist_items").update({ position: b.position }).eq("id", a.id);
  await supabase.from("playlist_items").update({ position: a.position }).eq("id", b.id);

  await bumpVersion(supabase, playlistId);
  if (organizationId) await bumpPlaylistStoresManifest(supabase, playlistId, organizationId);
  revalidatePath(`/playlists/${playlistId}`);
  return { error: null, success: null };
}

export async function setPlaylistStores(playlistId: string, storeIds: string[]): Promise<ActionState> {
  const supabase = createClient();
  const organizationId = await getCurrentOrganizationId(supabase);

  await supabase.from("playlist_stores").delete().eq("playlist_id", playlistId);

  if (storeIds.length > 0) {
    const { error } = await supabase
      .from("playlist_stores")
      .insert(storeIds.map((storeId) => ({ playlist_id: playlistId, store_id: storeId })));
    if (error) {
      return { error: `Échec de l'affectation : ${error.message}`, success: null };
    }
  }

  await bumpVersion(supabase, playlistId);
  if (organizationId) {
    for (const storeId of storeIds) {
      await bumpStoreManifest(supabase, storeId, organizationId, ["music_version", "playlist_version"]);
    }
  }
  revalidatePath(`/playlists/${playlistId}`);
  return { error: null, success: "Magasins mis à jour." };
}
