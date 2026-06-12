import { useState, useCallback, useRef, useEffect } from 'react';
import type { SkeletonKey, SkeletonElement, Point } from '../types';
import { SKELETON_KEYS } from '../types';
import { loadOpenCV } from '../utils/opencvLoader';
import { trackPoints, frameToGray, type TrackedPoint } from '../utils/opticalFlow';

// Joints à initialiser (dans l'ordre du guide visuel) — sans la tête
export const TRACKING_JOINTS: SkeletonKey[] = [
  'shoulder', 'elbow', 'wrist', 'hip', 'knee', 'ankle', 'toes',
];

export type TrackingMode =
  | 'off'            // désactivé
  | 'loading'        // OpenCV en cours de chargement
  | 'initializing'   // attente des clics utilisateur
  | 'active';        // tracking en cours

export interface TrackingState {
  mode: TrackingMode;
  /** Index du joint en attente de clic (mode initializing) */
  initIndex: number;
  /** Points trackés (mode active) */
  points: TrackedPoint[];
  /** Erreur éventuelle */
  error: string | null;
}

interface UseTrackingOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Callback appelé à chaque frame avec les nouvelles positions des joints */
  onUpdateSkeleton: (positions: Partial<Record<SkeletonKey, Point>>) => void;
  /** Callback appelé à chaque frame avec les positions des points libres (trajectoires) */
  onUpdateTrajectories: (points: TrackedPoint[]) => void;
}

export function useTracking({ videoRef, onUpdateSkeleton, onUpdateTrajectories }: UseTrackingOptions) {
  const [state, setState] = useState<TrackingState>({
    mode: 'off',
    initIndex: 0,
    points: [],
    error: null,
  });

  // Refs pour la boucle RAF (évite les stale closures)
  const rafRef       = useRef<number | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prevGrayRef  = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cvRef        = useRef<any>(null);
  const pointsRef    = useRef<TrackedPoint[]>([]);

  // ── Nettoyage ──────────────────────────────────────────────────────────────

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (prevGrayRef.current && cvRef.current) {
      (prevGrayRef.current as { delete: () => void }).delete();
      prevGrayRef.current = null;
    }
  }, []);

  useEffect(() => () => stopLoop(), [stopLoop]);

  // ── Boucle RAF ─────────────────────────────────────────────────────────────

  const loop = useCallback(() => {
    const video = videoRef.current;
    const cv    = cvRef.current;
    if (!video || !cv || video.paused || video.ended) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }

    try {
      const nextGray = frameToGray(cv, video) as { delete: () => void };

      if (prevGrayRef.current && pointsRef.current.length > 0) {
        const updated = trackPoints(cv, prevGrayRef.current, nextGray, pointsRef.current);
        pointsRef.current = updated;

        // Séparer joints squelette vs points libres
        const skeletonPositions: Partial<Record<SkeletonKey, Point>> = {};
        const freePoints: TrackedPoint[] = [];

        for (const pt of updated) {
          if ((SKELETON_KEYS as readonly string[]).includes(pt.key)) {
            if (!pt.lost) skeletonPositions[pt.key as SkeletonKey] = { x: pt.x, y: pt.y };
          } else {
            freePoints.push(pt);
          }
        }

        onUpdateSkeleton(skeletonPositions);
        if (freePoints.length > 0) onUpdateTrajectories(freePoints);
      }

      // Rotation des frames
      if (prevGrayRef.current) (prevGrayRef.current as { delete: () => void }).delete();
      prevGrayRef.current = nextGray;

    } catch {
      // Frame invalide (vidéo en cours de chargement), on skippe silencieusement
    }

    rafRef.current = requestAnimationFrame(loop);
  }, [videoRef, onUpdateSkeleton, onUpdateTrajectories]);

  // ── API publique ───────────────────────────────────────────────────────────

  /** Active le mode tracking — charge OpenCV si nécessaire, puis demande l'init */
  const startTracking = useCallback(async () => {
    setState(s => ({ ...s, mode: 'loading', error: null }));
    try {
      const cv = await loadOpenCV();
      cvRef.current = cv;
      setState(s => ({ ...s, mode: 'initializing', initIndex: 0, points: [] }));
    } catch (e) {
      setState(s => ({ ...s, mode: 'off', error: (e as Error).message }));
    }
  }, []);

  /** Arrête tout et remet à zéro */
  const stopTracking = useCallback(() => {
    stopLoop();
    pointsRef.current = [];
    setState({ mode: 'off', initIndex: 0, points: [], error: null });
  }, [stopLoop]);

  /** Enregistre un clic utilisateur pendant l'initialisation.
   *  @param x, y  Coordonnées dans le repère vidéo naturel (px) */
  const registerInitClick = useCallback((x: number, y: number) => {
    setState(prev => {
      if (prev.mode !== 'initializing') return prev;

      const joint = TRACKING_JOINTS[prev.initIndex];
      const newPoint: TrackedPoint = { key: joint, x, y, lost: false };
      const newPoints = [...prev.points, newPoint];
      const nextIndex = prev.initIndex + 1;
      const done = nextIndex >= TRACKING_JOINTS.length;

      pointsRef.current = newPoints;

      if (done) {
        // Tous les joints initialisés → démarrage de la boucle
        const video = videoRef.current;
        const cv = cvRef.current;
        if (video && cv) {
          prevGrayRef.current = frameToGray(cv, video);
        }
        rafRef.current = requestAnimationFrame(loop);
        return { ...prev, mode: 'active', initIndex: nextIndex, points: newPoints };
      }

      return { ...prev, initIndex: nextIndex, points: newPoints };
    });
  }, [videoRef, loop]);

  /** Ajoute un point libre (trajectoire) — utilisable en mode active */
  const addFreePoint = useCallback((x: number, y: number, label: string) => {
    const newPoint: TrackedPoint = { key: label, x, y, lost: false };
    pointsRef.current = [...pointsRef.current, newPoint];
    setState(s => ({ ...s, points: pointsRef.current }));
  }, []);

  /** Supprime tous les points libres de trajectoire */
  const clearFreePoints = useCallback(() => {
    pointsRef.current = pointsRef.current.filter(
      p => (SKELETON_KEYS as readonly string[]).includes(p.key),
    );
    setState(s => ({ ...s, points: pointsRef.current }));
  }, []);

  return {
    tracking: state,
    startTracking,
    stopTracking,
    registerInitClick,
    addFreePoint,
    clearFreePoints,
  };
}

/** Applique les nouvelles positions de joints à un SkeletonElement existant.
 *  Les coordonnées LK sont dans le repère vidéo naturel → il faut convertir
 *  en coordonnées canvas avec zoom/pan si nécessaire (fait côté appelant). */
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
