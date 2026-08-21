"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearSession,
  enroll,
  fetchPin,
  fetchSync,
  getStoredSession,
  sendHeartbeat,
  sendPlaybackEvent,
  type SyncFile,
} from "./api";
import { openPlayerChannel, type PlayerCommand, type PlayerState } from "@/lib/player-realtime";
import { cacheFile, countCached, getPlayableUrl, pruneCache } from "@/lib/player-cache";
import { SupportChat } from "./support-chat";

const HEARTBEAT_INTERVAL_MS = 30_000;
const SYNC_INTERVAL_MS = 5 * 60_000;
const STATE_BROADCAST_INTERVAL_MS = 3_000;

const SETUP_PIN = "1990";

interface PendingPlayer {
  id: string;
  name: string;
  storeName: string | null;
  activationCode: string;
}

function ActivationForm({ onActivated }: { onActivated: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [pendingPlayers, setPendingPlayers] = useState<PendingPlayer[] | null>(null);
  const lastTapRef = useRef(0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await enroll(code);
    setLoading(false);
    if (result.error) setError(result.error);
    else onActivated();
  }

  function handleLabelTap() {
    const now = Date.now();
    const nextCount = now - lastTapRef.current < 1500 ? tapCount + 1 : 1;
    lastTapRef.current = now;
    setTapCount(nextCount);

    if (nextCount >= 3) {
      setTapCount(0);
      const entered = prompt("Code technicien (mode installation) :");
      if (entered !== SETUP_PIN) {
        if (entered !== null) alert("Code incorrect.");
        return;
      }
      fetch("/api/player/pending-list")
        .then((r) => r.json())
        .then((data) => setPendingPlayers(data.players ?? []));
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b0f14] px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#3ddbc4]">AHS1</p>
        <h1 className="mt-2 text-xl font-medium text-[#e8ecf1]">Bienvenue sur AHS1</h1>

        <p onClick={handleLabelTap} className="mt-8 select-none text-xs text-[#7c8a9c]">
          Code d&apos;activation
        </p>

        {pendingPlayers && (
          <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-md border border-[#333d4d] bg-[#171d26] p-2 text-left">
            {pendingPlayers.length === 0 && (
              <p className="p-2 text-center text-xs text-[#7c8a9c]">Aucun player disponible.</p>
            )}
            {pendingPlayers.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setCode(p.activationCode);
                  setPendingPlayers(null);
                }}
                className="block w-full rounded px-3 py-2 text-left text-sm text-[#e8ecf1] hover:bg-[#232b37]"
              >
                <span className="font-medium">{p.name}</span>
                {p.storeName && <span className="text-[#7c8a9c]"> — {p.storeName}</span>}
              </button>
            ))}
          </div>
        )}

        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="AHS1-XXXX-XXXX"
          autoFocus
          className="mt-2 w-full rounded-md border border-[#333d4d] bg-[#171d26] px-4 py-3 text-center font-mono text-lg tracking-wider text-[#e8ecf1] outline-none focus:border-[#3ddbc4]"
        />

        <button
          type="submit"
          disabled={loading || !code.trim()}
          className="mt-6 w-full rounded-md bg-[#3ddbc4] py-3 text-sm font-medium text-[#0b0f14] transition hover:bg-[#2aa895] disabled:opacity-50"
        >
          {loading ? "Activation…" : "ACTIVER"}
        </button>

        {error && <p className="mt-4 text-xs text-[#ef5b5b]">{error}</p>}
      </form>
    </div>
  );
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function VolumeControl({ volume, onChange }: { volume: number; onChange: (v: number) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative flex flex-col items-center">
      {open && (
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => onChange(Number(e.target.value))}
          className="mb-6 h-40 w-3 accent-[#3ddbc4]"
          style={{ writingMode: "vertical-lr" as const, direction: "rtl" }}
        />
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-32 w-32 flex-col items-center justify-center rounded-full border-2 border-[#232b37] bg-[#171d26] text-[#e8ecf1] transition active:scale-95"
      >
        <span className="text-3xl">{volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}</span>
        <span className="mt-1 font-mono text-sm text-[#7c8a9c]">{Math.round(volume * 100)}%</span>
      </button>
    </div>
  );
}

function PlayerScreen({
  session,
  onDeactivated,
}: {
  session: NonNullable<ReturnType<typeof getStoredSession>>;
  onDeactivated: () => void;
}) {
  const [queue, setQueue] = useState<SyncFile[]>([]);
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [connected, setConnected] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [pin, setPin] = useState("1990");
  const [mode, setMode] = useState<"locked" | "technician">("locked");
  const [volume, setVolume] = useState(1);
  const [castAvailable, setCastAvailable] = useState(false);
  const [casting, setCasting] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [playableUrl, setPlayableUrl] = useState<string | null>(null);
  const [cachedCount, setCachedCount] = useState(0);
  const [isOffline, setIsOffline] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const reportedRef = useRef(false);
  const channelRef = useRef<ReturnType<typeof openPlayerChannel> | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    fetchPin().then(setPin);
  }, []);

  // §27 — la perte réseau ne doit jamais couper la diffusion : on suit l'état
  // de connexion du navigateur en plus du succès des appels /sync, pour
  // afficher "hors connexion, lecture depuis le cache" plutôt qu'une erreur.
  useEffect(() => {
    function update() {
      setIsOffline(!navigator.onLine);
    }
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const loadSync = useCallback(async () => {
    const data = await fetchSync();
    if (!data) {
      setConnected(false);
      return;
    }
    setConnected(true);
    const music = data.files.filter((f) => f.category === "music" && f.url);
    if (music.length > 0) setQueue(music);
  }, []);

  useEffect(() => {
    loadSync();
    const syncInterval = setInterval(loadSync, SYNC_INTERVAL_MS);
    return () => clearInterval(syncInterval);
  }, [loadSync]);

  // Cache local (§25) : télécharge et conserve chaque titre synchronisé pour
  // qu'il reste jouable hors connexion, purge ce qui n'est plus dans la
  // playlist. Séquentiel volontairement, pour ne pas saturer la connexion.
  useEffect(() => {
    if (queue.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const f of queue) {
        if (cancelled) return;
        if (f.url) await cacheFile(f.id, f.url);
        const c = await countCached(queue.map((q) => q.id));
        if (!cancelled) setCachedCount(c);
      }
      if (!cancelled) await pruneCache(queue.map((f) => f.id));
    })();
    return () => {
      cancelled = true;
    };
  }, [queue]);

  const current = queue[index] ?? null;

  // Résout l'URL jouable pour le titre courant : depuis le cache local si
  // disponible (fonctionne hors connexion), sinon télécharge et met en cache.
  useEffect(() => {
    let cancelled = false;
    if (!current) {
      setPlayableUrl(null);
      return;
    }
    getPlayableUrl(current.id, current.url).then((url) => {
      if (cancelled) return;
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = url;
      setPlayableUrl(url);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  // Si le titre courant n'a pas pu être résolu (hors connexion, jamais mis en
  // cache), retente régulièrement plutôt que de rester bloqué en silence.
  useEffect(() => {
    if (!current || playableUrl) return;
    const retry = setInterval(() => {
      getPlayableUrl(current.id, current.url).then((url) => {
        if (!url) return;
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = url;
        setPlayableUrl(url);
      });
    }, 15_000);
    return () => clearInterval(retry);
  }, [current, playableUrl]);

  useEffect(() => {
    const heartbeatInterval = setInterval(() => {
      sendHeartbeat(current?.title ?? null);
    }, HEARTBEAT_INTERVAL_MS);
    sendHeartbeat(current?.title ?? null);
    return () => clearInterval(heartbeatInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const goToNext = useCallback(() => {
    setIndex((i) => (queue.length > 0 ? (i + 1) % queue.length : 0));
  }, [queue.length]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !current || !playableUrl) return;
    reportedRef.current = false;

    function onLoaded() {
      if (!audio || !current) return;
      audio.currentTime = current.trim_start_ms / 1000;
      audio.volume = volume;
      audio.play().catch(() => setIsPlaying(false));
    }
    function onTimeUpdate() {
      if (!audio || !current) return;
      const endSec = current.trim_end_ms != null ? current.trim_end_ms / 1000 : audio.duration;
      setCurrentTime(audio.currentTime - current.trim_start_ms / 1000);
      if (!reportedRef.current && audio.currentTime >= endSec - 0.3) {
        reportedRef.current = true;
        sendPlaybackEvent(current);
      }
      if (audio.currentTime >= endSec) goToNext();
    }
    function onPlay() {
      setIsPlaying(true);
    }
    function onPause() {
      setIsPlaying(false);
    }
    function onError() {
      // fichier illisible/corrompu (§45), ou blob de cache invalide : on passe
      // au suivant plutôt que de bloquer la diffusion.
      goToNext();
    }

    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("error", onError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, playableUrl, goToNext]);

  // Remote Playback (Chromecast) — Bluetooth n'a besoin d'aucun code, géré par
  // Android/Chrome au niveau système.
  useEffect(() => {
    const audio = audioRef.current as (HTMLAudioElement & { remote?: any }) | null;
    if (!audio?.remote) return;
    audio.remote.watchAvailability((available: boolean) => setCastAvailable(available)).catch(() => setCastAvailable(false));
    const onConnecting = () => setCasting(true);
    const onConnect = () => setCasting(true);
    const onDisconnect = () => setCasting(false);
    audio.remote.addEventListener("connecting", onConnecting);
    audio.remote.addEventListener("connect", onConnect);
    audio.remote.addEventListener("disconnect", onDisconnect);
    return () => {
      audio.remote.removeEventListener("connecting", onConnecting);
      audio.remote.removeEventListener("connect", onConnect);
      audio.remote.removeEventListener("disconnect", onDisconnect);
    };
  }, [current]);

  async function handleCast() {
    const audio = audioRef.current as (HTMLAudioElement & { remote?: any }) | null;
    if (!audio?.remote) return;
    try {
      await audio.remote.prompt();
    } catch {
      // annulé par l'utilisateur ou aucun appareil disponible
    }
  }

  // Télécommande temps réel depuis le dashboard (§ contrôle à distance) :
  // diffuse l'état toutes les 3s, applique les commandes reçues immédiatement.
  useEffect(() => {
    if (!session.playerId) return;
    const channel = openPlayerChannel(session.playerId);
    channelRef.current = channel;

    channel.on("broadcast", { event: "command" }, ({ payload }: { payload: PlayerCommand }) => {
      const audio = audioRef.current;
      if (!audio) return;
      if (payload.type === "play") audio.play().catch(() => {});
      else if (payload.type === "pause") audio.pause();
      else if (payload.type === "next") goToNext();
      else if (payload.type === "set_volume") setVolume(Math.min(1, Math.max(0, payload.value)));
    });

    channel.subscribe();
    return () => {
      channel.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.playerId]);

  const broadcastState = useCallback(() => {
    const state: PlayerState = {
      connected,
      isPlaying,
      currentTitle: current?.title ?? null,
      currentArtist: null,
      volume,
      mode,
      queue: queue.slice(index, index + 8).map((f) => f.title),
      storeName: session.storeName,
      scheduleLabel: queue.length > 0 ? `${queue.length} titre(s) synchronisés` : null,
    };
    channelRef.current?.send({ type: "broadcast", event: "state", payload: state });
  }, [connected, isPlaying, current, volume, mode, queue, index, session.storeName]);

  // Diffuse l'état immédiatement à chaque changement (pas de délai perceptible
  // sur la télécommande), plus un rappel périodique pour qu'une télécommande
  // qui vient de se connecter reçoive l'état sans attendre le prochain changement.
  useEffect(() => {
    broadcastState();
  }, [broadcastState]);

  useEffect(() => {
    const interval = setInterval(broadcastState, STATE_BROADCAST_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [broadcastState]);

  function requestTechnicianMode() {
    const entered = prompt("Code technicien :");
    if (entered === null) return;
    if (entered !== pin) {
      alert("Code incorrect.");
      return;
    }
    setMode("technician");
  }

  const next = queue[(index + 1) % queue.length] ?? null;
  const durationSec = current
    ? (current.trim_end_ms != null ? current.trim_end_ms - current.trim_start_ms : current.duration_ms) / 1000
    : 0;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-[#0b0f14] p-6 text-[#e8ecf1] sm:max-w-lg sm:p-8">
      {current && playableUrl && <audio ref={audioRef} src={playableUrl} />}

      <div className="flex items-center justify-between">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#3ddbc4]">AHS1</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowSupport(true)}
            title="Assistance"
            className="text-base text-[#7c8a9c] hover:text-[#3ddbc4]"
          >
            🆘
          </button>
          {castAvailable && (
            <button
              type="button"
              onClick={handleCast}
              title={casting ? "Diffusion en cours vers un appareil distant" : "Caster vers un appareil"}
              className={`text-base ${casting ? "text-[#3ddbc4]" : "text-[#7c8a9c]"} hover:text-[#3ddbc4]`}
            >
              📡
            </button>
          )}
          {mode === "technician" ? (
            <button
              type="button"
              onClick={() => setMode("locked")}
              className="rounded-full border border-[#333d4d] px-3 py-1 text-[10px] uppercase tracking-wide text-[#3ddbc4]"
            >
              🔓 Technicien
            </button>
          ) : (
            <button
              type="button"
              onClick={requestTechnicianMode}
              className="text-[10px] text-[#333d4d] hover:text-[#7c8a9c]"
              title="Mode technicien"
            >
              🔒
            </button>
          )}
          {mode === "technician" && (
            <button
              type="button"
              onClick={() => {
                if (confirm("Désactiver ce player ?")) {
                  clearSession();
                  onDeactivated();
                }
              }}
              className="text-[10px] text-[#333d4d] hover:text-[#ef5b5b]"
              title="Désactiver le player"
            >
              ⚙
            </button>
          )}
        </div>
      </div>

      <p className="mt-1 text-xs text-[#7c8a9c]">
        {isOffline ? "🟠 HORS CONNEXION — lecture depuis le cache" : connected ? "🟢 CONNECTÉ" : "🟡 SYNCHRONISATION…"}
      </p>

      <p className="mt-8 text-[11px] uppercase tracking-wide text-[#7c8a9c]">Magasin</p>
      <p className="text-base text-[#e8ecf1]">{session.storeName ?? "—"}</p>

      <div className="mt-8 flex flex-1 flex-col items-center justify-center text-center">
        <p className="text-[11px] uppercase tracking-wide text-[#7c8a9c]">En lecture</p>
        <p className="mt-1 max-w-md truncate text-2xl font-medium">{current?.title ?? "En attente de contenu…"}</p>

        {current && !playableUrl && (
          <p className="mt-2 text-xs text-[#f5a623]">En attente de connexion pour télécharger ce titre…</p>
        )}

        {current && playableUrl && (
          <p className="mt-2 font-mono text-xs text-[#7c8a9c]">
            {formatTime(currentTime)} / {formatTime(durationSec)}
          </p>
        )}

        <div className="my-8">
          <VolumeControl volume={volume} onChange={setVolume} />
        </div>

        {mode === "technician" && (
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => (isPlaying ? audioRef.current?.pause() : audioRef.current?.play())}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-[#3ddbc4] text-2xl text-[#0b0f14]"
            >
              {isPlaying ? "⏸" : "▶"}
            </button>
            <button
              type="button"
              onClick={goToNext}
              className="flex h-14 w-14 items-center justify-center rounded-full border border-[#333d4d] text-xl text-[#e8ecf1]"
            >
              ⏭
            </button>
          </div>
        )}
      </div>

      {mode === "technician" && queue.length > 0 && (
        <div className="mb-4 max-h-40 overflow-y-auto rounded-md border border-[#232b37] p-3">
          <p className="mb-2 text-[11px] uppercase tracking-wide text-[#7c8a9c]">File de lecture</p>
          <ol className="space-y-1">
            {queue.map((f, i) => (
              <li
                key={f.id}
                className={`truncate text-xs ${i === index ? "font-medium text-[#3ddbc4]" : "text-[#7c8a9c]"}`}
              >
                {i + 1}. {f.title}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="border-t border-[#232b37] pt-4">
        <p className="text-[11px] uppercase tracking-wide text-[#7c8a9c]">Prochain titre</p>
        <p className="mt-1 truncate text-sm text-[#e8ecf1]">{next?.title ?? "—"}</p>
        <p className="mt-3 text-[11px] text-[#333d4d]">
          Cache :{" "}
          {queue.length > 0
            ? `${cachedCount === queue.length ? "🟢" : "🟡"} ${cachedCount}/${queue.length} titre(s) en cache local`
            : "🟠 aucun contenu"}
        </p>
      </div>

      {showSupport && <SupportChat onClose={() => setShowSupport(false)} />}
    </div>
  );
}

export default function PlayerPage() {
  const [session, setSession] = useState<ReturnType<typeof getStoredSession>>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setSession(getStoredSession());
    setChecked(true);
  }, []);

  if (!checked) return null;

  if (!session) {
    return <ActivationForm onActivated={() => setSession(getStoredSession())} />;
  }

  return <PlayerScreen session={session} onDeactivated={() => setSession(null)} />;
}
