import "server-only";
import { createHash } from "crypto";
import { parseBuffer } from "music-metadata";

export interface ParsedAudio {
  durationMs: number;
  bitrate: number | null;
  sampleRate: number | null;
  title: string | null;
  artist: string | null;
  album: string | null;
  genre: string | null;
}

export async function parseAudioBuffer(buffer: Buffer, mimeType: string): Promise<ParsedAudio> {
  const metadata = await parseBuffer(buffer, mimeType, { duration: true });

  return {
    durationMs: Math.round((metadata.format.duration ?? 0) * 1000),
    bitrate: metadata.format.bitrate ? Math.round(metadata.format.bitrate) : null,
    sampleRate: metadata.format.sampleRate ?? null,
    title: metadata.common.title ?? null,
    artist: metadata.common.artist ?? null,
    album: metadata.common.album ?? null,
    genre: metadata.common.genre?.[0] ?? null,
  };
}

export function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}
