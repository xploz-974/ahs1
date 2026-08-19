import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CreatePlaylistForm } from "./create-playlist-form";

type PlaylistRow = {
  id: string;
  name: string;
  description: string | null;
  priority: number;
  version: number;
  playlist_items: { id: string }[];
  playlist_stores: { store_id: string }[];
};

export default async function PlaylistsPage() {
  const supabase = createClient();

  const { data: playlists, error } = await supabase
    .from("playlists")
    .select("id, name, description, priority, version, playlist_items(id), playlist_stores(store_id)")
    .order("name")
    .returns<PlaylistRow[]>();

  return (
    <div className="p-8">
      <h1 className="text-lg font-medium text-ink-100">Playlists</h1>
      <p className="mt-1 text-sm text-ink-400">
        Composer, réordonner et affecter des playlists aux magasins.
      </p>

      <div className="mt-6">
        <CreatePlaylistForm />
      </div>

      {error && (
        <div className="mt-6 rounded-md border border-status-critical/30 bg-status-critical/10 px-4 py-3 text-sm text-status-critical">
          Erreur : {error.message}
        </div>
      )}

      {!error && playlists && playlists.length === 0 && (
        <div className="mt-6 rounded-md border border-ink-700 bg-ink-900 px-4 py-3 text-sm text-ink-400">
          Aucune playlist pour l&apos;instant.
        </div>
      )}

      {!error && playlists && playlists.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-lg border border-ink-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink-900 text-xs uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-4 py-3 font-medium">Nom</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Titres</th>
                <th className="px-4 py-3 font-medium">Magasins</th>
                <th className="px-4 py-3 font-medium">Priorité</th>
                <th className="px-4 py-3 font-medium">Version</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700 bg-ink-950">
              {playlists.map((p) => (
                <tr key={p.id} className="cursor-pointer hover:bg-ink-900">
                  <td className="px-4 py-3 text-ink-100">
                    <Link href={`/playlists/${p.id}`} className="hover:text-signal">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-300">{p.description ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-400">{p.playlist_items.length}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-400">{p.playlist_stores.length}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-400">{p.priority}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-600">v{p.version}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
