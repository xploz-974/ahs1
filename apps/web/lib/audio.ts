import { createHash } from "crypto";
import { parseBuffer } from "music-metadata";

export type AudioFormat = "mp3" | "wav" | "flac";

const MIME_TO_FORMAT: Record<string, AudioFormat> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/wave": "wav",
  "audio/x-wav": "wav",
  "audio/flac": "flac",
  "audio/x-flac": "flac",
};

export function detectFormat(mimeType: string, filename: string): AudioFormat | null {
  if (MIME_TO_FORMAT[mimeType]) return MIME_TO_FORMAT[mimeType];
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "mp3" || ext === "wav" || ext === "flac") return ext;
  return null;
}

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
