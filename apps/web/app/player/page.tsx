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

const HEARTBEAT_INTERVAL_MS = 30_000;
const SYNC_INTERVAL_MS = 5 * 60_000;

function ActivationForm({ onActivated }: { onActivated: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await enroll(code);
    setLoading(false);
    if (result.error) setError(result.error);
    else onActivated();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b0f14] px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#3ddbc4]">AHS1</p>
        <h1 className="mt-2 text-xl font-medium text-[#e8ecf1]">Bienvenue sur AHS1</h1>

        <p className="mt-8 text-xs text-[#7c8a9c]">Code d&apos;activation</p>
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

function PlayerScreen({ session, onDeactivated }: { session: NonNullable<ReturnType<typeof getStoredSession>>; onDeactivated: () => void }) {
  const [queue, setQueue] = useState<SyncFile[]>([]);
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [connected, setConnected] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [pin, setPin] = useState("1990");
  const [castAvailable, setCastAvailable] = useState(false);
  const [casting, setCasting] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const reportedRef = useRef(false);

  useEffect(() => {
    fetchPin().then(setPin);
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

  const current = queue[index] ?? null;

  useEffect(() => {
    const heartbeatInterval = setInterval(() => {
      sendHeartbeat(current?.title ?? null);
    }, HEARTBEAT_INTERVAL_MS);
    sendHeartbeat(current?.title ?? null);
    return () => clearInterval(heartbeatInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    reportedRef.current = false;

    function onLoaded() {
      if (!audio || !current) return;
      audio.currentTime = current.trim_start_ms / 1000;
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
      if (audio.currentTime >= endSec) {
        setIndex((i) => (i + 1) % queue.length);
      }
    }
    function onPlay() {
      setIsPlaying(true);
    }
    function onPause() {
      setIsPlaying(false);
    }
    function onError() {
      // fichier illisible/corrompu (§45) : on passe au suivant plutôt que de bloquer la diffusion
      setIndex((i) => (i + 1) % queue.length);
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
  }, [current, queue.length]);

  // API Remote Playback (native Chrome) : propose "Caster" vers un
  // Chromecast/enceinte compatible dès qu'un tel appareil est détectable sur
  // le réseau. Bluetooth n'a besoin d'aucun code : Android route l'audio de
  // n'importe quelle appli vers l'enceinte appairée au niveau système.
  useEffect(() => {
    const audio = audioRef.current as (HTMLAudioElement & { remote?: any }) | null;
    if (!audio?.remote) return;

    audio.remote
      .watchAvailability((available: boolean) => setCastAvailable(available))
      .catch(() => setCastAvailable(false));

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
      // utilisateur a fermé la fenêtre de sélection, ou aucun appareil dispo
    }
  }

  const next = queue[(index + 1) % queue.length] ?? null;
  const durationSec = current ? (current.trim_end_ms != null ? current.trim_end_ms - current.trim_start_ms : current.duration_ms) / 1000 : 0;

  return (
    <div className="flex min-h-screen flex-col bg-[#0b0f14] p-8 text-[#e8ecf1]">
      {current && <audio ref={audioRef} src={current.url ?? undefined} />}

      <div className="flex items-center justify-between">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#3ddbc4]">AHS1</p>
        <div className="flex items-center gap-3">
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
        <button
          type="button"
          onClick={() => {
            const entered = prompt("Code PIN requis pour accéder aux réglages :");
            if (entered === null) return;
            if (entered !== pin) {
              alert("Code incorrect.");
              return;
            }
            if (confirm("Désactiver ce player ?")) {
              clearSession();
              onDeactivated();
            }
          }}
          className="text-[10px] text-[#333d4d] hover:text-[#7c8a9c]"
        >
          ⚙
        </button>
        </div>
      </div>

      <p className="mt-1 text-xs text-[#7c8a9c]">{connected ? "🟢 CONNECTÉ" : "🟠 HORS CONNEXION"}</p>

      <p className="mt-8 text-[11px] uppercase tracking-wide text-[#7c8a9c]">Magasin</p>
      <p className="text-base text-[#e8ecf1]">{session.storeName ?? "—"}</p>

      <div className="mt-10 flex flex-1 flex-col items-center justify-center text-center">
        <div className="flex h-40 w-40 items-center justify-center rounded-xl bg-[#171d26] text-5xl">🎵</div>

        <p className="mt-8 text-[11px] uppercase tracking-wide text-[#7c8a9c]">En lecture</p>
        <p className="mt-1 max-w-md truncate text-2xl font-medium">{current?.title ?? "En attente de contenu…"}</p>

        {current && (
          <p className="mt-2 font-mono text-xs text-[#7c8a9c]">
            {formatTime(currentTime)} / {formatTime(durationSec)}
          </p>
        )}

        <p className="mt-1 text-xs text-[#333d4d]">{isPlaying ? "▶ Lecture" : "⏸ En pause"}</p>
      </div>

      <div className="border-t border-[#232b37] pt-4">
        <p className="text-[11px] uppercase tracking-wide text-[#7c8a9c]">Prochain titre</p>
        <p className="mt-1 text-sm text-[#e8ecf1]">{next?.title ?? "—"}</p>
        <p className="mt-3 text-[11px] text-[#333d4d]">
          Cache : {queue.length > 0 ? `🟢 ${queue.length} titre(s) synchronisés` : "🟠 aucun contenu"}
        </p>
      </div>
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
