"use client";

import { useState, useTransition } from "react";
import { searchMetadata, updateAudioFile } from "./actions";
import type { MetadataCandidate } from "@/lib/metadata-types";

export type AudioFileRow = {
  id: string;
  title: string;
  duration_ms: number;
  format: string;
  bitrate: number | null;
  sample_rate: number | null;
  file_size: number;
  checksum: string;
  category: string;
  created_at: string;
  artists: { name: string } | null;
  albums: { title: string } | null;
  genres: { name: string } | null;
};

const CATEGORY_LABEL: Record<string, string> = {
  music: "Musique",
  jingle: "Jingle",
  advertisement: "Publicité",
  temporary: "Temporaire",
};

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function EditRow({ file, onDone }: { file: AudioFileRow; onDone: () => void }) {
  const [title, setTitle] = useState(file.title);
  const [artistName, setArtistName] = useState(file.artists?.name ?? "");
  const [albumTitle, setAlbumTitle] = useState(file.albums?.title ?? "");
  const [genreName, setGenreName] = useState(file.genres?.name ?? "");
  const [category, setCategory] = useState(file.category);
  const [candidates, setCandidates] = useState<MetadataCandidate[]>([]);
  const [spotifyEnabled, setSpotifyEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, startSearch] = useTransition();
  const [isSaving, startSave] = useTransition();

  function applyCandidate(c: MetadataCandidate) {
    setTitle(c.title);
    setArtistName(c.artist);
    if (c.album) setAlbumTitle(c.album);
  }

  function handleSearch() {
    setError(null);
    startSearch(async () => {
      const result = await searchMetadata(title, artistName);
      setCandidates(result.candidates);
      setSpotifyEnabled(result.spotifyEnabled);
    });
  }

  function handleSave() {
    setError(null);
    startSave(async () => {
      const result = await updateAudioFile({
        id: file.id,
        title,
        artistName,
        albumTitle,
        genreName,
        category,
      });
      if (result.error) {
        setError(result.error);
      } else {
        onDone();
      }
    });
  }

  const inputClass =
    "w-full rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1.5 text-sm text-ink-100 outline-none focus:border-signal";

  return (
    <tr className="bg-ink-900">
      <td colSpan={10} className="px-4 py-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs text-ink-400">Titre</label>
            <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-400">Artiste</label>
            <input className={inputClass} value={artistName} onChange={(e) => setArtistName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-400">Album</label>
            <input className={inputClass} value={albumTitle} onChange={(e) => setAlbumTitle(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-400">Genre</label>
            <input className={inputClass} value={genreName} onChange={(e) => setGenreName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-400">Catégorie</label>
            <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="music">Musique</option>
              <option value="jingle">Jingle</option>
              <option value="advertisement">Publicité</option>
            </select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSearch}
            disabled={isSearching}
            className="rounded-md border border-ink-600 px-3 py-1.5 text-xs text-ink-200 transition hover:bg-ink-800 disabled:opacity-60"
          >
            {isSearching ? "Recherche…" : "Vérifier en ligne (MusicBrainz + Spotify)"}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-md bg-signal px-3 py-1.5 text-xs font-medium text-ink-950 transition hover:bg-signal-dim disabled:opacity-60"
          >
            {isSaving ? "Enregistrement…" : "Enregistrer"}
          </button>
          <button
            type="button"
            onClick={onDone}
            className="rounded-md px-3 py-1.5 text-xs text-ink-400 transition hover:bg-ink-800"
          >
            Annuler
          </button>
          {error && <span className="text-xs text-status-critical">{error}</span>}
        </div>

        {candidates.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {!spotifyEnabled && (
              <p className="text-[11px] text-ink-600">
                Spotify non configuré — résultats MusicBrainz uniquement.
              </p>
            )}
            {candidates.map((c, i) => (
              <button
                key={`${c.source}-${i}`}
                type="button"
                onClick={() => applyCandidate(c)}
                className="flex w-full items-center gap-3 rounded-md border border-ink-700 bg-ink-800 px-3 py-2 text-left text-xs transition hover:border-signal"
              >
                {c.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.imageUrl} alt="" className="h-8 w-8 rounded object-cover" />
                ) : (
                  <span className="h-8 w-8 shrink-0 rounded bg-ink-700" />
                )}
                <span className="flex-1 truncate text-ink-100">
                  {c.title} — {c.artist}
                  {c.album ? ` (${c.album})` : ""}
                  {c.year ? `, ${c.year}` : ""}
                </span>
                <span className="shrink-0 rounded-full bg-ink-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-ink-400">
                  {c.source}
                </span>
              </button>
            ))}
          </div>
        )}
      </td>
    </tr>
  );
}

export function LibraryTable({ files }: { files: AudioFileRow[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="mt-6 overflow-x-auto rounded-lg border border-ink-700">
      <table className="w-full text-left text-sm">
        <thead className="bg-ink-900 text-xs uppercase tracking-wide text-ink-400">
          <tr>
            <th className="px-4 py-3 font-medium">Titre</th>
            <th className="px-4 py-3 font-medium">Artiste</th>
            <th className="px-4 py-3 font-medium">Genre</th>
            <th className="px-4 py-3 font-medium">Catégorie</th>
            <th className="px-4 py-3 font-medium">Durée</th>
            <th className="px-4 py-3 font-medium">Format</th>
            <th className="px-4 py-3 font-medium">Bitrate</th>
            <th className="px-4 py-3 font-medium">Taille</th>
            <th className="px-4 py-3 font-medium">Checksum</th>
            <th className="px-4 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-700 bg-ink-950">
          {files.map((f) =>
            editingId === f.id ? (
              <EditRow key={f.id} file={f} onDone={() => setEditingId(null)} />
            ) : (
              <tr key={f.id}>
                <td className="px-4 py-3 text-ink-100">{f.title}</td>
                <td className="px-4 py-3 text-ink-300">{f.artists?.name ?? "—"}</td>
                <td className="px-4 py-3 text-ink-300">{f.genres?.name ?? "—"}</td>
                <td className="px-4 py-3 text-ink-300">{CATEGORY_LABEL[f.category] ?? f.category}</td>
                <td className="px-4 py-3 font-mono text-xs text-ink-400">{formatDuration(f.duration_ms)}</td>
                <td className="px-4 py-3 font-mono text-xs uppercase text-ink-400">{f.format}</td>
                <td className="px-4 py-3 font-mono text-xs text-ink-400">
                  {f.bitrate ? `${Math.round(f.bitrate / 1000)} kb/s` : "—"}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-ink-400">{formatSize(f.file_size)}</td>
                <td className="px-4 py-3 font-mono text-[11px] text-ink-600" title={f.checksum}>
                  {f.checksum.slice(0, 12)}…
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => setEditingId(f.id)}
                    className="rounded-md border border-ink-600 px-2.5 py-1 text-xs text-ink-300 transition hover:bg-ink-800"
                  >
                    Modifier
                  </button>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}
