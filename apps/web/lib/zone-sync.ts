"use client";

// Synchro multiroom (§ conception "Zones Multiroom") : un player "leader"
// pilote sa propre lecture normalement (AutoDJ/queue) et diffuse à chaque
// changement de titre un ordre "joue CE fichier à CET instant" à ses
// followers via un data channel WebRTC. Les followers traduisent cet
// instant dans leur propre horloge grâce à une synchro d'horloge façon NTP
// mesurée sur le même data channel, puis appellent leur moteur audio local
// (déjà capable de démarrer une lecture à un instant précis pour le
// gapless/crossfade — voir player-audio-engine.ts) à l'instant traduit.
//
// Le signalement WebRTC (offer/answer/ICE) passe par Supabase Realtime
// (zone-realtime.ts) ; une fois la connexion établie, elle négocie le
// chemin réseau le plus direct entre pairs (ICE) — sur un même réseau local
// (routeur boutique ou hotspot d'un des téléphones), ça tombe en direct,
// avec une latence bien plus faible et stable qu'un aller-retour cloud.
//
// Pas de relais TURN dans ce premier jet : si aucune connexion directe
// n'est possible, la synchro reste dégradée (RTT élevé, visible via
// getSyncQualityMs()) mais ne casse rien — le follower continue de jouer
// sur les ordres reçus, juste avec plus d'imprécision.

import { openZoneChannel, type ZoneSignal } from "./zone-realtime";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface ScheduleCommand {
  audioId: string;
  trimStartMs: number;
  trimEndMs: number | null;
  fadeInMs: number;
  fadeOutMs: number;
  // Instant de démarrage exprimé dans l'horloge performance.now() du LEADER.
  startAtPerfMs: number;
}

const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
const PING_INTERVAL_MS = 5000;
const MAX_OFFSET_SAMPLES = 8;
const ANNOUNCE_INTERVAL_MS = 10_000;

type DataMessage =
  | { type: "ping"; t0: number }
  | { type: "pong"; t0: number; t1: number; t2: number }
  | ({ type: "schedule" } & ScheduleCommand);

// Estime le décalage (offset) entre l'horloge du leader et la nôtre par
// aller-retours façon NTP : offset ≈ horloge_leader - horloge_locale.
// On garde les mesures au RTT le plus faible (donc les moins bruitées par
// la latence réseau) plutôt qu'une simple moyenne de tout l'historique.
export class ClockSync {
  private samples: { offset: number; rtt: number }[] = [];

  addSample(t0: number, t1: number, t2: number, t3: number): void {
    const rtt = t3 - t0 - (t2 - t1);
    const offset = (t1 - t0 + (t2 - t3)) / 2;
    this.samples.push({ offset, rtt });
    if (this.samples.length > MAX_OFFSET_SAMPLES) this.samples.shift();
  }

  getOffsetMs(): number | null {
    if (this.samples.length === 0) return null;
    const sorted = [...this.samples].sort((a, b) => a.rtt - b.rtt);
    const best = sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 2)));
    return best.reduce((sum, s) => sum + s.offset, 0) / best.length;
  }

  getBestRttMs(): number | null {
    if (this.samples.length === 0) return null;
    return Math.min(...this.samples.map((s) => s.rtt));
  }
}

function safeSend(dc: RTCDataChannel | null | undefined, msg: DataMessage): void {
  if (dc?.readyState === "open") dc.send(JSON.stringify(msg));
}

function parseMessage(raw: string): DataMessage | null {
  try {
    return JSON.parse(raw) as DataMessage;
  } catch {
    return null;
  }
}

export class ZoneSyncLeader {
  private channel: RealtimeChannel;
  private peers = new Map<string, { pc: RTCPeerConnection; dc: RTCDataChannel | null }>();
  private announceInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private zoneId: string,
    private selfPlayerId: string
  ) {
    this.channel = openZoneChannel(zoneId);
  }

  connect(): void {
    this.channel.on("broadcast", { event: "signal" }, ({ payload }: { payload: ZoneSignal }) => {
      if (payload.type === "announce" && !payload.isLeader) {
        void this.connectToFollower(payload.playerId);
      } else if (payload.type === "answer" && payload.to === this.selfPlayerId) {
        void this.peers.get(payload.from)?.pc.setRemoteDescription(payload.sdp);
      } else if (payload.type === "ice" && payload.to === this.selfPlayerId) {
        void this.peers.get(payload.from)?.pc.addIceCandidate(payload.candidate).catch(() => {});
      }
    });

    this.channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        this.announce();
        this.announceInterval = setInterval(() => this.announce(), ANNOUNCE_INTERVAL_MS);
      }
    });
  }

  private announce(): void {
    this.channel.send({
      type: "broadcast",
      event: "signal",
      payload: { type: "announce", playerId: this.selfPlayerId, isLeader: true } satisfies ZoneSignal,
    });
  }

  private async connectToFollower(followerId: string): Promise<void> {
    if (this.peers.has(followerId)) return;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const entry: { pc: RTCPeerConnection; dc: RTCDataChannel | null } = { pc, dc: null };
    this.peers.set(followerId, entry);

    const dc = pc.createDataChannel("sync");
    entry.dc = dc;
    dc.onmessage = (e) => this.handleMessage(followerId, e.data);

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.channel.send({
          type: "broadcast",
          event: "signal",
          payload: {
            type: "ice",
            from: this.selfPlayerId,
            to: followerId,
            candidate: e.candidate.toJSON(),
          } satisfies ZoneSignal,
        });
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.channel.send({
      type: "broadcast",
      event: "signal",
      payload: { type: "offer", from: this.selfPlayerId, to: followerId, sdp: offer } satisfies ZoneSignal,
    });
  }

  private handleMessage(followerId: string, raw: string): void {
    const msg = parseMessage(raw);
    if (!msg) return;
    if (msg.type === "ping") {
      const t1 = performance.now();
      safeSend(this.peers.get(followerId)?.dc, { type: "pong", t0: msg.t0, t1, t2: performance.now() });
    }
  }

  broadcastSchedule(cmd: ScheduleCommand): void {
    for (const { dc } of this.peers.values()) {
      safeSend(dc, { type: "schedule", ...cmd });
    }
  }

  getConnectedFollowerCount(): number {
    let n = 0;
    for (const { dc } of this.peers.values()) if (dc?.readyState === "open") n++;
    return n;
  }

  destroy(): void {
    if (this.announceInterval) clearInterval(this.announceInterval);
    for (const { pc } of this.peers.values()) pc.close();
    this.peers.clear();
    this.channel.unsubscribe();
  }
}

export class ZoneSyncFollower {
  private channel: RealtimeChannel;
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private clockSync = new ClockSync();
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private onSchedule: ((cmd: ScheduleCommand) => void) | null = null;

  constructor(
    private zoneId: string,
    private selfPlayerId: string,
    private leaderPlayerId: string
  ) {
    this.channel = openZoneChannel(zoneId);
  }

  connect(onSchedule: (cmd: ScheduleCommand) => void): void {
    this.onSchedule = onSchedule;

    this.channel.on("broadcast", { event: "signal" }, ({ payload }: { payload: ZoneSignal }) => {
      if (payload.type === "offer" && payload.to === this.selfPlayerId) {
        void this.handleOffer(payload.from, payload.sdp);
      } else if (payload.type === "ice" && payload.to === this.selfPlayerId) {
        void this.pc?.addIceCandidate(payload.candidate).catch(() => {});
      }
    });

    this.channel.subscribe((status) => {
      if (status === "SUBSCRIBED") this.announce();
    });
  }

  private announce(): void {
    this.channel.send({
      type: "broadcast",
      event: "signal",
      payload: { type: "announce", playerId: this.selfPlayerId, isLeader: false } satisfies ZoneSignal,
    });
  }

  private async handleOffer(leaderId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.pc = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.channel.send({
          type: "broadcast",
          event: "signal",
          payload: {
            type: "ice",
            from: this.selfPlayerId,
            to: leaderId,
            candidate: e.candidate.toJSON(),
          } satisfies ZoneSignal,
        });
      }
    };

    pc.ondatachannel = (e) => {
      this.dc = e.channel;
      this.dc.onmessage = (ev) => this.handleMessage(ev.data);
      this.dc.onopen = () => {
        this.pingInterval = setInterval(() => this.sendPing(), PING_INTERVAL_MS);
        this.sendPing();
      };
    };

    await pc.setRemoteDescription(sdp);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    this.channel.send({
      type: "broadcast",
      event: "signal",
      payload: { type: "answer", from: this.selfPlayerId, to: leaderId, sdp: answer } satisfies ZoneSignal,
    });
  }

  private sendPing(): void {
    safeSend(this.dc, { type: "ping", t0: performance.now() });
  }

  private handleMessage(raw: string): void {
    const msg = parseMessage(raw);
    if (!msg) return;
    if (msg.type === "pong") {
      this.clockSync.addSample(msg.t0, msg.t1, msg.t2, performance.now());
    } else if (msg.type === "schedule") {
      const { type: _type, ...cmd } = msg;
      this.onSchedule?.(cmd);
    }
  }

  // Traduit un instant exprimé dans l'horloge perf. du leader vers l'horloge
  // perf. locale (performance.now()) de ce follower.
  leaderPerfToLocalPerf(leaderPerfMs: number): number {
    const offset = this.clockSync.getOffsetMs() ?? 0;
    return leaderPerfMs - offset;
  }

  // RTT le plus bas mesuré — sert d'indicateur de qualité de synchro dans le
  // dashboard (null tant qu'aucune mesure n'est encore disponible).
  getSyncQualityMs(): number | null {
    return this.clockSync.getBestRttMs();
  }

  destroy(): void {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pc?.close();
    this.channel.unsubscribe();
  }
}
