import { useState, useRef, useCallback } from 'react';
import type { Recording } from '../types';
import { uid } from '../utils/uid';
import { fileTimestamp } from '../utils/formatDate';

export function useRecorder() {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(
    (stream: MediaStream, videoBitrate: number, audioBitrate: number): void => {
      chunksRef.current = [];

      // pick best supported codec
      const mimeTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4',
      ];
      const mimeType = mimeTypes.find(m => MediaRecorder.isTypeSupported(m)) || '';

      const rec = new MediaRecorder(stream, {
        mimeType: mimeType || undefined,
        videoBitsPerSecond: videoBitrate * 1000,
        audioBitsPerSecond: audioBitrate * 1000,
      });

      rec.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      rec.start(100); // collect every 100ms
      recorderRef.current = rec;
      setIsRecording(true);
      setIsPaused(false);
      setElapsed(0);

      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    },
    [],
  );

  const pause = useCallback(() => {
    if (!recorderRef.current || recorderRef.current.state !== 'recording') return;
    recorderRef.current.pause();
    setIsPaused(true);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const resume = useCallback(() => {
    if (!recorderRef.current || recorderRef.current.state !== 'paused') return;
    recorderRef.current.resume();
    setIsPaused(false);
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
  }, []);

  const stop = useCallback((): Promise<Recording | null> => {
    return new Promise(resolve => {
      const rec = recorderRef.current;
      if (!rec) { resolve(null); return; }
      if (timerRef.current) clearInterval(timerRef.current);

      rec.onstop = () => {
        const mimeType = rec.mimeType || 'video/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const duration = elapsed;
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const name = `Vidéo_${fileTimestamp()}.${ext}`;
        resolve({ id: uid(), name, blob, url, createdAt: new Date(), duration });
      };

      rec.stop();
      setIsRecording(false);
      setIsPaused(false);
    });
  }, [elapsed]);

  return { isRecording, isPaused, elapsed, start, pause, resume, stop };
}

export function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
