import "server-only";
import type { MetadataCandidate } from "./metadata-types";

interface MusicBrainzRelease {
  title?: string;
  date?: string;
}

interface MusicBrainzArtistCredit {
  name?: string;
}

interface MusicBrainzRecording {
  title: string;
  "artist-credit"?: MusicBrainzArtistCredit[];
  releases?: MusicBrainzRelease[];
}

export async function searchMusicBrainz(title: string, artist: string): Promise<MetadataCandidate[]> {
  const queryParts = [`recording:"${title.replace(/"/g, "")}"`];
  if (artist) queryParts.push(`AND artist:"${artist.replace(/"/g, "")}"`);

  const url = `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(
    queryParts.join(" ")
  )}&fmt=json&limit=5`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "AHS1/0.1.0 ( xplozmusic@gmail.com )",
    },
  });
  if (!res.ok) return [];

  const data = (await res.json()) as { recordings?: MusicBrainzRecording[] };

  return (data.recordings ?? []).map((r) => ({
    source: "musicbrainz" as const,
    title: r.title,
    artist: r["artist-credit"]?.[0]?.name ?? artist,
    album: r.releases?.[0]?.title ?? null,
    year: r.releases?.[0]?.date?.slice(0, 4) ?? null,
    imageUrl: null,
  }));
}
