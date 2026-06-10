import type { Point, AnnotationElement, AngleElement, HVAngleElement, SkeletonElement, SkeletonKey, Layer } from '../types';
import { SKELETON_KEYS } from '../types';

// ── Skeleton constants ────────────────────────────────────────────────────────

/** Body segments: pairs of [from, to] joint keys */
export const SKELETON_SEGMENTS: [SkeletonKey, SkeletonKey][] = [
  ['wrist',    'elbow'],
  ['elbow',    'shoulder'],
  ['shoulder', 'hip'],
  ['hip',      'knee'],
  ['knee',     'ankle'],
  ['ankle',    'toes'],
];

/** Head-alignment segment (drawn dashed) */
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

/**
 * Build a default skeleton centered on `shoulder`.
 * `scale` ≈ imgH / 4 gives realistic proportions for a typical bike-fit video.
 * Cyclist facing right (positive-x direction).
 */
export function defaultSkeletonPoints(shoulder: Point, scale: number): Record<SkeletonKey, Point> {
  const o = (fx: number, fy: number): Point => ({
    x: shoulder.x + fx * scale,
    y: shoulder.y + fy * scale,
  });
  return {
    shoulder,
    head:     o( 0.15, -0.32),   // above & slightly forward
    elbow:    o( 0.32,  0.16),   // at handlebar, forward-down
    wrist:    o( 0.48,  0.30),   // handlebar grip
    hip:      o(-0.28,  0.42),   // saddle, behind & below
    knee:     o(-0.14,  0.98),   // below hip
    ankle:    o(-0.04,  1.48),   // at pedal axle
    toes:     o( 0.22,  1.54),   // toe clip / foot forward
  };
}

// ── Geometry helpers ──────────────────────────────────────────────────────────

/** Angle (0–180°) between a line p1→p2 and the given fixed axis. */
export function computeHVAngle(p1: Point, p2: Point, mode: 'h' | 'v' = 'h'): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  if (dx === 0 && dy === 0) return 0;
  const rad = Math.atan2(dy, dx);
  const deg = rad * 180 / Math.PI;
  if (mode === 'h') {
    const a = Math.abs(deg);
    return Math.round((a > 90 ? 180 - a : a) * 10) / 10;
  } else {
    // Angle to vertical axis: 90° - angle-to-horizontal
    const toH = Math.abs(deg);
    const acuteH = toH > 90 ? 180 - toH : toH;
    return Math.round((90 - acuteH) * 10) / 10;
  }
}

export function computeAngle(p0: Point, vertex: Point, p2: Point): number {
  const v1 = { x: p0.x - vertex.x, y: p0.y - vertex.y };
  const v2 = { x: p2.x - vertex.x, y: p2.y - vertex.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.hypot(v1.x, v1.y);
  const mag2 = Math.hypot(v2.x, v2.y);
  if (mag1 === 0 || mag2 === 0) return 0;
  return Math.round(Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2)))) * (180 / Math.PI) * 10) / 10;
}

export function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function pathBounds(points: Point[]) {
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

// ── Hit testing ───────────────────────────────────────────────────────────────

export function hitTestElement(el: AnnotationElement, p: Point, tol = 8): boolean {
  switch (el.type) {
    case 'path': {
      const b = pathBounds(el.points);
      return p.x >= b.minX - tol && p.x <= b.maxX + tol && p.y >= b.minY - tol && p.y <= b.maxY + tol
        && el.points.some((_, i) => i > 0 && distToSegment(p, el.points[i - 1], el.points[i]) < tol);
    }
    case 'line':
    case 'arrow':
      return distToSegment(p, el.p1, el.p2) < tol;
    case 'rect': {
      const { x, y, w, h } = el;
      if (el.filled) return p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
      return (
        (p.x >= x - tol && p.x <= x + w + tol && (Math.abs(p.y - y) < tol || Math.abs(p.y - y - h) < tol)) ||
        (p.y >= y - tol && p.y <= y + h + tol && (Math.abs(p.x - x) < tol || Math.abs(p.x - x - w) < tol))
      );
    }
    case 'ellipse': {
      const dx = p.x - el.cx, dy = p.y - el.cy;
      if (el.rx === 0 || el.ry === 0) return false;
      const d = Math.sqrt((dx / el.rx) ** 2 + (dy / el.ry) ** 2);
      return el.filled ? d <= 1.1 : Math.abs(d - 1) < 0.25;
    }
    case 'text':
      return p.x >= el.x - tol && p.y >= el.y - tol && p.x <= el.x + 200 && p.y <= el.y + el.fontSize * 1.5;
    case 'hv-angle':
      return distToSegment(p, el.p1, el.p2) < tol;
    case 'angle':
      return distToSegment(p, el.p0, el.p1) < tol || distToSegment(p, el.p1, el.p2) < tol;
    case 'skeleton': {
      const segs: [SkeletonKey, SkeletonKey][] = [...SKELETON_SEGMENTS, SKELETON_HEAD_SEGMENT];
      for (const [a, b] of segs) {
        if (distToSegment(p, el.points[a], el.points[b]) < tol) return true;
      }
      return false;
    }
  }
}

// ── Handles ───────────────────────────────────────────────────────────────────

export type Handle = { x: number; y: number; index: number; cursor: string };

export function getHandles(el: AnnotationElement): Handle[] {
  switch (el.type) {
    case 'hv-angle':
    case 'line':
    case 'arrow':
      return [
        { ...el.p1, index: 0, cursor: 'grab' },
        { ...el.p2, index: 1, cursor: 'grab' },
      ];
    case 'rect':
      return [
        { x: el.x,          y: el.y,          index: 0, cursor: 'nw-resize' },
        { x: el.x + el.w,   y: el.y,          index: 1, cursor: 'ne-resize' },
        { x: el.x + el.w,   y: el.y + el.h,   index: 2, cursor: 'se-resize' },
        { x: el.x,          y: el.y + el.h,   index: 3, cursor: 'sw-resize' },
        { x: el.x + el.w/2, y: el.y,          index: 4, cursor: 'n-resize' },
        { x: el.x + el.w,   y: el.y + el.h/2, index: 5, cursor: 'e-resize' },
        { x: el.x + el.w/2, y: el.y + el.h,   index: 6, cursor: 's-resize' },
        { x: el.x,          y: el.y + el.h/2, index: 7, cursor: 'w-resize' },
      ];
    case 'ellipse':
      return [
        { x: el.cx,          y: el.cy,          index: 0, cursor: 'move' },
        { x: el.cx + el.rx,  y: el.cy,          index: 1, cursor: 'e-resize' },
        { x: el.cx,          y: el.cy + el.ry,  index: 2, cursor: 's-resize' },
        { x: el.cx - el.rx,  y: el.cy,          index: 3, cursor: 'w-resize' },
        { x: el.cx,          y: el.cy - el.ry,  index: 4, cursor: 'n-resize' },
      ];
    case 'text':
      return [{ x: el.x, y: el.y, index: 0, cursor: 'move' }];
    case 'angle':
      return [
        { ...el.p0, index: 0, cursor: 'grab' },
        { ...el.p1, index: 1, cursor: 'grab' },
        { ...el.p2, index: 2, cursor: 'grab' },
      ];
    case 'path': {
      const b = pathBounds(el.points);
      return [
        { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2, index: -1, cursor: 'move' },
      ];
    }
    case 'skeleton':
      return SKELETON_KEYS.map((key, i) => ({ ...el.points[key], index: i, cursor: 'grab' }));
  }
}

export function hitTestHandle(handles: Handle[], p: Point, radius = 8): Handle | null {
  for (const h of handles) {
    if (Math.hypot(h.x - p.x, h.y - p.y) <= radius) return h;
  }
  return null;
}

export function applyHandleDrag(el: AnnotationElement, handleIndex: number, newPt: Point): AnnotationElement {
  switch (el.type) {
    case 'hv-angle':
      return { ...(handleIndex === 0 ? { ...el, p1: newPt } : { ...el, p2: newPt }), angle: computeHVAngle(handleIndex === 0 ? newPt : el.p1, handleIndex === 0 ? el.p2 : newPt, el.mode) };
    case 'line':
    case 'arrow':
      return handleIndex === 0 ? { ...el, p1: newPt } : { ...el, p2: newPt };
    case 'rect': {
      const x1 = el.x, y1 = el.y, x2 = el.x + el.w, y2 = el.y + el.h;
      let [nx1, ny1, nx2, ny2] = [x1, y1, x2, y2];
      if (handleIndex === 0) { nx1 = newPt.x; ny1 = newPt.y; }
      else if (handleIndex === 1) { nx2 = newPt.x; ny1 = newPt.y; }
      else if (handleIndex === 2) { nx2 = newPt.x; ny2 = newPt.y; }
      else if (handleIndex === 3) { nx1 = newPt.x; ny2 = newPt.y; }
      else if (handleIndex === 4) { ny1 = newPt.y; }
      else if (handleIndex === 5) { nx2 = newPt.x; }
      else if (handleIndex === 6) { ny2 = newPt.y; }
      else if (handleIndex === 7) { nx1 = newPt.x; }
      return { ...el, x: Math.min(nx1, nx2), y: Math.min(ny1, ny2), w: Math.abs(nx2 - nx1), h: Math.abs(ny2 - ny1) };
    }
    case 'ellipse':
      if (handleIndex === 0) return { ...el, cx: newPt.x, cy: newPt.y };
      if (handleIndex === 1 || handleIndex === 3) return { ...el, rx: Math.max(1, Math.abs(newPt.x - el.cx)) };
      return { ...el, ry: Math.max(1, Math.abs(newPt.y - el.cy)) };
    case 'text':
      return { ...el, x: newPt.x, y: newPt.y };
    case 'angle': {
      const updated = handleIndex === 0 ? { ...el, p0: newPt }
        : handleIndex === 1 ? { ...el, p1: newPt }
        : { ...el, p2: newPt };
      return { ...updated, angle: computeAngle(updated.p0, updated.p1, updated.p2) };
    }
    case 'path': {
      return el; // handled by moveElement
    }
    case 'skeleton': {
      const key = SKELETON_KEYS[handleIndex];
      if (!key) return el;
      return { ...el, points: { ...el.points, [key]: newPt } };
    }
  }
}

export function moveElement(el: AnnotationElement, dx: number, dy: number): AnnotationElement {
  const m = (p: Point): Point => ({ x: p.x + dx, y: p.y + dy });
  switch (el.type) {
    case 'path':    return { ...el, points: el.points.map(m) };
    case 'hv-angle':
    case 'line':
    case 'arrow':   return { ...el, p1: m(el.p1), p2: m(el.p2) };
    case 'rect':    return { ...el, x: el.x + dx, y: el.y + dy };
    case 'ellipse': return { ...el, cx: el.cx + dx, cy: el.cy + dy };
    case 'text':    return { ...el, x: el.x + dx, y: el.y + dy };
    case 'angle':   return { ...el, p0: m(el.p0), p1: m(el.p1), p2: m(el.p2) };
    case 'skeleton': {
      const moved = { ...el.points } as Record<SkeletonKey, Point>;
      for (const key of SKELETON_KEYS) moved[key] = m(el.points[key]);
      return { ...el, points: moved };
    }
  }
}

// ── Canvas drawing ────────────────────────────────────────────────────────────
//
// The canvas is positioned at full screen resolution (outside the CSS zoom
// wrapper). A ctx.setTransform(zoom, 0, 0, zoom, tx, ty) maps content-space
// coordinates → screen pixels, so all element positions are correct.
//
// Visual sizes (stroke widths, handle radii, arc radius, label font…) are
// divided by `zoom` so that after the canvas transform multiplies them back
// by zoom they end up at a constant physical pixel size on screen.

function drawArrowhead(ctx: CanvasRenderingContext2D, from: Point, to: Point, size: number) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - size * Math.cos(angle - Math.PI / 6), to.y - size * Math.sin(angle - Math.PI / 6));
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - size * Math.cos(angle + Math.PI / 6), to.y - size * Math.sin(angle + Math.PI / 6));
  ctx.stroke();
}

function drawAngleArc(ctx: CanvasRenderingContext2D, el: AngleElement, zoom: number) {
  const { p0, p1, p2, color, strokeWidth } = el;
  const radius = 40 / zoom;
  const a1 = Math.atan2(p0.y - p1.y, p0.x - p1.x);
  const a2 = Math.atan2(p2.y - p1.y, p2.x - p1.x);

  const cwSweep = ((a2 - a1) + 2 * Math.PI) % (2 * Math.PI);
  const anticlockwise = cwSweep > Math.PI;

  ctx.strokeStyle = color;
  ctx.lineWidth = strokeWidth / zoom;
  ctx.beginPath();
  ctx.arc(p1.x, p1.y, radius, a1, a2, anticlockwise);
  ctx.stroke();

  const halfSweep = anticlockwise ? -((2 * Math.PI - cwSweep) / 2) : cwSweep / 2;
  const midAngle = a1 + halfSweep;
  const labelDist = radius + 18 / zoom;
  const lx = p1.x + labelDist * Math.cos(midAngle);
  const ly = p1.y + labelDist * Math.sin(midAngle);
  const label = `${el.angle}°`;
  const fontSize = (12 + strokeWidth) / zoom;
  ctx.font = `bold ${fontSize}px system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = ctx.measureText(label).width + 8 / zoom;
  const boxH = 22 / zoom;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.beginPath();
  ctx.roundRect(lx - w / 2, ly - boxH / 2, w, boxH, 4 / zoom);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillText(label, lx, ly);
}

function drawHVAngle(
  ctx: CanvasRenderingContext2D,
  el: HVAngleElement,
  zoom: number,
  imgW = 0,
  imgH = 0,
) {
  const { p1, p2, color, strokeWidth, mode } = el;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const lineLen = Math.hypot(dx, dy);
  if (lineLen < 1) return;

  const rawRad = Math.atan2(dy, dx);

  // Fixed axis reference angle and full-span endpoints
  // For H: horizontal line across full image width at p1.y
  // For V: vertical line across full image height at p1.x
  const refAnglePos = mode === 'h' ? 0 : Math.PI / 2;         // rightward or downward
  const refAngleNeg = mode === 'h' ? Math.PI : -Math.PI / 2;  // leftward or upward

  // Choose same-side reference so arc is drawn on the correct side
  const refAngle = mode === 'h'
    ? (dx >= 0 ? refAnglePos : refAngleNeg)
    : (dy >= 0 ? refAnglePos : refAngleNeg);

  // Full-span dashed reference line
  const refStart = mode === 'h'
    ? { x: imgW > 0 ? 0 : p1.x - 2000, y: p1.y }
    : { x: p1.x, y: imgH > 0 ? 0 : p1.y - 2000 };
  const refEnd = mode === 'h'
    ? { x: imgW > 0 ? imgW : p1.x + 2000, y: p1.y }
    : { x: p1.x, y: imgH > 0 ? imgH : p1.y + 2000 };

  // Angle between measured line and fixed axis (0–90°)
  const displayAngle = el.angle;

  // ── Dashed reference line (full span) ──
  ctx.strokeStyle = color;
  ctx.lineWidth   = Math.max(1, strokeWidth * 0.7) / zoom;
  ctx.globalAlpha = 0.55;
  ctx.lineCap     = 'round';
  ctx.setLineDash([6 / zoom, 4 / zoom]);
  ctx.beginPath(); ctx.moveTo(refStart.x, refStart.y); ctx.lineTo(refEnd.x, refEnd.y); ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // ── Main (measured) line ──
  ctx.lineWidth = strokeWidth / zoom;
  ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();

  // ── Arc ──
  const radius = 36 / zoom;
  let diff = rawRad - refAngle;
  while (diff >  Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  const anticlockwise = diff < 0;
  ctx.beginPath(); ctx.arc(p1.x, p1.y, radius, refAngle, rawRad, anticlockwise); ctx.stroke();

  // ── Label ──
  const midAngle  = refAngle + diff / 2;
  const labelDist = radius + 16 / zoom;
  const lx        = p1.x + Math.cos(midAngle) * labelDist;
  const ly        = p1.y + Math.sin(midAngle) * labelDist;
  const label     = `${displayAngle}°`;
  const fontSize  = (12 + strokeWidth) / zoom;
  ctx.font        = `bold ${fontSize}px system-ui`;
  ctx.textAlign   = 'center';
  ctx.textBaseline = 'middle';
  const w  = ctx.measureText(label).width + 8 / zoom;
  const bh = 22 / zoom;
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.beginPath(); ctx.roundRect(lx - w / 2, ly - bh / 2, w, bh, 4 / zoom); ctx.fill();
  ctx.fillStyle = color;
  ctx.fillText(label, lx, ly);
}

// ── Skeleton drawing ──────────────────────────────────────────────────────────

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
  const angleDeg = Math.round(Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2)))) * 180 / Math.PI * 10) / 10;

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
  const midAngle = a1 + halfSweep;
  const labelDist = radius + 13 / zoom;
  const lx = vertex.x + labelDist * Math.cos(midAngle);
  const ly = vertex.y + labelDist * Math.sin(midAngle);
  const label = `${angleDeg}°`;
  const fontSize = (10 + strokeWidth) / zoom;
  ctx.font = `bold ${fontSize}px system-ui`;
  ctx.textAlign = 'center';
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

function drawSkeleton(ctx: CanvasRenderingContext2D, el: SkeletonElement, zoom: number) {
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

  // ── Angle arcs ──
  for (const [vertex, a, b] of SKELETON_ANGLES) {
    drawSkeletonAngle(ctx, points[vertex], points[a], points[b], zoom, color, strokeWidth);
  }

  // ── Joint dots + labels ──
  const dotR = (3 + strokeWidth) / zoom;
  const fontSize = (10 + strokeWidth) / zoom;
  ctx.font = `${fontSize}px system-ui`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  for (const key of SKELETON_KEYS) {
    const p = points[key];

    // Filled dot
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, dotR, 0, Math.PI * 2);
    ctx.fill();

    // Label — offset slightly to the right, shifted up for head/shoulder
    const oy = (key === 'head' || key === 'shoulder') ? -dotR - 6 / zoom : dotR + 4 / zoom;
    const ox = dotR + 4 / zoom;
    const txt = SKELETON_LABELS[key];
    const tw = ctx.measureText(txt).width;
    const bh = fontSize * 1.3;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.roundRect(p.x + ox - 2 / zoom, p.y + oy - bh / 2, tw + 4 / zoom, bh, 2 / zoom);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.fillText(txt, p.x + ox, p.y + oy);
  }
}

function drawElement(ctx: CanvasRenderingContext2D, el: AnnotationElement, zoom = 1, imgW = 0, imgH = 0) {
  ctx.save();
  switch (el.type) {
    case 'path':
      if (el.points.length < 2) break;
      ctx.strokeStyle = el.color; ctx.lineWidth = el.strokeWidth / zoom;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(el.points[0].x, el.points[0].y);
      for (let i = 1; i < el.points.length; i++) ctx.lineTo(el.points[i].x, el.points[i].y);
      ctx.stroke();
      break;
    case 'line':
      ctx.strokeStyle = el.color; ctx.lineWidth = el.strokeWidth / zoom; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(el.p1.x, el.p1.y); ctx.lineTo(el.p2.x, el.p2.y); ctx.stroke();
      break;
    case 'arrow':
      ctx.strokeStyle = el.color; ctx.lineWidth = el.strokeWidth / zoom; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(el.p1.x, el.p1.y); ctx.lineTo(el.p2.x, el.p2.y); ctx.stroke();
      drawArrowhead(ctx, el.p1, el.p2, (10 + el.strokeWidth * 2) / zoom);
      break;
    case 'rect':
      ctx.strokeStyle = el.color; ctx.lineWidth = el.strokeWidth / zoom;
      if (el.filled) { ctx.fillStyle = el.color + '44'; ctx.fillRect(el.x, el.y, el.w, el.h); }
      ctx.strokeRect(el.x, el.y, el.w, el.h);
      break;
    case 'ellipse':
      ctx.strokeStyle = el.color; ctx.lineWidth = el.strokeWidth / zoom;
      ctx.beginPath(); ctx.ellipse(el.cx, el.cy, Math.abs(el.rx), Math.abs(el.ry), 0, 0, Math.PI * 2);
      if (el.filled) { ctx.fillStyle = el.color + '44'; ctx.fill(); }
      ctx.stroke();
      break;
    case 'text':
      ctx.fillStyle = el.color; ctx.font = `${el.fontSize}px system-ui`; ctx.textBaseline = 'top';
      el.text.split('\n').forEach((line, i) => ctx.fillText(line, el.x, el.y + i * el.fontSize * 1.3));
      break;
    case 'hv-angle':
      drawHVAngle(ctx, el, zoom, imgW, imgH);
      break;
    case 'angle':
      ctx.strokeStyle = el.color; ctx.lineWidth = el.strokeWidth / zoom; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(el.p0.x, el.p0.y); ctx.lineTo(el.p1.x, el.p1.y); ctx.lineTo(el.p2.x, el.p2.y); ctx.stroke();
      drawAngleArc(ctx, el, zoom);
      [el.p0, el.p1, el.p2].forEach((p, i) => {
        const r = (i === 1 ? 5 : 4) / zoom;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = el.color; ctx.fill();
      });
      break;
    case 'skeleton':
      drawSkeleton(ctx, el, zoom);
      break;
  }
  ctx.restore();
}

export function drawSelectionHandles(ctx: CanvasRenderingContext2D, el: AnnotationElement, zoom = 1) {
  ctx.save();

  const pad  = 4 / zoom;
  const pad6 = 6 / zoom;

  ctx.strokeStyle = 'rgba(99,102,241,0.6)';
  ctx.lineWidth = 1 / zoom;
  ctx.setLineDash([5 / zoom, 4 / zoom]);
  switch (el.type) {
    case 'rect':
      ctx.strokeRect(el.x - pad, el.y - pad, el.w + pad * 2, el.h + pad * 2);
      break;
    case 'ellipse':
      ctx.beginPath();
      ctx.ellipse(el.cx, el.cy, Math.abs(el.rx) + pad6, Math.abs(el.ry) + pad6, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 'path': {
      const b = pathBounds(el.points);
      ctx.strokeRect(b.minX - pad6, b.minY - pad6, b.maxX - b.minX + pad6 * 2, b.maxY - b.minY + pad6 * 2);
      break;
    }
    default: break;
  }
  ctx.setLineDash([]);

  const handles = getHandles(el);
  for (const h of handles) {
    ctx.beginPath();
    ctx.arc(h.x, h.y, 6 / zoom, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2 / zoom;
    ctx.stroke();
  }
  ctx.restore();
}

// Compute the canvas 2D transform that maps content-space coords to screen
// pixels, mirroring the CSS: scale(zoom) translate(pan) with origin=center.
//   screenX = zoom * contentX + tx   where tx = zoom * pan.x + W/2 * (1 - zoom)
export function contentTransform(
  zoom: number,
  pan: { x: number; y: number },
  W: number,
  H: number,
): { tx: number; ty: number } {
  return {
    tx: zoom * pan.x + (W / 2) * (1 - zoom),
    ty: zoom * pan.y + (H / 2) * (1 - zoom),
  };
}

export function renderLayers(
  ctx: CanvasRenderingContext2D,
  layers: Layer[],
  zoom = 1,
  pan = { x: 0, y: 0 },
  imgW = 0,
  imgH = 0,
) {
  const { width: W, height: H } = ctx.canvas;
  const { tx, ty } = contentTransform(zoom, pan, W, H);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.setTransform(zoom, 0, 0, zoom, tx, ty);
  for (const layer of layers) {
    if (!layer.visible) continue;
    ctx.save();
    ctx.globalAlpha = layer.opacity / 100;
    for (const el of layer.elements) drawElement(ctx, el, zoom, imgW, imgH);
    ctx.restore();
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

export function renderLayersWithDraft(
  ctx: CanvasRenderingContext2D,
  layers: Layer[],
  draftElement: AnnotationElement | null,
  selectedLayerId?: string,
  selectedElementId?: string,
  zoom = 1,
  pan = { x: 0, y: 0 },
  imgW = 0,
  imgH = 0,
) {
  const { width: W, height: H } = ctx.canvas;
  const { tx, ty } = contentTransform(zoom, pan, W, H);

  // Clear in screen space, then switch to content space
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.setTransform(zoom, 0, 0, zoom, tx, ty);

  for (const layer of layers) {
    if (!layer.visible) continue;
    ctx.save();
    ctx.globalAlpha = layer.opacity / 100;
    for (const el of layer.elements) {
      drawElement(ctx, el, zoom, imgW, imgH);
      if (layer.id === selectedLayerId && el.id === selectedElementId) {
        ctx.globalAlpha = 1;
        drawSelectionHandles(ctx, el, zoom);
      }
    }
    ctx.restore();
  }
  if (draftElement) drawElement(ctx, draftElement, zoom, imgW, imgH);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// Convert a mouse event to content-space coordinates.
// The canvas sits at full screen resolution (no CSS transform). We invert the
// same zoom/pan transform that was applied via ctx.setTransform when drawing.
export function getCanvasPoint(
  e: React.MouseEvent<HTMLCanvasElement> | MouseEvent,
  canvas: HTMLCanvasElement,
  zoom = 1,
  pan = { x: 0, y: 0 },
): Point {
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  const { tx, ty } = contentTransform(zoom, pan, rect.width, rect.height);
  return {
    x: (sx - tx) / zoom,
    y: (sy - ty) / zoom,
  };
}

// Scale all coordinates of an element by (sx, sy).
// Used when the canvas resizes (e.g. single ↔ split) to keep annotations
// visually anchored to the same position on screen.
export function rescaleElement(el: AnnotationElement, sx: number, sy: number): AnnotationElement {
  const sp = (p: Point): Point => ({ x: p.x * sx, y: p.y * sy });
  switch (el.type) {
    case 'line':
    case 'arrow':
      return { ...el, p1: sp(el.p1), p2: sp(el.p2) };
    case 'rect':
      return { ...el, x: el.x * sx, y: el.y * sy, w: el.w * sx, h: el.h * sy };
    case 'ellipse':
      return { ...el, cx: el.cx * sx, cy: el.cy * sy, rx: el.rx * sx, ry: el.ry * sy };
    case 'path':
      return { ...el, points: el.points.map(sp) };
    case 'angle':
      return { ...el, p0: sp(el.p0), p1: sp(el.p1), p2: sp(el.p2) };
    case 'text':
      return { ...el, x: el.x * sx, y: el.y * sy };
    case 'skeleton': {
      const scaled = { ...el.points } as Record<SkeletonKey, Point>;
      for (const key of SKELETON_KEYS) scaled[key] = sp(el.points[key]);
      return { ...el, points: scaled };
    }
    default:
      return el;
  }
}
