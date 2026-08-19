import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganizationId } from "@/lib/org";
import { PlaylistEditor, type PlaylistItemRow, type StoreOption, type TrackOption } from "./playlist-editor";

export default async function PlaylistDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const organizationId = await getCurrentOrganizationId(supabase);

  const { data: playlist } = await supabase
    .from("playlists")
    .select("id, name, description, priority, version")
    .eq("id", params.id)
    .maybeSingle();

  if (!playlist) notFound();

  const { data: items } = await supabase
    .from("playlist_items")
    .select("id, position, audio_files(id, title, duration_ms, artists(name))")
    .eq("playlist_id", params.id)
    .order("position", { ascending: true })
    .returns<PlaylistItemRow[]>();

  const { data: stores } = await supabase
    .from("stores")
    .select("id, name")
    .order("name")
    .returns<StoreOption[]>();

  const { data: assignedStores } = await supabase
    .from("playlist_stores")
    .select("store_id")
    .eq("playlist_id", params.id);

  const { data: audioFiles } = await supabase
    .from("audio_files")
    .select("id, title, artists(name)")
    .eq("organization_id", organizationId ?? "")
    .eq("category", "music")
    .order("title")
    .returns<TrackOption[]>();

  return (
    <div className="p-8">
      <PlaylistEditor
        playlist={playlist}
        items={items ?? []}
        stores={stores ?? []}
        assignedStoreIds={(assignedStores ?? []).map((s) => s.store_id)}
        availableTracks={audioFiles ?? []}
      />
    </div>
  );
}
