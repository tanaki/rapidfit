import { useRef, useEffect, useState, useCallback } from 'react';
import type { Layer, Tool, Point, AnnotationElement, AngleElement, Discipline } from '../types';
import {
  renderLayersWithDraft,
  computeAngle,
  computeHVAngle,
  defaultSkeletonPoints,
  uid,
  getCanvasPoint,
  getHandles,
  hitTestHandle,
  hitTestElement,
  applyHandleDrag,
  moveElement,
  type Handle,
} from '../utils/canvas';
import type { VideoRect } from '../hooks/useVideoRect';

interface Props {
  layers: Layer[];
  activeLayerId: string;
  tool: Tool;
  color: string;
  strokeWidth: number;
  filled: boolean;
  zoom?: number;
  pan?: { x: number; y: number };
  onAddElement: (layerId: string, el: AnnotationElement) => void;
  onEraseAt: (layerId: string, p: Point, radius: number) => void;
  onUpdateElement: (layerId: string, el: AnnotationElement) => void;
  onDeleteElement: (layerId: string, elementId: string) => void;
  onBeginDrag: () => void;
  onRescaleElements?: (sx: number, sy: number) => void;
  /** When provided, the skeleton tool auto-detects pose instead of placing a template. */
  onDetectPose?: () => Promise<Record<string, Point> | null>;
  videoRect?: VideoRect | null;
  imgW?: number;
  imgH?: number;
  discipline?: Discipline;
  style?: React.CSSProperties;
}

export function AnnotationCanvas({
  layers, activeLayerId, tool, color, strokeWidth, filled,
  zoom = 1,
  pan = { x: 0, y: 0 },
  onAddElement, onEraseAt, onUpdateElement, onDeleteElement, onBeginDrag, onRescaleElements, onDetectPose, videoRect, imgW = 0, imgH = 0, discipline = 'route', style,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isDownRef = useRef(false);
  const startPtRef = useRef<Point | null>(null);
  const lastPtRef = useRef<Point | null>(null);
  const pathPtsRef = useRef<Point[]>([]);

  const angleRef = useRef<Point[]>([]);
  const [anglePoints, setAnglePoints] = useState<Point[]>([]);

  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const selectedLayerIdRef = useRef<string | null>(null);
  const selectedElementIdRef = useRef<string | null>(null);
  const dragHandleRef = useRef<Handle | null>(null);
  const isDraggingBodyRef = useRef(false);

  const draftRef = useRef<AnnotationElement | null>(null);
  const [, forceRedraw] = useState(0);

  // Keep zoom/pan in refs so event handlers always see current values
  const zoomRef = useRef(zoom);
  const panRef  = useRef(pan);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current  = pan;  }, [pan]);

  useEffect(() => { selectedLayerIdRef.current = selectedLayerId; }, [selectedLayerId]);
  useEffect(() => { selectedElementIdRef.current = selectedElementId; }, [selectedElementId]);

  useEffect(() => {
    if (tool !== 'select' && tool !== 'pan') {
      setSelectedLayerId(null);
      setSelectedElementId(null);
    }
  }, [tool]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElementId && selectedLayerId) {
        onDeleteElement(selectedLayerId, selectedElementId);
        setSelectedLayerId(null);
        setSelectedElementId(null);
        selectedLayerIdRef.current = null;
        selectedElementIdRef.current = null;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedElementId, selectedLayerId, onDeleteElement]);

  const prevVideoRectRef = useRef<VideoRect | null>(null);
  const videoRectRef = useRef(videoRect ?? null);
  const onRescaleRef = useRef(onRescaleElements);
  useEffect(() => { onRescaleRef.current = onRescaleElements; }, [onRescaleElements]);
  useEffect(() => {
    const prev = prevVideoRectRef.current;
    const next = videoRect ?? null;
    // Rescale when the video display area changes (letterbox shift)
    if (prev && next && (prev.w !== next.w || prev.h !== next.h) && prev.w > 0 && prev.h > 0) {
      onRescaleRef.current?.(next.w / prev.w, next.h / prev.h);
    }
    prevVideoRectRef.current = next;
    videoRectRef.current = next;
  }, [videoRect]);

  useEffect(() => {
    const obs = new ResizeObserver(() => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      canvas.width  = container.clientWidth;
      canvas.height = container.clientHeight;
      forceRedraw(n => n + 1);
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // Redraw on every render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const vr = videoRectRef.current;
    // Offset pan by videoRect origin so annotations stay anchored to the video image
    const adjustedPan = vr
      ? { x: pan.x + vr.x, y: pan.y + vr.y }
      : pan;
    renderLayersWithDraft(
      ctx, layers, draftRef.current,
      selectedLayerIdRef.current ?? undefined,
      selectedElementIdRef.current ?? undefined,
      zoom,
      adjustedPan,
      imgW,
      imgH,
    );
  });

  const activeLayer = layers.find(l => l.id === activeLayerId);

  const pt = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const raw = getCanvasPoint(e, canvasRef.current!, zoomRef.current, panRef.current);
    // If video is letterboxed, shift coords so (0,0) = top-left of video display area
    const vr = videoRectRef.current;
    if (vr) return { x: raw.x - vr.x, y: raw.y - vr.y };
    return raw;
  }, []);

  // Hit tolerance in content-space units ≈ 8 screen pixels
  const tol = useCallback(() => 8 / zoomRef.current, []);

  const findElementAt = useCallback((p: Point): { layerId: string; el: AnnotationElement } | null => {
    const t = 8 / zoomRef.current;
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i];
      if (!layer.visible || layer.locked) continue;
      for (let j = layer.elements.length - 1; j >= 0; j--) {
        if (hitTestElement(layer.elements[j], p, t)) {
          return { layerId: layer.id, el: layer.elements[j] };
        }
      }
    }
    return null;
  }, [layers]);

  const getCursor = useCallback((p?: Point): string => {
    if (tool !== 'select') {
      if (tool === 'eraser') return 'cell';
      return 'crosshair';
    }
    if (dragHandleRef.current && isDownRef.current) return 'grabbing';
    if (p) {
      const selLayer = layers.find(l => l.id === selectedLayerIdRef.current);
      const selEl = selLayer?.elements.find(e => e.id === selectedElementIdRef.current);
      if (selEl) {
        const h = hitTestHandle(getHandles(selEl), p, 8 / zoomRef.current);
        if (h) return h.cursor;
      }
      if (findElementAt(p)) return 'move';
    }
    return 'default';
  }, [tool, layers, findElementAt]);

  const [cursor, setCursor] = useState('default');

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const p = pt(e);

    if (tool === 'select') {
      const selLayer = layers.find(l => l.id === selectedLayerIdRef.current);
      const selEl = selLayer?.elements.find(el => el.id === selectedElementIdRef.current);

      if (selEl) {
        const h = hitTestHandle(getHandles(selEl), p, tol());
        if (h) {
          onBeginDrag();
          dragHandleRef.current = h;
          isDraggingBodyRef.current = false;
          isDownRef.current = true;
          lastPtRef.current = p;
          setCursor('grabbing');
          return;
        }
      }

      const found = findElementAt(p);
      if (found) {
        onBeginDrag();
        setSelectedLayerId(found.layerId);
        setSelectedElementId(found.el.id);
        selectedLayerIdRef.current = found.layerId;
        selectedElementIdRef.current = found.el.id;
        isDraggingBodyRef.current = true;
        dragHandleRef.current = null;
        isDownRef.current = true;
        lastPtRef.current = p;
      } else {
        setSelectedLayerId(null);
        setSelectedElementId(null);
      }
      return;
    }

    if (tool === 'angle') {
      const pts = [...angleRef.current, p];
      angleRef.current = pts;
      setAnglePoints(pts);
      if (pts.length === 3) {
        onAddElement(activeLayerId, {
          type: 'angle', id: uid(),
          p0: pts[0], p1: pts[1], p2: pts[2],
          color, strokeWidth,
          angle: computeAngle(pts[0], pts[1], pts[2]),
        });
        angleRef.current = [];
        setAnglePoints([]);
        draftRef.current = null;
      }
      return;
    }

    if (!activeLayer || activeLayer.locked) return;

    isDownRef.current = true;
    startPtRef.current = p;
    lastPtRef.current = p;
    if (tool === 'pen' || tool === 'eraser') pathPtsRef.current = [p];
  }, [tool, layers, activeLayerId, activeLayer, color, strokeWidth, onAddElement, onBeginDrag, findElementAt, pt, tol]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const p = pt(e);
    setCursor(getCursor(p));

    if (tool === 'select' && isDownRef.current) {
      const selLayer = layers.find(l => l.id === selectedLayerIdRef.current);
      const selEl = selLayer?.elements.find(el => el.id === selectedElementIdRef.current);
      if (!selEl) return;

      if (dragHandleRef.current) {
        const h = dragHandleRef.current;
        let updated: AnnotationElement;
        if (h.index === -1) {
          const dx = p.x - lastPtRef.current!.x;
          const dy = p.y - lastPtRef.current!.y;
          updated = moveElement(selEl, dx, dy);
        } else {
          updated = applyHandleDrag(selEl, h.index, p);
        }
        onUpdateElement(selectedLayerIdRef.current!, updated);
      } else if (isDraggingBodyRef.current) {
        const dx = p.x - lastPtRef.current!.x;
        const dy = p.y - lastPtRef.current!.y;
        onUpdateElement(selectedLayerIdRef.current!, moveElement(selEl, dx, dy));
      }
      lastPtRef.current = p;
      return;
    }

    if (tool === 'angle' && angleRef.current.length > 0) {
      const pts = angleRef.current;
      if (pts.length === 1) {
        draftRef.current = { type: 'line', id: '__draft__', p1: pts[0], p2: p, color, strokeWidth };
      } else if (pts.length === 2) {
        draftRef.current = {
          type: 'angle', id: '__draft__',
          p0: pts[0], p1: pts[1], p2: p,
          color, strokeWidth, angle: computeAngle(pts[0], pts[1], p),
        } as AngleElement;
      }
      forceRedraw(n => n + 1);
      return;
    }

    if (!isDownRef.current) return;
    const start = startPtRef.current!;

    if (tool === 'eraser') { onEraseAt(activeLayerId, p, strokeWidth * 4); return; }

    if (tool === 'pen') {
      pathPtsRef.current.push(p);
      draftRef.current = { type: 'path', id: '__draft__', points: [...pathPtsRef.current], color, strokeWidth };
      forceRedraw(n => n + 1);
      return;
    }

    if (tool === 'skeleton') {
      // No live preview — skeleton is placed instantly on mouseUp
    }
    else if (tool === 'h-angle' || tool === 'v-angle') {
      const mode = tool === 'h-angle' ? 'h' : 'v';
      draftRef.current = { type: 'hv-angle', id: '__draft__', p1: start, p2: p, color, strokeWidth, angle: computeHVAngle(start, p, mode), mode };
    }
    else if (tool === 'line')   draftRef.current = { type: 'line',    id: '__draft__', p1: start, p2: p, color, strokeWidth };
    else if (tool === 'arrow')  draftRef.current = { type: 'arrow',   id: '__draft__', p1: start, p2: p, color, strokeWidth };
    else if (tool === 'rect')   draftRef.current = { type: 'rect',    id: '__draft__', x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y), color, strokeWidth, filled };
    else if (tool === 'ellipse') draftRef.current = { type: 'ellipse', id: '__draft__', cx: (start.x + p.x) / 2, cy: (start.y + p.y) / 2, rx: Math.abs(p.x - start.x) / 2, ry: Math.abs(p.y - start.y) / 2, color, strokeWidth, filled };
    forceRedraw(n => n + 1);
  }, [tool, layers, color, strokeWidth, filled, activeLayerId, onEraseAt, onUpdateElement, getCursor, pt]);

  const onMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === 'select') {
      isDownRef.current = false;
      dragHandleRef.current = null;
      isDraggingBodyRef.current = false;
      setCursor(getCursor(pt(e)));
      return;
    }
    if (!isDownRef.current) return;
    isDownRef.current = false;
    const p = pt(e);
    const start = startPtRef.current!;
    draftRef.current = null;

    if (tool === 'pen' && pathPtsRef.current.length > 1) {
      onAddElement(activeLayerId, { type: 'path', id: uid(), points: pathPtsRef.current, color, strokeWidth });
      pathPtsRef.current = [];
      return;
    }
    if (tool === 'skeleton') {
      if (onDetectPose) {
        onDetectPose().then(points => {
          if (points) {
            onAddElement(activeLayerId, {
              type: 'skeleton', id: uid(), color, strokeWidth,
              points: points as Record<import('../types').SkeletonKey, Point>,
            });
          }
        });
      } else {
        const scale = imgH > 0 ? imgH / 4 : 160;
        onAddElement(activeLayerId, { type: 'skeleton', id: uid(), color, strokeWidth, points: defaultSkeletonPoints(start, scale, discipline) });
      }
    }
    else if (tool === 'h-angle' || tool === 'v-angle') {
      const mode = tool === 'h-angle' ? 'h' : 'v';
      onAddElement(activeLayerId, { type: 'hv-angle', id: uid(), p1: start, p2: p, color, strokeWidth, angle: computeHVAngle(start, p, mode), mode });
    }
    else if (tool === 'line')    onAddElement(activeLayerId, { type: 'line',    id: uid(), p1: start, p2: p, color, strokeWidth });
    else if (tool === 'arrow')   onAddElement(activeLayerId, { type: 'arrow',   id: uid(), p1: start, p2: p, color, strokeWidth });
    else if (tool === 'rect')    onAddElement(activeLayerId, { type: 'rect',    id: uid(), x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y), color, strokeWidth, filled });
    else if (tool === 'ellipse') onAddElement(activeLayerId, { type: 'ellipse', id: uid(), cx: (start.x + p.x) / 2, cy: (start.y + p.y) / 2, rx: Math.abs(p.x - start.x) / 2, ry: Math.abs(p.y - start.y) / 2, color, strokeWidth, filled });
  }, [tool, color, strokeWidth, filled, activeLayerId, onAddElement, getCursor, pt]);

  const onLeave = useCallback(() => {
    if (tool === 'select') { isDownRef.current = false; dragHandleRef.current = null; isDraggingBodyRef.current = false; }
    else { isDownRef.current = false; draftRef.current = null; }
    setCursor('default');
    forceRedraw(n => n + 1);
  }, [tool]);

  return (
    <div ref={containerRef} style={style} className="absolute inset-0 overflow-hidden">
      <canvas
        ref={canvasRef}
        style={{ cursor }}
        className="absolute inset-0 w-full h-full"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onLeave}
      />

      {tool === 'angle' && anglePoints.length > 0 && anglePoints.length < 3 && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/70 text-yellow-300 text-xs px-3 py-1 rounded-full pointer-events-none select-none">
          {anglePoints.length === 1
            ? 'Cliquez pour placer le sommet (2/3)'
            : 'Cliquez pour le 3e point (3/3)'}
        </div>
      )}

      {tool === 'skeleton' && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/70 text-yellow-300 text-xs px-3 py-1 rounded-full pointer-events-none select-none">
          Cliquez pour placer la hanche — puis ⊙ pour ajuster les articulations
        </div>
      )}
    </div>
  );
}
