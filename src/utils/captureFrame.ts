import type { Layer } from '../types';
import type { VideoRect } from '../hooks/useVideoRect';
import { renderLayersWithDraft } from './canvas';

/**
 * Composite a video frame + annotations into a PNG blob at the source's
 * native resolution.
 *
 * - Output size = video.videoWidth × video.videoHeight (or image natural size,
 *   or container CSS size as fallback).
 * - Annotations are always re-rendered at zoom=1 so they align regardless of
 *   the current zoom/pan state the user may have on screen.
 * - `layers` + `videoRect` are required for correct annotation placement.
 *   `videoRect` is in container-CSS-pixel space (from useVideoRect / computeVideoRect).
 */
export async function capturePane(
  container: HTMLDivElement,
  paneLabel?: string,
  layers?: Layer[],
  videoRect?: VideoRect | null,
): Promise<{ blob: Blob; name: string }> {

  // ── Find source (video or image) ──────────────────────────────────────────
  const videos = Array.from(container.querySelectorAll('video')) as HTMLVideoElement[];
  const video  = videos.find(v => !v.classList.contains('hidden') && v.readyState >= 2) ?? null;
  const imgEl  = !video
    ? (container.querySelector('img') as HTMLImageElement | null)
    : null;

  // ── Determine output resolution (native source size when possible) ────────
  let outW: number;
  let outH: number;
  if (video && video.videoWidth) {
    outW = video.videoWidth;
    outH = video.videoHeight;
  } else if (imgEl && imgEl.naturalWidth) {
    outW = imgEl.naturalWidth;
    outH = imgEl.naturalHeight;
  } else {
    outW = container.clientWidth;
    outH = container.clientHeight;
  }

  // ── Composite ─────────────────────────────────────────────────────────────
  const out = document.createElement('canvas');
  out.width  = outW;
  out.height = outH;
  const ctx = out.getContext('2d')!;

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, outW, outH);

  // Source frame at native resolution (no letterbox needed — output = source size)
  if (video && video.videoWidth) {
    ctx.drawImage(video, 0, 0, outW, outH);
  } else if (imgEl && imgEl.naturalWidth) {
    ctx.drawImage(imgEl, 0, 0, outW, outH);
  }

  // Annotations — always at zoom=1, scaled from videoRect CSS space to native
  if (layers && layers.length > 0 && videoRect && videoRect.w > 0 && videoRect.h > 0) {
    // Intermediate canvas at video-rect CSS-pixel dimensions.
    // Annotation coordinates are stored in this space (content space, origin at
    // top-left of the video rect). renderLayersWithDraft at zoom=1 / pan=(0,0)
    // draws them at their stored coordinates without any additional offset.
    const annotTmp = document.createElement('canvas');
    annotTmp.width  = Math.round(videoRect.w);
    annotTmp.height = Math.round(videoRect.h);
    const annotCtx = annotTmp.getContext('2d')!;
    renderLayersWithDraft(annotCtx, layers, null, undefined, undefined, 1, { x: 0, y: 0 }, outW, outH);

    // Scale the annotated rect onto the full native output
    ctx.drawImage(annotTmp, 0, 0, outW, outH);
  }

  // ── Output ────────────────────────────────────────────────────────────────
  const suffix = paneLabel ? `_${paneLabel}` : '';
  const name   = `Capture${suffix}_${new Date().toISOString().replace(/[:.]/g, '-')}.png`;

  const blob = await new Promise<Blob>((res, rej) =>
    out.toBlob(b => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png'),
  );

  return { blob, name };
}
