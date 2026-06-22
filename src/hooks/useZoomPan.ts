import { useRef, useState, useEffect, useCallback } from 'react';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 8;
export const ZOOM_STEP = 0.25;

export function useZoomPan(panMode = false, onWheelScroll?: (deltaY: number) => void) {
  const containerRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState(1);
  const [pan,  setPan]  = useState({ x: 0, y: 0 });

  const isPanningRef = useRef(false);
  const panStartRef  = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  const zoomAt = useCallback((delta: number, originX?: number, originY?: number) => {
    const container = containerRef.current;
    setZoom(prev => {
      const next = parseFloat(
        Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta)).toFixed(2),
      );
      if (next === prev) return prev;
      if (next <= 1) {
        setPan({ x: 0, y: 0 });
      } else if (originX !== undefined && originY !== undefined && container) {
        const rect = container.getBoundingClientRect();
        const cx = originX - rect.left - rect.width  / 2;
        const cy = originY - rect.top  - rect.height / 2;
        setPan(p => ({
          x: p.x - cx * (next / prev - 1) / next,
          y: p.y - cy * (next / prev - 1) / next,
        }));
      }
      return next;
    });
  }, []);

  const resetZoom = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, []);

  // Wheel: Ctrl+scroll → zoom, plain scroll → frame step callback
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        // Trackpad pinch: deltaMode=0 (pixels) + small deltaY values, many events.
        // Mouse wheel: typically deltaMode=1 (lines) or deltaMode=0 with large deltaY.
        // → Use proportional delta for trackpad so the gesture feels 1:1,
        //   fixed step for mouse wheel so one click = one distinct zoom level.
        const isTrackpad = e.deltaMode === 0 && Math.abs(e.deltaY) < 40;
        const delta = isTrackpad
          ? -e.deltaY * 0.008                           // smooth, proportional
          : (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);   // discrete step for mouse
        // Clamp so a single event never exceeds one ZOOM_STEP regardless of input
        zoomAt(
          Math.max(-ZOOM_STEP, Math.min(ZOOM_STEP, delta)),
          e.clientX, e.clientY,
        );
      } else {
        onWheelScroll?.(e.deltaY);
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt, onWheelScroll]);

  // Left-click pan (hand tool mode)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!panMode) { el.style.cursor = ''; return; }
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest('[data-no-pan]')) return;
      e.preventDefault();
      isPanningRef.current = true;
      panStartRef.current  = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
      el.style.cursor = 'grabbing';
    };
    const onMove = (e: MouseEvent) => {
      if (!isPanningRef.current) return;
      const s = panStartRef.current;
      setPan({ x: s.px + (e.clientX - s.mx) / zoom, y: s.py + (e.clientY - s.my) / zoom });
    };
    const onUp = (e: MouseEvent) => {
      if (e.button === 0) { isPanningRef.current = false; el.style.cursor = 'grab'; }
    };
    el.style.cursor = 'grab';
    el.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      el.style.cursor = '';
      el.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, [panMode, zoom, pan.x, pan.y]);

  // Middle-mouse pan
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onDown = (e: MouseEvent) => {
      if (e.button !== 1) return;
      e.preventDefault();
      isPanningRef.current = true;
      panStartRef.current  = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
      el.style.cursor = 'grabbing';
    };
    const onMove = (e: MouseEvent) => {
      if (!isPanningRef.current) return;
      const s = panStartRef.current;
      setPan({ x: s.px + (e.clientX - s.mx) / zoom, y: s.py + (e.clientY - s.my) / zoom });
    };
    const onUp = (e: MouseEvent) => {
      if (e.button === 1) { isPanningRef.current = false; el.style.cursor = ''; }
    };
    el.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      el.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, [zoom, pan.x, pan.y]);

  const transformStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
    transformOrigin: 'center center',
  };

  return { zoom, pan, containerRef, zoomAt, resetZoom, transformStyle };
}

export type ZoomPanState = ReturnType<typeof useZoomPan>;
