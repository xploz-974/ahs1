"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSignedAudioUrl, updateAudioTrim } from "./actions";
import { decodeAndExtractPeaks, type PeakData } from "@/lib/waveform";

export interface MixTrackOption {
  id: string;
  title: string;
  category: string;
  storagePath: string;
}

interface WaveformEditorProps {
  audioFileId: string;
  category: string;
  storagePath: string;
  durationMs: number;
  initialTrimStartMs: number;
  initialTrimEndMs: number | null;
  initialFadeInMs: number;
  initialFadeOutMs: number;
  mixOptions: MixTrackOption[];
}

const MIN_ZOOM = 30; // px/sec
const MAX_ZOOM = 400;
const CANVAS_HEIGHT = 110;

function msToSec(ms: number) {
  return ms / 1000;
}

async function loadBuffer(category: string, storagePath: string): Promise<AudioBuffer> {
  const { url, error } = await getSignedAudioUrl(category, storagePath);
  if (error || !url) throw new Error(error ?? "URL indisponible");
  const res = await fetch(url);
  const arrayBuffer = await res.arrayBuffer();
  const { buffer } = await decodeAndExtractPeaks(arrayBuffer);
  return buffer;
}

export function WaveformEditor({
  audioFileId,
  category,
  storagePath,
  durationMs,
  initialTrimStartMs,
  initialTrimEndMs,
  initialFadeInMs,
  initialFadeOutMs,
  mixOptions,
}: WaveformEditorProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [peaks, setPeaks] = useState<PeakData | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);

  const [trimStart, setTrimStart] = useState(initialTrimStartMs);
  const [trimEnd, setTrimEnd] = useState(initialTrimEndMs ?? durationMs);
  const [fadeIn, setFadeIn] = useState(initialFadeInMs);
  const [fadeOut, setFadeOut] = useState(initialFadeOutMs);

  const [zoom, setZoom] = useState(60);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const lastFadeInRef = useRef(initialFadeInMs || 1000);
  const lastFadeOutRef = useRef(initialFadeOutMs || 1000);

  const [mixTrackId, setMixTrackId] = useState<string>("");
  const [mixPlaying, setMixPlaying] = useState(false);
  const mixBuffersRef = useRef<Map<string, AudioBuffer>>(new Map());

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const dragRef = useRef<null | "start" | "end" | "fadeInEnd" | "fadeOutStart">(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const { url, error: urlError } = await getSignedAudioUrl(category, storagePath);
        if (urlError || !url) throw new Error(urlError ?? "URL indisponible");
        const res = await fetch(url);
        const arrayBuffer = await res.arrayBuffer();
        const { peaks: p, buffer } = await decodeAndExtractPeaks(arrayBuffer);
        if (cancelled) return;
        setPeaks(p);
        bufferRef.current = buffer;
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erreur de chargement audio.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioFileId]);

  const durationSec = durationMs / 1000;
  const width = Math.max(400, Math.round(durationSec * zoom));

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !peaks) return;
    canvas.width = width;
    canvas.height = CANVAS_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, CANVAS_HEIGHT);
    const mid = CANVAS_HEIGHT / 2;

    // zones exclues (avant trimStart / après trimEnd)
    ctx.fillStyle = "rgba(11,15,20,0.75)";
    const startX = (trimStart / durationMs) * width;
    const endX = (trimEnd / durationMs) * width;
    ctx.fillRect(0, 0, startX, CANVAS_HEIGHT);
    ctx.fillRect(endX, 0, width - endX, CANVAS_HEIGHT);

    // forme d'onde
    ctx.fillStyle = "#3ddbc4";
    for (let x = 0; x < width; x++) {
      const peakIndex = Math.floor((x / width) * peaks.sampleCount);
      const min = peaks.min[peakIndex] ?? 0;
      const max = peaks.max[peakIndex] ?? 0;
      const y1 = mid + min * mid * 0.95;
      const y2 = mid + max * mid * 0.95;
      ctx.fillRect(x, y1, 1, Math.max(1, y2 - y1));
    }

    // fondus (triangles semi-transparents)
    const fadeInEndX = ((trimStart + fadeIn) / durationMs) * width;
    const fadeOutStartX = ((trimEnd - fadeOut) / durationMs) * width;
    ctx.fillStyle = "rgba(11,15,20,0.45)";
    ctx.beginPath();
    ctx.moveTo(startX, 0);
    ctx.lineTo(fadeInEndX, 0);
    ctx.lineTo(startX, CANVAS_HEIGHT);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(fadeOutStartX, 0);
    ctx.lineTo(endX, 0);
    ctx.lineTo(endX, CANVAS_HEIGHT);
    ctx.closePath();
    ctx.fill();
  }, [peaks, width, trimStart, trimEnd, fadeIn, fadeOut, durationMs]);

  useEffect(() => {
    draw();
  }, [draw]);

  const timeFromClientX = useCallback(
    (clientX: number) => {
      const container = containerRef.current;
      if (!container) return 0;
      const rect = container.getBoundingClientRect();
      const x = clientX - rect.left + container.scrollLeft;
      const ratio = Math.min(1, Math.max(0, x / width));
      return Math.round(ratio * durationMs);
    },
    [width, durationMs]
  );

  useEffect(() => {
    function handleMove(e: PointerEvent) {
      const which = dragRef.current;
      if (!which) return;
      const t = timeFromClientX(e.clientX);
      if (which === "start") {
        setTrimStart(Math.max(0, Math.min(t, trimEnd - 100)));
      } else if (which === "end") {
        setTrimEnd(Math.min(durationMs, Math.max(t, trimStart + 100)));
      } else if (which === "fadeInEnd") {
        setFadeIn(Math.max(0, t - trimStart));
      } else if (which === "fadeOutStart") {
        setFadeOut(Math.max(0, trimEnd - t));
      }
    }
    function handleUp() {
      dragRef.current = null;
    }
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [timeFromClientX, trimStart, trimEnd, fadeIn, durationMs]);

  function stopPlayback() {
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    setIsPlaying(false);
    setMixPlaying(false);
  }

  function playSelection() {
    const buffer = bufferRef.current;
    if (!buffer) return;
    stopPlayback();

    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    source.connect(gain).connect(ctx.destination);

    const startSec = msToSec(trimStart);
    const endSec = msToSec(trimEnd);
    const dur = Math.max(0.05, endSec - startSec);
    const fadeInSec = Math.min(msToSec(fadeIn), dur / 2);
    const fadeOutSec = Math.min(msToSec(fadeOut), dur / 2);

    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + fadeInSec);
    gain.gain.setValueAtTime(1, now + Math.max(dur - fadeOutSec, fadeInSec));
    gain.gain.linearRampToValueAtTime(0, now + dur);

    source.start(now, startSec, dur);
    source.onended = () => setIsPlaying(false);
    setIsPlaying(true);
  }

  function playFrom(atMs: number) {
    const buffer = bufferRef.current;
    if (!buffer) return;
    stopPlayback();

    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    source.connect(gain).connect(ctx.destination);

    const startSec = msToSec(Math.min(Math.max(atMs, trimStart), trimEnd - 50));
    const endSec = msToSec(trimEnd);
    const dur = Math.max(0.05, endSec - startSec);
    const fadeOutSec = Math.min(msToSec(fadeOut), dur);

    const now = ctx.currentTime;
    gain.gain.setValueAtTime(1, now);
    gain.gain.setValueAtTime(1, now + Math.max(dur - fadeOutSec, 0));
    gain.gain.linearRampToValueAtTime(0, now + dur);

    source.start(now, startSec, dur);
    source.onended = () => setIsPlaying(false);
    setIsPlaying(true);
  }

  function toggleFadeIn(enabled: boolean) {
    if (enabled) {
      setFadeIn(lastFadeInRef.current || 1000);
    } else {
      lastFadeInRef.current = fadeIn || lastFadeInRef.current;
      setFadeIn(0);
    }
  }

  function toggleFadeOut(enabled: boolean) {
    if (enabled) {
      setFadeOut(lastFadeOutRef.current || 1000);
    } else {
      lastFadeOutRef.current = fadeOut || lastFadeOutRef.current;
      setFadeOut(0);
    }
  }

  async function playMix() {
    const buffer = bufferRef.current;
    if (!buffer || !mixTrackId) return;
    const other = mixOptions.find((o) => o.id === mixTrackId);
    if (!other) return;

    stopPlayback();
    setMixPlaying(true);

    let otherBuffer = mixBuffersRef.current.get(other.id);
    if (!otherBuffer) {
      try {
        otherBuffer = await loadBuffer(other.category, other.storagePath);
        mixBuffersRef.current.set(other.id, otherBuffer);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Impossible de charger le second titre.");
        setMixPlaying(false);
        return;
      }
    }

    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const now = ctx.currentTime;

    const endSec = msToSec(trimEnd);
    const startSec = msToSec(trimStart);
    const tailWindow = Math.max(Math.min(msToSec(fadeOut), endSec - startSec), 2);
    const aStart = Math.max(startSec, endSec - tailWindow);
    const aDur = endSec - aStart;

    const srcA = ctx.createBufferSource();
    srcA.buffer = buffer;
    const gainA = ctx.createGain();
    srcA.connect(gainA).connect(ctx.destination);
    gainA.gain.setValueAtTime(1, now);
    gainA.gain.linearRampToValueAtTime(0, now + aDur);
    srcA.start(now, aStart, aDur);

    const overlap = Math.min(aDur, tailWindow);
    const bStartCtx = now + Math.max(aDur - overlap, 0);
    const bPlayWindow = Math.max(overlap, 2) + 2;

    const srcB = ctx.createBufferSource();
    srcB.buffer = otherBuffer;
    const gainB = ctx.createGain();
    srcB.connect(gainB).connect(ctx.destination);
    gainB.gain.setValueAtTime(0, bStartCtx);
    gainB.gain.linearRampToValueAtTime(1, bStartCtx + overlap);
    srcB.start(bStartCtx, 0, bPlayWindow);

    srcB.onended = () => setMixPlaying(false);
  }

  useEffect(() => stopPlayback, []);

  const trackDurationLabel = useMemo(() => {
    const s = Math.round(durationSec);
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  }, [durationSec]);

  function handleSave() {
    setSaving(true);
    setSaveMsg(null);
    updateAudioTrim({
      id: audioFileId,
      trimStartMs: trimStart,
      trimEndMs: trimEnd >= durationMs ? null : trimEnd,
      fadeInMs: fadeIn,
      fadeOutMs: fadeOut,
    }).then((res) => {
      setSaving(false);
      setSaveMsg(res.error ?? res.success);
    });
  }

  const markerStyle = "absolute top-0 h-full w-0.5 cursor-ew-resize";

  return (
    <div className="mt-3 rounded-md border border-ink-700 bg-ink-950 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-ink-400">
          Découpe &amp; fondus · durée totale {trackDurationLabel}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-ink-600">Zoom</span>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-28"
          />
        </div>
      </div>

      {loading && <p className="py-6 text-center text-xs text-ink-500">Chargement de la forme d&apos;onde…</p>}
      {error && <p className="py-2 text-xs text-status-critical">{error}</p>}

      {!loading && !error && peaks && (
        <>
          <div ref={containerRef} className="relative overflow-x-auto rounded border border-ink-700">
            <div
              className="relative cursor-pointer"
              style={{ width, height: CANVAS_HEIGHT }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / width));
                playFrom(Math.round(ratio * durationMs));
              }}
            >
              <canvas ref={canvasRef} className="block" />

              <div
                className={`${markerStyle} bg-signal`}
                style={{ left: (trimStart / durationMs) * width }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  dragRef.current = "start";
                }}
                onClick={(e) => e.stopPropagation()}
              />
              <div
                className={`${markerStyle} bg-signal`}
                style={{ left: (trimEnd / durationMs) * width }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  dragRef.current = "end";
                }}
                onClick={(e) => e.stopPropagation()}
              />
              <div
                className={`${markerStyle} bg-ink-400`}
                style={{ left: ((trimStart + fadeIn) / durationMs) * width }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  dragRef.current = "fadeInEnd";
                }}
                onClick={(e) => e.stopPropagation()}
              />
              <div
                className={`${markerStyle} bg-ink-400`}
                style={{ left: ((trimEnd - fadeOut) / durationMs) * width }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  dragRef.current = "fadeOutStart";
                }}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          <p className="mt-1 text-[10px] text-ink-600">Clique sur la forme d&apos;onde pour écouter à partir de ce point.</p>

          <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-ink-500">
            <span>Début : {(trimStart / 1000).toFixed(2)}s</span>
            <span>Fin : {(trimEnd / 1000).toFixed(2)}s</span>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={fadeIn > 0} onChange={(e) => toggleFadeIn(e.target.checked)} />
              Fondu entrée {fadeIn > 0 ? `(${(fadeIn / 1000).toFixed(2)}s)` : "désactivé"}
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={fadeOut > 0} onChange={(e) => toggleFadeOut(e.target.checked)} />
              Fondu sortie {fadeOut > 0 ? `(${(fadeOut / 1000).toFixed(2)}s)` : "désactivé"}
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={isPlaying ? stopPlayback : playSelection}
              className="rounded-md border border-ink-600 px-3 py-1.5 text-xs text-ink-200 transition hover:bg-ink-800"
            >
              {isPlaying ? "⏹ Stop" : "▶ Écouter la sélection"}
            </button>

            <select
              value={mixTrackId}
              onChange={(e) => setMixTrackId(e.target.value)}
              className="rounded-md border border-ink-600 bg-ink-800 px-2 py-1.5 text-xs text-ink-200"
            >
              <option value="">Mixer avec…</option>
              {mixOptions
                .filter((o) => o.id !== audioFileId)
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.title}
                  </option>
                ))}
            </select>
            <button
              type="button"
              onClick={mixPlaying ? stopPlayback : playMix}
              disabled={!mixTrackId}
              className="rounded-md border border-ink-600 px-3 py-1.5 text-xs text-ink-200 transition hover:bg-ink-800 disabled:opacity-40"
            >
              {mixPlaying ? "⏹ Stop" : "▶ Écouter le mix (transition)"}
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="ml-auto rounded-md bg-signal px-4 py-1.5 text-xs font-medium text-ink-950 transition hover:bg-signal-dim disabled:opacity-60"
            >
              {saving ? "…" : "Enregistrer les coupes"}
            </button>
            {saveMsg && <span className="text-[11px] text-ink-400">{saveMsg}</span>}
          </div>
        </>
      )}
    </div>
  );
}
