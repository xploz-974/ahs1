import type { SupabaseClient } from "@supabase/supabase-js";

type ManifestField = "music_version" | "advertisements_version" | "jingles_version" | "playlist_version";

// Incrémente un ou plusieurs compteurs de version dans sync_manifests pour un
// magasin donné — c'est ce que le futur AHS1 Sync (Phase 8+) comparera à la
// version locale du player pour savoir quoi retélécharger.
export async function bumpStoreManifest(
  supabase: SupabaseClient,
  storeId: string,
  organizationId: string,
  fields: ManifestField[]
): Promise<void> {
  const { data: existing } = await supabase
    .from("sync_manifests")
    .select("music_version, advertisements_version, jingles_version, playlist_version")
    .eq("store_id", storeId)
    .maybeSingle();

  const base = existing ?? {
    music_version: 0,
    advertisements_version: 0,
    jingles_version: 0,
    playlist_version: 0,
  };

  const update: Record<string, number> = {};
  for (const field of fields) {
    update[field] = (base[field] ?? 0) + 1;
  }

  await supabase
    .from("sync_manifests")
    .upsert(
      { store_id: storeId, organization_id: organizationId, ...base, ...update },
      { onConflict: "store_id" }
    );
}
