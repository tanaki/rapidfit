import { useRef, useEffect } from 'react';
import { contentTransform } from '../utils/canvas';
import type { VideoRect } from '../hooks/useVideoRect';
import type { TrajectoryHistory, TrajectoryEntry } from '../hooks/useTracking';
import type { Layer, SkeletonKey, SkeletonElement } from '../types';

interface Props {
  trajectoryHistoryRef: React.MutableRefObject<TrajectoryHistory>;
  lostJointsRef:        React.MutableRefObject<Set<SkeletonKey>>;
  jointConfidenceRef:   React.MutableRefObject<Map<SkeletonKey, number>>;
  definitiveLostRef:    React.MutableRefObject<Set<SkeletonKey>>;
  layers:    Layer[];
  zoom:      number;
  pan:       { x: number; y: number };
  videoRect: VideoRect | null;
  imgW:      number;
  imgH:      number;
}

// ── Couleur ───────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function lighten(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.round(r + (255 - r) * factor)},${Math.round(g + (255 - g) * factor)},${Math.round(b + (255 - b) * factor)})`;
}

const COLOR_DRIFT_FRAMES = 1800; // ~60 s à 30 fps
const COLOR_DRIFT_MAX    = 0.55;

export function segmentColor(baseColor: string, globalIdx: number): string {
  return lighten(baseColor, Math.min(globalIdx / COLOR_DRIFT_FRAMES, 1) * COLOR_DRIFT_MAX);
}

// ── Dessin incrémental sur canvas vidéo-coords ────────────────────────────────
// On ne dessine que les points pas encore tracés (à partir de `drawnCount`).
// Au restore (drawnCount=0), tout le chemin est redessiné d'un coup.

function appendSegments(
  ctx:        CanvasRenderingContext2D,
  entry:      TrajectoryEntry,
  lineW:      number,
  drawnCount: number,
) {
  const { color, points } = entry;

  ctx.lineCap  = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = lineW;

  for (let i = Math.max(drawnCount, 1); i < points.length; i++) {
    ctx.strokeStyle = segmentColor(color, i);
    ctx.beginPath();
    ctx.moveTo(points[i - 1].x, points[i - 1].y);
    ctx.lineTo(points[i].x,     points[i].y);
    ctx.stroke();
  }
}

// ── Composant ─────────────────────────────────────────────────────────────────

export function TrajectoryCanvas({
  trajectoryHistoryRef, lostJointsRef, jointConfidenceRef, definitiveLostRef,
  layers, zoom, pan, videoRect, imgW, imgH,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const layersRef = useRef(layers);
  const zoomRef   = useRef(zoom);
  const panRef    = useRef(pan);
  const vrRef     = useRef(videoRect);
  const imgWRef   = useRef(imgW);
  const imgHRef   = useRef(imgH);
  useEffect(() => { layersRef.current = layers; }, [layers]);
  useEffect(() => { zoomRef.current = zoom; },      [zoom]);
  useEffect(() => { panRef.current  = pan; },       [pan]);
  useEffect(() => { vrRef.current   = videoRect; }, [videoRect]);
  useEffect(() => { imgWRef.current = imgW; },      [imgW]);
  useEffect(() => { imgHRef.current = imgH; },      [imgH]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const obs = new ResizeObserver(([entry]) => {
      canvas.width  = Math.round(entry.contentRect.width);
      canvas.height = Math.round(entry.contentRect.height);
    });
    obs.observe(canvas.parentElement!);
    return () => obs.disconnect();
  }, []);

  const perKeyRef    = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const drawnUpToRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    let rafId: number;

    const draw = () => {
      const canvas = canvasRef.current;
      const vr     = vrRef.current;
      const iW     = imgWRef.current;
      const iH     = imgHRef.current;

      if (!canvas || !vr || !iW || !iH) { rafId = requestAnimationFrame(draw); return; }

      const ctx = canvas.getContext('2d');
      if (!ctx) { rafId = requestAnimationFrame(draw); return; }

      const W = canvas.width;
      const H = canvas.height;
      const z = zoomRef.current;
      const p = panRef.current;

      const { tx, ty } = contentTransform(z, { x: p.x + vr.x, y: p.y + vr.y }, W, H);

      const history  = trajectoryHistoryRef.current;
      const layerMap = new Map(layersRef.current.map(l => [l.id, l]));
      const isVisible = (key: string) => { const l = layerMap.get(key); return !!l && l.visible !== false; };

      // Supprimer les canvas des trajectoires effacées
      for (const key of perKeyRef.current.keys()) {
        if (!history.has(key)) {
          perKeyRef.current.delete(key);
          drawnUpToRef.current.delete(key);
        }
      }

      const lineW = 1.5 / ((vr.w / iW) * z);

      // Accumuler les nouveaux segments sur chaque canvas par-trajectoire
      for (const [key, entry] of history) {
        let oc = perKeyRef.current.get(key);
        if (!oc) {
          oc = document.createElement('canvas');
          oc.width  = iW;
          oc.height = iH;
          perKeyRef.current.set(key, oc);
        }

        const drawnCount = drawnUpToRef.current.get(key) ?? 0;

        if (entry.points.length > drawnCount && entry.points.length >= 2) {
          const oct = oc.getContext('2d')!;
          appendSegments(oct, entry, lineW, drawnCount);
        }

        drawnUpToRef.current.set(key, entry.points.length);
      }

      // ── Composite ────────────────────────────────────────────────────────
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.setTransform(z, 0, 0, z, tx, ty);

      for (const [key, oc] of perKeyRef.current) {
        if (!isVisible(key)) continue;
        ctx.drawImage(oc, 0, 0, iW, iH, 0, 0, vr.w, vr.h);
      }

      // ── Marqueurs dynamiques (crosshair au point courant) ────────────────
      if (history.size > 0) {
        const curR  = 4.5 / z;
        const tickL = 6   / z;

        for (const [key, entry] of history) {
          if (!isVisible(key)) continue;
          const { color, points, initialX, initialY } = entry;

          const px = points.length > 0 ? points[points.length - 1].x : initialX;
          const py = points.length > 0 ? points[points.length - 1].y : initialY;
          const cx = (px / iW) * vr.w;
          const cy = (py / iH) * vr.h;

          const curColor = segmentColor(color, points.length);
          ctx.strokeStyle = curColor;
          ctx.fillStyle   = curColor;
          ctx.lineWidth   = 1.5 / z;
          ctx.lineCap     = 'round';

          ctx.beginPath();
          ctx.arc(cx, cy, curR, 0, Math.PI * 2);
          ctx.stroke();

          const gap = curR * 0.35;
          ctx.beginPath();
          ctx.moveTo(cx, cy - curR - gap); ctx.lineTo(cx, cy - curR - gap - tickL);
          ctx.moveTo(cx, cy + curR + gap); ctx.lineTo(cx, cy + curR + gap + tickL);
          ctx.moveTo(cx - curR - gap, cy); ctx.lineTo(cx - curR - gap - tickL, cy);
          ctx.moveTo(cx + curR + gap, cy); ctx.lineTo(cx + curR + gap + tickL, cy);
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(cx, cy, 1.5 / z, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // ── Indicateurs de confiance joints squelette ────────────────────────
      const lost       = lostJointsRef.current;
      const confidence = jointConfidenceRef.current;
      const definitive = definitiveLostRef.current;

      if (lost.size > 0 || confidence.size > 0) {
        let skEl: SkeletonElement | null = null;
        for (const l of layersRef.current) {
          if (l.visible === false) continue;
          const sk = l.elements.find(e => e.type === 'skeleton');
          if (sk) { skEl = sk as SkeletonElement; break; }
        }

        if (skEl) {
          const t = performance.now() / 1000;

          ctx.lineWidth = 2 / z;
          ctx.lineCap   = 'round';
          ctx.setLineDash([]);

          for (const key of Object.keys(skEl.points) as SkeletonKey[]) {
            const pt     = skEl.points[key];
            const isLost = lost.has(key);
            const conf   = confidence.get(key) ?? 1;
            const uncertain = !isLost && conf < 0.6;

            if (!isLost && !uncertain) continue;

            const r = (isLost ? 7 : 6) / z;

            if (isLost) {
              const isDef = definitive.has(key);
              if (isDef) {
                // Perdu définitivement : rouge plein, fixe — suggère de double-cliquer
                ctx.globalAlpha  = 0.95;
                ctx.strokeStyle  = '#ef4444';
                ctx.fillStyle    = 'rgba(239,68,68,0.22)';
                ctx.lineWidth    = 2.5 / z;
                ctx.beginPath(); ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath(); ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
                ctx.stroke();
                // Croix pleine
                const cr = r * 0.55;
                ctx.lineWidth = 2 / z;
                ctx.beginPath();
                ctx.moveTo(pt.x - cr, pt.y - cr); ctx.lineTo(pt.x + cr, pt.y + cr);
                ctx.moveTo(pt.x + cr, pt.y - cr); ctx.lineTo(pt.x - cr, pt.y + cr);
                ctx.stroke();
              } else {
                // Perdu récemment : rouge pulsant
                const pulse = 0.55 + 0.45 * Math.sin(t * 4);
                ctx.globalAlpha  = pulse;
                ctx.strokeStyle  = '#ef4444';
                ctx.fillStyle    = 'rgba(239,68,68,0.15)';
                ctx.lineWidth    = 2 / z;
                ctx.beginPath(); ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath(); ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
                ctx.stroke();
                const cr = r * 0.5;
                ctx.beginPath();
                ctx.moveTo(pt.x - cr, pt.y - cr); ctx.lineTo(pt.x + cr, pt.y + cr);
                ctx.moveTo(pt.x + cr, pt.y - cr); ctx.lineTo(pt.x - cr, pt.y + cr);
                ctx.stroke();
              }
              ctx.globalAlpha = 1;
            } else {
              // Confiance partielle — anneau orange
              ctx.globalAlpha  = 0.75;
              ctx.strokeStyle  = '#f97316';
              ctx.lineWidth    = 2 / z;
              ctx.beginPath(); ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
              ctx.stroke();
              ctx.globalAlpha = 1;
            }
          }
        }
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [trajectoryHistoryRef, lostJointsRef, jointConfidenceRef, definitiveLostRef]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 60 }}
      width={0}
      height={0}
    />
  );
}
