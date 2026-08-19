// Sans dépendance Node — importable côté client comme côté serveur.

export type AudioFormat = "mp3" | "wav" | "flac";

export const CATEGORY_BUCKET: Record<string, string> = {
  music: "audio-music",
  jingle: "audio-jingles",
  advertisement: "audio-advertisements",
};

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
