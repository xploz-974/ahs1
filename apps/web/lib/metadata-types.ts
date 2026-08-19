export interface MetadataCandidate {
  source: "musicbrainz" | "spotify";
  title: string;
  artist: string;
  album: string | null;
  year: string | null;
  imageUrl?: string | null;
}
