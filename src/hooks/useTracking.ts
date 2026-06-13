import { useState, useCallback, useRef, useEffect } from 'react';
import type { SkeletonKey, SkeletonElement, Point } from '../types';
import { SKELETON_KEYS } from '../types';
import type { LKPoint } from '../utils/lkFlow';

export const TRACKING_JOINTS: SkeletonKey[] = [
  'shoulder', 'elbow', 'wrist', 'hip', 'knee', 'ankle', 'toes',
];

export type TrackingMode = 'off' | 'active';

export interface TrackingState {
  mode:   TrackingMode;
  source: 'skeleton' | 'trajectory' | null;
  error:  string | null;
}

const MAX_HISTORY = 64; // suffisant pour le dessin incrémental (on ne redessine jamais depuis zéro)

export interface TrajectoryEntry {
  color:      string;
  initialX:   number;   // position initiale en coords naturelles (permanente)
  initialY:   number;
  totalAdded: number;   // total de points jamais ajoutés (index absolu pour la couleur)
  points:     { x: number; y: number }[];  // buffer tournant, MAX_HISTORY derniers points
}

export type TrajectoryHistory = Map<string, TrajectoryEntry>;

export const FREE_COLORS = ['#84cc16', '#06b6d4', '#f97316', '#a855f7', '#f43f5e', '#22d3ee', '#fb923c'];

interface UseTrackingOptions {
  videoRef:         React.RefObject<HTMLVideoElement | null>;
  onUpdateSkeleton: (positions: Partial<Record<SkeletonKey, Point>>) => void;
}

export function useTracking({ videoRef, onUpdateSkeleton }: UseTrackingOptions) {
  const [state, setState] = useState<TrackingState>({ mode: 'off', source: null, error: null });

  const workerRef        = useRef<Worker | null>(null);
  const rafRef           = useRef<number | null>(null);
  const captureCanvasRef = useRef<OffscreenCanvas | null>(null);
  const onUpdateRef      = useRef(onUpdateSkeleton);
  useEffect(() => { onUpdateRef.current = onUpdateSkeleton; }, [onUpdateSkeleton]);

  const trajectoryHistoryRef = useRef<TrajectoryHistory>(new Map());

  // ── Nettoyage ─────────────────────────────────────────────────────────────

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  }, []);

  const destroyWorker = useCallback(() => {
    stopLoop();
    workerRef.current?.terminate();
    workerRef.current = null;
  }, [stopLoop]);

  useEffect(() => () => destroyWorker(), [destroyWorker]);

  // ── Boucle RAF ────────────────────────────────────────────────────────────

  const loop = useCallback(() => {
    const video  = videoRef.current;
    const worker = workerRef.current;

    if (!video || !worker || !video.videoWidth || video.paused || video.ended) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }

    if (
      !captureCanvasRef.current ||
      captureCanvasRef.current.width  !== video.videoWidth ||
      captureCanvasRef.current.height !== video.videoHeight
    ) {
      captureCanvasRef.current = new OffscreenCanvas(video.videoWidth, video.videoHeight);
    }

    const ctx = captureCanvasRef.current.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
    if (!ctx) { rafRef.current = requestAnimationFrame(loop); return; }

    ctx.drawImage(video, 0, 0);
    const imageData = ctx.getImageData(0, 0, video.videoWidth, video.videoHeight);

    worker.postMessage(
      { type: 'frame', buffer: imageData.data.buffer, width: video.videoWidth, height: video.videoHeight },
      [imageData.data.buffer],
    );

    rafRef.current = requestAnimationFrame(loop);
  }, [videoRef]);

  // ── API publique ──────────────────────────────────────────────────────────

  const startTracking = useCallback((initPoints: LKPoint[], source: 'skeleton' | 'trajectory' = 'skeleton') => {
    destroyWorker();
    trajectoryHistoryRef.current.clear();

    const worker = new Worker(
      new URL('../workers/tracker.worker.ts', import.meta.url),
      { type: 'module' },
    );

    worker.onmessage = (e: MessageEvent<{ type: 'tracked'; points: LKPoint[] }>) => {
      if (e.data.type !== 'tracked') return;
      const skPos: Partial<Record<SkeletonKey, Point>> = {};

      for (const pt of e.data.points) {
        if (pt.lost) continue;
        if ((SKELETON_KEYS as readonly string[]).includes(pt.key)) {
          skPos[pt.key as SkeletonKey] = { x: pt.x, y: pt.y };
        } else if (!pt.key.startsWith('sk-')) {
          const entry = trajectoryHistoryRef.current.get(pt.key);
          if (entry) {
            entry.points.push({ x: pt.x, y: pt.y });
            entry.totalAdded++;
            if (entry.points.length > MAX_HISTORY) entry.points.shift();
          }
        }
      }

      onUpdateRef.current(skPos);
    };

    worker.onerror = (err) => {
      setState(s => ({ ...s, mode: 'off', error: err.message }));
      destroyWorker();
    };

    workerRef.current = worker;
    worker.postMessage({ type: 'init', points: initPoints });
    rafRef.current = requestAnimationFrame(loop);
    setState({ mode: 'active', source, error: null });
  }, [destroyWorker, loop]);

  const stopTracking = useCallback(() => {
    destroyWorker();
    trajectoryHistoryRef.current.clear();
    setState({ mode: 'off', source: null, error: null });
  }, [destroyWorker]);

  /** Ajoute un point libre au tracking. La clé = ID du calque associé. */
  const addFreePoint = useCallback((natX: number, natY: number, key: string, color: string) => {
    const worker = workerRef.current;
    if (!worker) return;
    trajectoryHistoryRef.current.set(key, { color, initialX: natX, initialY: natY, totalAdded: 0, points: [] });
    worker.postMessage({ type: 'add-point', point: { key, x: natX, y: natY, lost: false } });
  }, []);

  return { tracking: state, startTracking, stopTracking, addFreePoint, trajectoryHistoryRef };
}

// ── Helper exporté ────────────────────────────────────────────────────────────

export function applyTrackingToSkeleton(
  skeleton: SkeletonElement,
  positions: Partial<Record<SkeletonKey, Point>>,
): SkeletonElement {
  const updated = { ...skeleton, points: { ...skeleton.points } };
  for (const [key, pt] of Object.entries(positions) as [SkeletonKey, Point][]) {
    if (pt) updated.points[key] = pt;
  }
  return updated;
}
