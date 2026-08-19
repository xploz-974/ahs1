"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  addTrackToPlaylist,
  deletePlaylist,
  removeTrackFromPlaylist,
  reorderTrack,
  setPlaylistStores,
  updatePlaylistMeta,
} from "../actions";

export type PlaylistItemRow = {
  id: string;
  position: number;
  audio_files: { id: string; title: string; duration_ms: number; artists: { name: string } | null } | null;
};

export type StoreOption = { id: string; name: string };
export type TrackOption = { id: string; title: string; artists: { name: string } | null };

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function PlaylistEditor({
  playlist,
  items,
  stores,
  assignedStoreIds,
  availableTracks,
}: {
  playlist: { id: string; name: string; description: string | null; priority: number; version: number };
  items: PlaylistItemRow[];
  stores: StoreOption[];
  assignedStoreIds: string[];
  availableTracks: TrackOption[];
}) {
  const [name, setName] = useState(playlist.name);
  const [description, setDescription] = useState(playlist.description ?? "");
  const [priority, setPriority] = useState(playlist.priority);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [metaSaving, startMetaSave] = useTransition();

  const [selectedStores, setSelectedStores] = useState<Set<string>>(new Set(assignedStoreIds));
  const [storesSaving, startStoresSave] = useTransition();

  const [trackSearch, setTrackSearch] = useState("");
  const [addingId, setAddingId] = useState<string | null>(null);
  const [itemPending, startItemAction] = useTransition();

  const usedTrackIds = useMemo(() => new Set(items.map((i) => i.audio_files?.id).filter(Boolean)), [items]);
  const filteredTracks = useMemo(() => {
    const q = trackSearch.trim().toLowerCase();
    return availableTracks
      .filter((t) => !usedTrackIds.has(t.id))
      .filter((t) => !q || t.title.toLowerCase().includes(q) || t.artists?.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [availableTracks, usedTrackIds, trackSearch]);

  function saveMeta() {
    setMetaError(null);
    startMetaSave(async () => {
      const result = await updatePlaylistMeta({ id: playlist.id, name, description, priority });
      if (result.error) setMetaError(result.error);
    });
  }

  function saveStores() {
    startStoresSave(async () => {
      await setPlaylistStores(playlist.id, Array.from(selectedStores));
    });
  }

  function toggleStore(storeId: string) {
    setSelectedStores((prev) => {
      const next = new Set(prev);
      if (next.has(storeId)) next.delete(storeId);
      else next.add(storeId);
      return next;
    });
  }

  const inputClass =
    "rounded-md border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none focus:border-signal";

  return (
    <div className="max-w-3xl">
      <Link href="/playlists" className="text-xs text-ink-400 hover:text-signal">
        ← Playlists
      </Link>

      <div className="mt-3 rounded-lg border border-ink-700 bg-ink-900 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1.5 block text-xs font-medium text-ink-400">Nom</label>
            <input className={`w-full ${inputClass}`} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="min-w-[240px] flex-[2]">
            <label className="mb-1.5 block text-xs font-medium text-ink-400">Description</label>
            <input
              className={`w-full ${inputClass}`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="w-24">
            <label className="mb-1.5 block text-xs font-medium text-ink-400">Priorité</label>
            <input
              type="number"
              className={`w-full ${inputClass}`}
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
            />
          </div>
          <button
            type="button"
            onClick={saveMeta}
            disabled={metaSaving}
            className="rounded-md bg-signal px-4 py-2 text-sm font-medium text-ink-950 transition hover:bg-signal-dim disabled:opacity-60"
          >
            {metaSaving ? "…" : "Enregistrer"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm(`Supprimer la playlist « ${playlist.name} » ?`)) {
                startItemAction(() => deletePlaylist(playlist.id));
              }
            }}
            className="rounded-md border border-status-critical/40 px-3 py-2 text-xs text-status-critical transition hover:bg-status-critical/10"
          >
            Supprimer
          </button>
        </div>
        {metaError && <p className="mt-2 text-xs text-status-critical">{metaError}</p>}
        <p className="mt-2 text-[11px] text-ink-600">version {playlist.version}</p>
      </div>

      <h2 className="mb-2 mt-6 text-sm font-medium text-ink-200">Titres ({items.length})</h2>
      <div className="overflow-hidden rounded-lg border border-ink-700">
        {items.length === 0 ? (
          <div className="bg-ink-900 px-4 py-3 text-sm text-ink-400">Playlist vide — ajoute un titre ci-dessous.</div>
        ) : (
          <table className="w-full text-left text-sm">
            <tbody className="divide-y divide-ink-700 bg-ink-950">
              {items.map((item, index) => (
                <tr key={item.id}>
                  <td className="w-10 px-3 py-2 font-mono text-xs text-ink-600">{index + 1}</td>
                  <td className="px-3 py-2 text-ink-100">{item.audio_files?.title ?? "—"}</td>
                  <td className="px-3 py-2 text-ink-300">{item.audio_files?.artists?.name ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs text-ink-400">
                    {item.audio_files ? formatDuration(item.audio_files.duration_ms) : ""}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex gap-1">
                      <button
                        type="button"
                        disabled={index === 0 || itemPending}
                        onClick={() => startItemAction(async () => { await reorderTrack(playlist.id, item.id, "up"); })}
                        className="rounded border border-ink-600 px-2 py-0.5 text-xs text-ink-300 transition hover:bg-ink-800 disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={index === items.length - 1 || itemPending}
                        onClick={() => startItemAction(async () => { await reorderTrack(playlist.id, item.id, "down"); })}
                        className="rounded border border-ink-600 px-2 py-0.5 text-xs text-ink-300 transition hover:bg-ink-800 disabled:opacity-30"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        disabled={itemPending}
                        onClick={() => startItemAction(async () => { await removeTrackFromPlaylist(playlist.id, item.id); })}
                        className="rounded border border-status-critical/40 px-2 py-0.5 text-xs text-status-critical transition hover:bg-status-critical/10"
                      >
                        Retirer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-3">
        <input
          type="text"
          placeholder="Chercher un titre ou un artiste à ajouter…"
          value={trackSearch}
          onChange={(e) => setTrackSearch(e.target.value)}
          className={`w-full ${inputClass}`}
        />
        {trackSearch && filteredTracks.length > 0 && (
          <div className="mt-1.5 space-y-1 rounded-md border border-ink-700 bg-ink-900 p-1.5">
            {filteredTracks.map((t) => (
              <button
                key={t.id}
                type="button"
                disabled={addingId === t.id}
                onClick={() => {
                  setAddingId(t.id);
                  startItemAction(async () => {
                    await addTrackToPlaylist(playlist.id, t.id);
                    setAddingId(null);
                    setTrackSearch("");
                  });
                }}
                className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm text-ink-200 transition hover:bg-ink-800 disabled:opacity-50"
              >
                <span>
                  {t.title} {t.artists?.name ? <span className="text-ink-500">— {t.artists.name}</span> : null}
                </span>
                <span className="text-xs text-signal">Ajouter</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <h2 className="mb-2 mt-8 text-sm font-medium text-ink-200">Magasins</h2>
      <div className="rounded-lg border border-ink-700 bg-ink-900 p-4">
        {stores.length === 0 ? (
          <p className="text-sm text-ink-400">Aucun magasin créé pour l&apos;instant.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {stores.map((s) => {
              const checked = selectedStores.has(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleStore(s.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    checked
                      ? "border-signal bg-signal/10 text-signal"
                      : "border-ink-600 text-ink-300 hover:bg-ink-800"
                  }`}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        )}
        <button
          type="button"
          onClick={saveStores}
          disabled={storesSaving}
          className="mt-3 rounded-md bg-signal px-4 py-2 text-sm font-medium text-ink-950 transition hover:bg-signal-dim disabled:opacity-60"
        >
          {storesSaving ? "…" : "Enregistrer les magasins"}
        </button>
      </div>
    </div>
  );
}
