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

const DEFINITIVE_LOST_FRAMES = 30; // frames consécutives avant de marquer "perdu définitivement"

export interface TrajectoryEntry {
  elementId:  string;   // id de l'élément TrajectoryElement dans le calque (pour le bake)
  color:      string;
  initialX:   number;   // position initiale en coords naturelles (permanente)
  initialY:   number;
  totalAdded: number;   // total de points jamais ajoutés (== points.length, conservé pour compat)
  points:     { x: number; y: number }[];  // chemin complet (coords naturelles vidéo)
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

  const trajectoryHistoryRef  = useRef<TrajectoryHistory>(new Map());
  // Joints squelette perdus (lost=true) et confiance (err 0..1) — mis à jour chaque frame trackée
  const lostJointsRef         = useRef<Set<SkeletonKey>>(new Set());
  const jointConfidenceRef    = useRef<Map<SkeletonKey, number>>(new Map());
  // Compteur de frames consécutives perdues et ensemble des joints définitivement perdus
  const lostFramesRef         = useRef<Map<SkeletonKey, number>>(new Map());
  const definitiveLostRef     = useRef<Set<SkeletonKey>>(new Set());

  // ── Nettoyage ─────────────────────────────────────────────────────────────

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  }, []);

  const destroyWorker = useCallback(() => {
    stopLoop();
    workerRef.current?.terminate();
    workerRef.current = null;
    lostJointsRef.current.clear();
    jointConfidenceRef.current.clear();
    lostFramesRef.current.clear();
    definitiveLostRef.current.clear();
  }, [stopLoop]);

  useEffect(() => () => destroyWorker(), [destroyWorker]);

  // ── Boucle RAF — ne tourne que quand la vidéo joue ────────────────────────

  const loop = useCallback(() => {
    const video  = videoRef.current;
    const worker = workerRef.current;

    if (!video || !worker) { rafRef.current = null; return; }

    // Vidéo en pause ou terminée → on arrête le RAF ; il sera relancé sur 'play'
    if (!video.videoWidth || video.paused || video.ended) {
      rafRef.current = null;
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

      // Reset lost + confidence pour les joints squelette avant de repeupler
      lostJointsRef.current.clear();

      for (const pt of e.data.points) {
        if ((SKELETON_KEYS as readonly string[]).includes(pt.key)) {
          const key = pt.key as SkeletonKey;
          if (pt.lost) {
            lostJointsRef.current.add(key);
            // Incrémenter le compteur de frames perdues consécutives
            const n = (lostFramesRef.current.get(key) ?? 0) + 1;
            lostFramesRef.current.set(key, n);
            if (n >= DEFINITIVE_LOST_FRAMES) definitiveLostRef.current.add(key);
          } else {
            skPos[key] = { x: pt.x, y: pt.y };
            jointConfidenceRef.current.set(key, pt.err);
            // Joint retrouvé → réinitialiser le compteur
            lostFramesRef.current.set(key, 0);
            definitiveLostRef.current.delete(key);
          }
        } else if (!pt.key.startsWith('sk-')) {
          // Point libre (trajectoire)
          if (!pt.lost) {
            const entry = trajectoryHistoryRef.current.get(pt.key);
            if (entry) {
              entry.points.push({ x: pt.x, y: pt.y });
              entry.totalAdded++;
            }
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

    // Démarrer le RAF uniquement si la vidéo joue déjà
    const video = videoRef.current;
    if (video && !video.paused && !video.ended) {
      rafRef.current = requestAnimationFrame(loop);
    }

    // Relancer le RAF à chaque 'play' (pause → lecture)
    const onPlay = () => {
      if (workerRef.current && rafRef.current === null) {
        rafRef.current = requestAnimationFrame(loop);
      }
    };
    video?.addEventListener('play', onPlay);
    // Stocker le handler pour le retirer au destroyWorker suivant
    (workerRef.current as unknown as { _onPlay?: () => void })._onPlay = onPlay;

    setState({ mode: 'active', source, error: null });
  }, [destroyWorker, loop, videoRef]);

  // Retirer l'écouteur 'play' à l'arrêt du tracking
  const stopTracking = useCallback(() => {
    const video = videoRef.current;
    const w = workerRef.current as unknown as { _onPlay?: () => void } | null;
    if (video && w?._onPlay) video.removeEventListener('play', w._onPlay);
    destroyWorker();
    trajectoryHistoryRef.current.clear();
    setState({ mode: 'off', source: null, error: null });
  }, [destroyWorker, videoRef]);

  /** Ajoute un point libre au tracking. La clé = ID du calque associé. */
  const addFreePoint = useCallback((natX: number, natY: number, key: string, color: string, elementId: string) => {
    const worker = workerRef.current;
    if (!worker) return;
    trajectoryHistoryRef.current.set(key, {
      elementId, color, initialX: natX, initialY: natY, totalAdded: 0, points: [],
    });
    worker.postMessage({ type: 'add-point', point: { key, x: natX, y: natY, lost: false, err: 1 } });
  }, []);

  return {
    tracking: state,
    startTracking, stopTracking, addFreePoint,
    trajectoryHistoryRef,
    lostJointsRef,
    jointConfidenceRef,
    definitiveLostRef,
  };
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
