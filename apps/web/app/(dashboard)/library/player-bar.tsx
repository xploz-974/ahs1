"use client";

import { useEffect, useRef, useState } from "react";

export interface NowPlayingTrack {
  id: string;
  title: string;
  artist: string | null;
  url: string;
  trimStartMs: number;
  trimEndMs: number | null;
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function PlayerBar({ track, onClose }: { track: NowPlayingTrack | null; onClose: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !track) return;

    function onLoaded() {
      if (!audio) return;
      audio.currentTime = track!.trimStartMs / 1000;
      audio.play();
    }
    function onTimeUpdate() {
      if (!audio) return;
      const endSec = track!.trimEndMs != null ? track!.trimEndMs / 1000 : audio.duration;
      setCurrentTime(audio.currentTime - track!.trimStartMs / 1000);
      if (audio.currentTime >= endSec) {
        audio.pause();
        setIsPlaying(false);
      }
    }
    function onPlay() {
      setIsPlaying(true);
    }
    function onPause() {
      setIsPlaying(false);
    }

    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    return () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, [track]);

  if (!track) return null;

  const durationSec = track.trimEndMs != null ? (track.trimEndMs - track.trimStartMs) / 1000 : null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-ink-700 bg-ink-900/95 backdrop-blur">
      <audio ref={audioRef} src={track.url} />
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-3">
        <button
          type="button"
          onClick={() => (isPlaying ? audioRef.current?.pause() : audioRef.current?.play())}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-signal text-ink-950"
        >
          {isPlaying ? "⏸" : "▶"}
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-ink-100">{track.title}</p>
          <p className="truncate text-xs text-ink-500">{track.artist ?? "—"}</p>
        </div>

        <span className="shrink-0 font-mono text-xs text-ink-500">
          {formatTime(currentTime)}
          {durationSec != null ? ` / ${formatTime(durationSec)}` : ""}
        </span>

        <button
          type="button"
          onClick={() => {
            audioRef.current?.pause();
            onClose();
          }}
          className="shrink-0 rounded-md px-2 py-1 text-xs text-ink-500 transition hover:bg-ink-800"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
