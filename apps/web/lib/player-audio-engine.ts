"use client";

// Moteur de lecture Web Audio pour /player : lit un morceau borné par
// trim_start/trim_end, applique fade_in/fade_out (0 = coupe nette), et
// enchaîne sur le suivant sans trou — avec un vrai fondu enchaîné si l'un des
// deux titres a un fade réglé, sinon un enchaînement sec mais sans silence.
//
// Le "choix" cut / fondu / enchaînement sans trou n'est pas un mode séparé :
// il découle directement des fade_in_ms/fade_out_ms déjà réglés par titre
// dans l'éditeur de forme d'onde (Bibliothèque). fade_out_ms=0 sur le titre
// courant ET fade_in_ms=0 sur le suivant → coupe nette mais sans silence
// entre les deux (overlap=0, le suivant démarre pile quand l'autre finit).
// Dès que l'un des deux a un fade, l'overlap correspondant crée un vrai
// fondu enchaîné.

export interface EngineTrack {
  id: string;
  buffer: AudioBuffer;
  trimStartMs: number;
  trimEndMs: number | null;
  fadeInMs: number;
  fadeOutMs: number;
}

interface Voice {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

export class PlaybackEngine {
  private ctx: AudioContext;
  private masterGain: GainNode;
  private voice: Voice | null = null;
  private streamDest: MediaStreamAudioDestinationNode;
  // Origine commune entre l'horloge AudioContext (relative à sa création) et
  // performance.now() (horloge "murale" du navigateur) — permet de traduire
  // un instant de lecture vers/depuis un timestamp comparable entre
  // appareils différents, nécessaire pour la synchro multiroom (zone-sync.ts)
  // qui échange des instants de démarrage entre plusieurs onglets/appareils.
  private readonly perfOrigin: number;
  private readonly ctxOrigin: number;

  constructor() {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctor();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    // Flux miroir pour le Cast (Remote Playback API) : un <audio> caché lit
    // ce MediaStream, ce qui permet de caster la sortie du moteur Web Audio
    // sans dupliquer le son localement (cet élément reste muet en local).
    this.streamDest = this.ctx.createMediaStreamDestination();
    this.masterGain.connect(this.streamDest);
    this.perfOrigin = performance.now();
    this.ctxOrigin = this.ctx.currentTime;
  }

  get currentTime(): number {
    return this.ctx.currentTime;
  }

  // Instant AudioContext (secondes) -> timestamp performance.now() (ms).
  contextTimeToPerfNow(ctxSec: number): number {
    return this.perfOrigin + (ctxSec - this.ctxOrigin) * 1000;
  }

  // Timestamp performance.now() (ms) -> instant AudioContext (secondes).
  perfNowToContextTime(perfMs: number): number {
    return this.ctxOrigin + (perfMs - this.perfOrigin) / 1000;
  }

  get castStream(): MediaStream {
    return this.streamDest.stream;
  }

  async resume(): Promise<void> {
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }

  async pauseContext(): Promise<void> {
    if (this.ctx.state === "running") await this.ctx.suspend();
  }

  async decode(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    return this.ctx.decodeAudioData(arrayBuffer.slice(0));
  }

  setVolume(v: number): void {
    this.masterGain.gain.setTargetAtTime(Math.min(1, Math.max(0, v)), this.ctx.currentTime, 0.05);
  }

  stop(): void {
    try {
      this.voice?.source.stop();
    } catch {
      // déjà arrêté
    }
    this.voice = null;
  }

  private effectiveWindow(track: EngineTrack): { startSec: number; durSec: number; fadeIn: number; fadeOut: number } {
    const startSec = track.trimStartMs / 1000;
    const endSec = track.trimEndMs != null ? track.trimEndMs / 1000 : track.buffer.duration;
    const durSec = Math.max(0.05, endSec - startSec);
    return {
      startSec,
      durSec,
      fadeIn: Math.min(track.fadeInMs / 1000, durSec / 2),
      fadeOut: Math.min(track.fadeOutMs / 1000, durSec / 2),
    };
  }

  // Calcule l'overlap (en secondes) avant la fin du titre courant auquel le
  // suivant doit démarrer, pour être planifié à l'avance par l'appelant.
  overlapBeforeNext(current: EngineTrack, next: EngineTrack | null): number {
    if (!next) return 0;
    const cur = this.effectiveWindow(current);
    const nxt = this.effectiveWindow(next);
    return Math.max(cur.fadeOut, nxt.fadeIn);
  }

  // Joue `track` à partir du temps AudioContext `at`. Retourne l'instant de
  // fin réel (pour planifier le titre suivant). `onEnded` se déclenche à la
  // fin naturelle du buffer, pas à l'instant du fondu (pour rester fiable
  // même si l'overlap suivant a déjà démarré une autre voix).
  play(track: EngineTrack, at: number, onEnded: () => void): number {
    const { startSec, durSec, fadeIn, fadeOut } = this.effectiveWindow(track);

    const source = this.ctx.createBufferSource();
    source.buffer = track.buffer;
    const gain = this.ctx.createGain();
    source.connect(gain).connect(this.masterGain);

    gain.gain.setValueAtTime(fadeIn > 0 ? 0.0001 : 1, at);
    if (fadeIn > 0) gain.gain.exponentialRampToValueAtTime(1, at + fadeIn);
    if (fadeOut > 0) {
      gain.gain.setValueAtTime(1, at + durSec - fadeOut);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + durSec - 0.01);
    }

    source.start(at, startSec, durSec);
    source.onended = onEnded;
    this.voice = { source, gain };
    return at + durSec;
  }

  close(): void {
    this.stop();
    this.ctx.close().catch(() => {});
  }
}
