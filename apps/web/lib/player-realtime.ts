"use client";

// Canal temps réel Supabase (broadcast, sans table) reliant la page /player
// d'un appareil et sa télécommande dans le dashboard. Scindé par player_id
// (UUID non devinable) — suffisant pour une fonctionnalité de confort, pas
// un canal sécurisé au sens strict.

import { createClient } from "@supabase/supabase-js";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface PlayerState {
  connected: boolean;
  isPlaying: boolean;
  currentTitle: string | null;
  currentArtist: string | null;
  volume: number;
  mode: "locked" | "technician";
  queue: string[];
  storeName: string | null;
  scheduleLabel: string | null;
}

export type PlayerCommand =
  | { type: "play" }
  | { type: "pause" }
  | { type: "next" }
  | { type: "set_volume"; value: number };

function client() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export function channelNameFor(playerId: string): string {
  return `ahs1-player-${playerId}`;
}

export function openPlayerChannel(playerId: string): RealtimeChannel {
  return client().channel(channelNameFor(playerId), {
    config: { broadcast: { self: false, ack: false } },
  });
}
