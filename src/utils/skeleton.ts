import type { Point, SkeletonElement, SkeletonKey, Discipline } from '../types';
import { SKELETON_KEYS } from '../types';

// ── Skeleton topology ─────────────────────────────────────────────────────────

/** Body segments drawn as solid lines: [from, to] */
export const SKELETON_SEGMENTS: [SkeletonKey, SkeletonKey][] = [
  ['wrist',    'elbow'],
  ['elbow',    'shoulder'],
  ['shoulder', 'hip'],
  ['hip',      'knee'],
  ['knee',     'ankle'],
  ['ankle',    'toes'],
];

/** Head-alignment reference segment (drawn dashed) */
export const SKELETON_HEAD_SEGMENT: [SkeletonKey, SkeletonKey] = ['shoulder', 'head'];

/** Joints where angles are displayed: [vertex, arm1, arm2] */
export const SKELETON_ANGLES: [SkeletonKey, SkeletonKey, SkeletonKey][] = [
  ['elbow',    'wrist',    'shoulder'],
  ['shoulder', 'elbow',    'hip'],
  ['hip',      'shoulder', 'knee'],
  ['knee',     'hip',      'ankle'],
  ['ankle',    'knee',     'toes'],
];

/** French label for each joint */
export const SKELETON_LABELS: Record<SkeletonKey, string> = {
  shoulder: 'Épaule',
  elbow:    'Coude',
  wrist:    'Poignet',
  hip:      'Hanche',
  knee:     'Genou',
  ankle:    'Cheville',
  toes:     'Orteils',
  head:     'Tête',
};

// ── Default positions ─────────────────────────────────────────────────────────

/**
 * Build a default skeleton anchored on `hip` (click point).
 * `scale` ≈ imgH / 4 gives realistic proportions for a typical bike-fit video.
 * Cyclist facing LEFT (negative-x direction).
 *
 * Positions are calibrated per discipline from src/data/referenceAngles.ts:
 *   route/gravel — trunk ~42°, elbow ~160°, shoulder ~87°
 *   clm          — trunk ~30°, elbow ~90° (tribars), very aero
 *   vtt          — trunk ~57°, more upright, ankle more dorsiflexed
 */
export function defaultSkeletonPoints(
  hip: Point,
  scale: number,
  discipline: Discipline = 'route',
): Record<SkeletonKey, Point> {
  const o = (fx: number, fy: number): Point => ({
    x: hip.x + fx * scale,
    y: hip.y + fy * scale,
  });

  // All offsets are relative to the HIP (anchor), cyclist facing LEFT (negative x = forward).
  // Upper body varies by discipline (trunk lean + arm position).
  switch (discipline) {
    case 'clm':
      // Trunk ~30° from horizontal (nearly flat). Tribars: elbow ~90°.
      return {
        hip,
        shoulder: o(-0.39, -0.23),
        head:     o(-0.47, -0.48),
        elbow:    o(-0.44, -0.04),
        wrist:    o(-0.64, -0.08),
        knee:     o(-0.14, +0.44),
        ankle:    o(-0.12, +0.96),
        toes:     o(-0.30, +1.02),
      };
    case 'vtt':
      // Trunk ~57° from horizontal (more upright). Ankle more dorsiflexed.
      return {
        hip,
        shoulder: o(-0.22, -0.34),
        head:     o(-0.32, -0.60),
        elbow:    o(-0.42, -0.18),
        wrist:    o(-0.56, -0.06),
        knee:     o(-0.14, +0.44),
        ankle:    o(-0.20, +0.94),
        toes:     o(-0.38, +1.00),
      };
    case 'gravel':
      // Trunk ~43° — marginally more upright than route, otherwise identical.
      return {
        hip,
        shoulder: o(-0.24, -0.37),
        head:     o(-0.36, -0.65),
        elbow:    o(-0.49, -0.19),
        wrist:    o(-0.63, -0.07),
        knee:     o(-0.14, +0.44),
        ankle:    o(-0.12, +0.96),
        toes:     o(-0.30, +1.02),
      };
    case 'route':
    default:
      // Trunk ~42°, shoulder ≈ 90°, elbow ≈ 160°.
      return {
        hip,
        shoulder: o(-0.25, -0.36),
        head:     o(-0.37, -0.64),
        elbow:    o(-0.51, -0.18),
        wrist:    o(-0.65, -0.06),
        knee:     o(-0.14, +0.44),
        ankle:    o(-0.12, +0.96),
        toes:     o(-0.30, +1.02),
      };
  }
}

// ── Drawing ───────────────────────────────────────────────────────────────────

/** Draw an angle arc + degree label at a joint vertex between two adjacent segments. */
function drawSkeletonAngle(
  ctx: CanvasRenderingContext2D,
  vertex: Point, pa: Point, pb: Point,
  zoom: number, color: string, strokeWidth: number,
) {
  const v1 = { x: pa.x - vertex.x, y: pa.y - vertex.y };
  const v2 = { x: pb.x - vertex.x, y: pb.y - vertex.y };
  const mag1 = Math.hypot(v1.x, v1.y);
  const mag2 = Math.hypot(v2.x, v2.y);
  if (mag1 < 1 || mag2 < 1) return;

  const dot = v1.x * v2.x + v1.y * v2.y;
  const angleDeg = Math.round(
    Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2)))) * (180 / Math.PI) * 10,
  ) / 10;

  const a1 = Math.atan2(pa.y - vertex.y, pa.x - vertex.x);
  const a2 = Math.atan2(pb.y - vertex.y, pb.x - vertex.x);
  const cwSweep = ((a2 - a1) + 2 * Math.PI) % (2 * Math.PI);
  const anticlockwise = cwSweep > Math.PI;

  const radius = 26 / zoom;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, strokeWidth * 0.6) / zoom;
  ctx.globalAlpha = 0.75;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(vertex.x, vertex.y, radius, a1, a2, anticlockwise);
  ctx.stroke();
  ctx.globalAlpha = 1;

  const halfSweep = anticlockwise ? -((2 * Math.PI - cwSweep) / 2) : cwSweep / 2;
  const midAngle  = a1 + halfSweep;
  const labelDist = radius + 13 / zoom;
  const lx = vertex.x + labelDist * Math.cos(midAngle);
  const ly = vertex.y + labelDist * Math.sin(midAngle);

  const label    = `${angleDeg}°`;
  const fontSize = (10 + strokeWidth) / zoom;
  ctx.font = `bold ${fontSize}px system-ui`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  const w  = ctx.measureText(label).width + 6 / zoom;
  const bh = 17 / zoom;
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.beginPath();
  ctx.roundRect(lx - w / 2, ly - bh / 2, w, bh, 3 / zoom);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillText(label, lx, ly);
}

export function drawSkeleton(ctx: CanvasRenderingContext2D, el: SkeletonElement, zoom: number) {
  const { points, color, strokeWidth } = el;

  ctx.strokeStyle = color;
  ctx.lineCap = 'round';

  // ── Body segments ──
  ctx.lineWidth = strokeWidth / zoom;
  ctx.setLineDash([]);
  for (const [a, b] of SKELETON_SEGMENTS) {
    ctx.beginPath();
    ctx.moveTo(points[a].x, points[a].y);
    ctx.lineTo(points[b].x, points[b].y);
    ctx.stroke();
  }

  // ── Head segment (dashed) ──
  ctx.lineWidth = Math.max(1, strokeWidth * 0.8) / zoom;
  ctx.globalAlpha = 0.6;
  ctx.setLineDash([5 / zoom, 4 / zoom]);
  const [hs, he] = SKELETON_HEAD_SEGMENT;
  ctx.beginPath();
  ctx.moveTo(points[hs].x, points[hs].y);
  ctx.lineTo(points[he].x, points[he].y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // ── Pre-compute arc bisector direction for every angle joint ──
  // The degree label sits along this direction (interior of angle).
  // The joint name label will be placed in the OPPOSITE direction to avoid overlap.
  const arcRadius   = 26 / zoom;
  const arcBisector = new Map<SkeletonKey, number>(); // radians
  for (const [vertex, a, b] of SKELETON_ANGLES) {
    const pv = points[vertex];
    const a1 = Math.atan2(points[a].y - pv.y, points[a].x - pv.x);
    const a2 = Math.atan2(points[b].y - pv.y, points[b].x - pv.x);
    const cwSweep     = ((a2 - a1) + 2 * Math.PI) % (2 * Math.PI);
    const anticlockwise = cwSweep > Math.PI;
    const halfSweep   = anticlockwise ? -((2 * Math.PI - cwSweep) / 2) : cwSweep / 2;
    arcBisector.set(vertex, a1 + halfSweep);
  }

  // ── Angle arcs + degree labels ──
  for (const [vertex, a, b] of SKELETON_ANGLES) {
    drawSkeletonAngle(ctx, points[vertex], points[a], points[b], zoom, color, strokeWidth);
  }

  // ── Build adjacency list (for joints without an arc) ──
  const allSegs: [SkeletonKey, SkeletonKey][] = [...SKELETON_SEGMENTS, SKELETON_HEAD_SEGMENT];
  const neighbors = new Map<SkeletonKey, SkeletonKey[]>();
  for (const key of SKELETON_KEYS) neighbors.set(key, []);
  for (const [a, b] of allSegs) {
    neighbors.get(a)!.push(b);
    neighbors.get(b)!.push(a);
  }

  /** Direction angle (radians) at which to place the joint name label. */
  function labelDir(key: SkeletonKey): number {
    if (arcBisector.has(key)) {
      // Opposite to the degree label (interior arc) → exterior direction
      return arcBisector.get(key)! + Math.PI;
    }
    // No arc: go away from the average position of neighbors
    const ns = neighbors.get(key)!;
    if (ns.length === 0) return -Math.PI / 2;
    const p    = points[key];
    const avgDx = ns.reduce((s, n) => s + (points[n].x - p.x), 0) / ns.length;
    const avgDy = ns.reduce((s, n) => s + (points[n].y - p.y), 0) / ns.length;
    return Math.atan2(-avgDy, -avgDx); // opposite direction
  }

  // ── Joint dots + name labels ──
  const dotR     = (3 + strokeWidth) / zoom;
  const fontSize = (10 + strokeWidth) / zoom;
  ctx.font         = `${fontSize}px system-ui`;
  ctx.textBaseline = 'middle';
  ctx.textAlign    = 'center';

  for (const key of SKELETON_KEYS) {
    const p = points[key];

    // Filled dot
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, dotR, 0, Math.PI * 2);
    ctx.fill();

    // Name label: push far enough to clear the arc (if any)
    const hasArc = arcBisector.has(key);
    const dist   = hasArc ? arcRadius + 15 / zoom : dotR + 10 / zoom;
    const dir    = labelDir(key);
    const lx = p.x + Math.cos(dir) * dist;
    const ly = p.y + Math.sin(dir) * dist;

    const txt = SKELETON_LABELS[key];
    const tw  = ctx.measureText(txt).width;
    const bh  = fontSize * 1.3;
    ctx.fillStyle = 'rgba(0,0,0,0.60)';
    ctx.beginPath();
    ctx.roundRect(lx - tw / 2 - 3 / zoom, ly - bh / 2, tw + 6 / zoom, bh, 2 / zoom);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.fillText(txt, lx, ly);
  }
}
