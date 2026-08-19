// Client uniquement — utilise l'API Web Audio du navigateur.

export interface PeakData {
  min: Float32Array;
  max: Float32Array;
  sampleCount: number;
  durationSec: number;
}

// Résolution des pics calquée sur le zoom maximal de l'éditeur (px/sec) avec
// une marge, pour qu'un pic corresponde toujours à au plus ~1px à l'écran —
// sinon le zoom "étire" des blocs identiques au lieu d'affiner le tracé.
const MAX_ZOOM_PX_PER_SEC = 400;
const PEAKS_PER_SECOND = MAX_ZOOM_PX_PER_SEC * 1.5;

export async function decodeAndExtractPeaks(arrayBuffer: ArrayBuffer): Promise<{ peaks: PeakData; buffer: AudioBuffer }> {
  const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioContextCtor();
  const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
  await ctx.close();

  const channelData = buffer.getChannelData(0);
  const targetPeaks = Math.ceil(buffer.duration * PEAKS_PER_SECOND);
  const samplesPerPeak = Math.max(1, Math.floor(channelData.length / targetPeaks));
  const sampleCount = Math.ceil(channelData.length / samplesPerPeak);

  const min = new Float32Array(sampleCount);
  const max = new Float32Array(sampleCount);

  for (let i = 0; i < sampleCount; i++) {
    const start = i * samplesPerPeak;
    const end = Math.min(start + samplesPerPeak, channelData.length);
    let lo = 1;
    let hi = -1;
    for (let j = start; j < end; j++) {
      const v = channelData[j];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    min[i] = lo;
    max[i] = hi;
  }

  return {
    peaks: { min, max, sampleCount, durationSec: buffer.duration },
    buffer,
  };
}

export function timeToPeakIndex(peaks: PeakData, seconds: number): number {
  return Math.round((seconds / peaks.durationSec) * peaks.sampleCount);
}
