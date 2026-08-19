import "server-only";
import type { MetadataCandidate } from "./metadata-types";

interface SpotifyTrack {
  name: string;
  artists?: { name: string }[];
  album?: {
    name?: string;
    release_date?: string;
    images?: { url: string }[];
  };
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) return null;

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return cachedToken.value;
}

export function isSpotifyConfigured(): boolean {
  return Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
}

export async function searchSpotify(title: string, artist: string): Promise<MetadataCandidate[]> {
  const token = await getAccessToken();
  if (!token) return [];

  const q = `track:${title}${artist ? ` artist:${artist}` : ""}`;
  const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=5`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return [];

  const data = (await res.json()) as { tracks?: { items?: SpotifyTrack[] } };

  return (data.tracks?.items ?? []).map((t) => ({
    source: "spotify" as const,
    title: t.name,
    artist: t.artists?.[0]?.name ?? artist,
    album: t.album?.name ?? null,
    year: t.album?.release_date?.slice(0, 4) ?? null,
    imageUrl: t.album?.images?.[2]?.url ?? t.album?.images?.[0]?.url ?? null,
  }));
}
