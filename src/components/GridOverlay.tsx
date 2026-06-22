import { useRef, useEffect, useLayoutEffect, useState, useCallback } from 'react';

interface Props {
  visible: boolean;
  gridSize: number;
  zoom: number;
  pan: { x: number; y: number };
}

export function GridOverlay({ visible, gridSize, zoom, pan }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [center, setCenter] = useState({ x: 0.5, y: 0.5 });
  const centerRef = useRef({ x: 0.5, y: 0.5 });
  const zoomRef = useRef(zoom);
  const panRef  = useRef(pan);

  // content fraction → screen pixel (relative to container top-left)
  const toScreen = useCallback((fx: number, fy: number, w: number, h: number) => {
    const z = zoomRef.current;
    const p = panRef.current;
    return {
      x: z * (fx * w + p.x) + w / 2 * (1 - z),
      y: z * (fy * h + p.y) + h / 2 * (1 - z),
    };
  }, []);

  // screen pixel → content fraction
  const toFraction = useCallback((sx: number, sy: number, w: number, h: number) => {
    const z = zoomRef.current;
    const p = panRef.current;
    return {
      x: Math.max(0, Math.min(1, ((sx - w / 2 * (1 - z)) / z - p.x) / w)),
      y: Math.max(0, Math.min(1, ((sy - h / 2 * (1 - z)) / z - p.y) / h)),
    };
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const w = Math.round(wrapper.offsetWidth);
    const h = Math.round(wrapper.offsetHeight);
    if (!w || !h) return;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;

    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, w, h);

    const { x: cx, y: cy } = toScreen(centerRef.current.x, centerRef.current.y, w, h);
    const gs = gridSize * zoomRef.current;

    // Regular grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    const ox = ((cx % gs) + gs) % gs;
    const oy = ((cy % gs) + gs) % gs;
    for (let x = ox; x <= w; x += gs) {
      if (Math.abs(x - cx) > 1) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    }
    for (let y = oy; y <= h; y += gs) {
      if (Math.abs(y - cy) > 1) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
    }
    ctx.stroke();

    // Center lines
    ctx.strokeStyle = 'rgba(80,160,255,0.75)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, 0); ctx.lineTo(cx, h);
    ctx.moveTo(0, cy); ctx.lineTo(w, cy);
    ctx.stroke();

    // Intersection circle
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(80,160,255,0.2)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(100,180,255,0.95)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // X-handle indicator at top of vertical line
    ctx.beginPath();
    ctx.arc(cx, 16, 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(80,160,255,0.25)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(100,180,255,0.9)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 3, 16); ctx.lineTo(cx + 3, 16);
    ctx.stroke();

    // Y-handle indicator at left of horizontal line
    ctx.beginPath();
    ctx.arc(16, cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(80,160,255,0.25)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(100,180,255,0.9)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(16, cy - 3); ctx.lineTo(16, cy + 3);
    ctx.stroke();
  }, [gridSize, toScreen]);

  // Sync refs and redraw whenever zoom/pan/visibility changes
  useEffect(() => {
    zoomRef.current = zoom;
    panRef.current  = pan;
    if (visible) draw();
  }, [zoom, pan, visible, draw]);

  useLayoutEffect(() => {
    if (!visible) return;
    draw();
    const raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [draw, visible]);

  useEffect(() => { centerRef.current = center; if (visible) draw(); }, [center, draw, visible]);

  useEffect(() => {
    if (!visible) return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const obs = new ResizeObserver(draw);
    obs.observe(wrapper);
    return () => obs.disconnect();
  }, [draw, visible]);

  // Screen-space center position as fractions (for DOM handle positioning)
  const [screenCenter, setScreenCenter] = useState({ x: 0.5, y: 0.5 });
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const w = wrapper.offsetWidth;
    const h = wrapper.offsetHeight;
    if (!w || !h) return;
    const sc = toScreen(centerRef.current.x, centerRef.current.y, w, h);
    setScreenCenter({ x: sc.x / w, y: sc.y / h });
  }, [center, zoom, pan, toScreen]);

  const handleDragX = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const onMove = (me: MouseEvent) => {
      const r = wrapper.getBoundingClientRect();
      const f = toFraction(me.clientX - r.left, me.clientY - r.top, r.width, r.height);
      const next = { ...centerRef.current, x: f.x };
      centerRef.current = next;
      setCenter(next);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [toFraction]);

  const handleDragY = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const onMove = (me: MouseEvent) => {
      const r = wrapper.getBoundingClientRect();
      const f = toFraction(me.clientX - r.left, me.clientY - r.top, r.width, r.height);
      const next = { ...centerRef.current, y: f.y };
      centerRef.current = next;
      setCenter(next);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [toFraction]);

  if (!visible) return null;

  return (
    <div ref={wrapperRef} style={{ position: 'absolute', inset: 0, zIndex: 140, pointerEvents: 'none' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

      {/* X-handle: drag left/right → moves vertical center line */}
      <div
        style={{
          position: 'absolute',
          left: `${screenCenter.x * 100}%`,
          top: 6,
          transform: 'translateX(-50%)',
          width: 20,
          height: 20,
          cursor: 'ew-resize',
          pointerEvents: 'auto',
          zIndex: 141,
        }}
        data-no-pan
        onMouseDown={handleDragX}
        title="Déplacer la ligne verticale"
      />

      {/* Y-handle: drag up/down → moves horizontal center line */}
      <div
        style={{
          position: 'absolute',
          left: 6,
          top: `${screenCenter.y * 100}%`,
          transform: 'translateY(-50%)',
          width: 20,
          height: 20,
          cursor: 'ns-resize',
          pointerEvents: 'auto',
          zIndex: 141,
        }}
        data-no-pan
        onMouseDown={handleDragY}
        title="Déplacer la ligne horizontale"
      />
    </div>
  );
}
