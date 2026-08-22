"use client";

// Canal de signalisation pour la synchro multiroom — même principe que
// player-realtime.ts (broadcast Supabase, aucune table, sécurité par UUID
// non devinable). Sert uniquement à établir les connexions WebRTC entre le
// leader et ses followers (offer/answer/ICE) ; une fois la connexion
// peer-to-peer établie, la synchro d'horloge et les ordres de lecture
// passent par le data channel WebRTC (voir lib/zone-sync.ts), pas par ce
// canal — c'est justement pour éviter la latence/le jitter du aller-retour
// cloud sur le chemin critique.

import { createClient } from "@supabase/supabase-js";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type ZoneSignal =
  | { type: "announce"; playerId: string; isLeader: boolean }
  | { type: "offer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: "ice"; from: string; to: string; candidate: RTCIceCandidateInit };

function client() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export function zoneChannelNameFor(zoneId: string): string {
  return `ahs1-zone-${zoneId}`;
}

export function openZoneChannel(zoneId: string): RealtimeChannel {
  return client().channel(zoneChannelNameFor(zoneId), {
    config: { broadcast: { self: false, ack: false } },
  });
}
