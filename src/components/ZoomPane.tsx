import type { ReactNode } from 'react';
import { useZoomPan } from '../hooks/useZoomPan';
import { ZoomControls } from './ZoomControls';
import { GuideOverlay } from './GuideOverlay';
import { GridOverlay } from './GridOverlay';
import { capturePane } from '../utils/captureFrame';

interface Props {
  /** Content that zooms/pans (video, image…) */
  children: ReactNode;
  /** Annotation layer rendered at full resolution outside the CSS transform.
   *  Receives the current zoom and pan so it can apply them via ctx.setTransform. */
  annotationLayer?: (zoom: number, pan: { x: number; y: number }) => ReactNode;
  showGuide?: boolean;
  showGrid?: boolean;
  gridSize?: number;
  isPanMode?: boolean;
  onScroll?: (dir: 1 | -1) => void;
  onCapture?: (blob: Blob, name: string) => void;
}

export function ZoomPane({
  children,
  annotationLayer,
  showGuide  = false,
  showGrid   = false,
  gridSize   = 50,
  isPanMode  = false,
  onScroll,
  onCapture,
}: Props) {
  const zoomState = useZoomPan(isPanMode, onScroll ? (d) => onScroll(d < 0 ? -1 : 1) : undefined);

  const handleCapture = async () => {
    const container = zoomState.containerRef.current;
    if (!container || !onCapture) return;
    try {
      const { blob, name } = await capturePane(container);
      onCapture(blob, name);
    } catch (e) {
      console.warn('[ZoomPane] capture failed', e);
    }
  };

  return (
    <div
      ref={zoomState.containerRef}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}
    >
      {/* Transform wrapper — only video/image zooms here */}
      <div style={zoomState.transformStyle}>
        {children}
      </div>

      {/* Annotation canvas — full resolution, transform applied via ctx.setTransform */}
      {annotationLayer?.(zoomState.zoom, zoomState.pan)}

      {/* Overlays — fixed to view */}
      <GuideOverlay visible={showGuide} />
      <GridOverlay visible={showGrid} gridSize={gridSize} zoom={zoomState.zoom} pan={zoomState.pan} />

      {/* Controls — always on top */}
      <ZoomControls state={zoomState} />

      {onCapture && (
        <button
          onClick={handleCapture}
          title="Capturer l'image avec les calques"
          style={{ position: 'absolute', bottom: 8, right: 8, zIndex: 300 }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/60 hover:bg-black/80 border border-white/20 text-white text-xs font-medium backdrop-blur-sm transition-colors"
        >
          📸 Capturer
        </button>
      )}
    </div>
  );
}
