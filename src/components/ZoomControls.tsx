import type { ZoomPanState } from '../hooks/useZoomPan';
import { ZOOM_STEP } from '../hooks/useZoomPan';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 8;

interface Props {
  state: ZoomPanState;
}

export function ZoomControls({ state }: Props) {
  const { zoom, zoomAt, resetZoom } = state;
  const zoomPct = Math.round(zoom * 100);

  return (
    <>
      {/* Always-visible +/- controls */}
      <div
        className="absolute top-2 right-2 flex items-center gap-1 bg-[#22223b] rounded-lg p-1 border border-[#3d3d5c]"
        style={{ zIndex: 300 }}
        onMouseDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
      >
        <button
          title="Dézoomer (−) · molette bas"
          onClick={() => zoomAt(-ZOOM_STEP)}
          disabled={zoom <= MIN_ZOOM}
          className="w-7 h-7 flex items-center justify-center rounded-md bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white font-bold text-base transition-colors select-none"
        >
          −
        </button>

        <button
          title="Réinitialiser le zoom (100%)"
          onClick={resetZoom}
          className="min-w-[46px] h-7 px-1.5 flex items-center justify-center rounded-md text-white text-xs font-mono hover:bg-white/10 transition-colors tabular-nums select-none"
        >
          {zoomPct}%
        </button>

        <button
          title="Zoomer (+) · molette haut"
          onClick={() => zoomAt(ZOOM_STEP)}
          disabled={zoom >= MAX_ZOOM}
          className="w-7 h-7 flex items-center justify-center rounded-md bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white font-bold text-base transition-colors select-none"
        >
          +
        </button>
      </div>

    </>
  );
}
