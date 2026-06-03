/**
 * Composite a video frame + annotation canvas into a PNG blob.
 *
 * - `container` is the outermost div of the pane (ZoomPane or VideoPane).
 * - The video is drawn letterboxed (object-fit: contain behaviour).
 * - The annotation canvas is drawn on top at container size.
 */
export async function capturePane(
  container: HTMLDivElement,
  paneLabel?: string,
): Promise<{ blob: Blob; name: string }> {
  const w = container.clientWidth;
  const h = container.clientHeight;

  // ── Find the active (visible) video ──────────────────────────────────────
  const videos = Array.from(container.querySelectorAll('video')) as HTMLVideoElement[];
  const video = videos.find(v => !v.classList.contains('hidden') && v.readyState >= 2) ?? null;

  // ── Find the annotation canvas ────────────────────────────────────────────
  // AnnotationCanvas is rendered as a direct sibling of the transform wrapper
  // (outside the CSS zoom/pan transform), so we search the full container.
  const annotCanvas = container.querySelector('canvas') as HTMLCanvasElement | null;

  // ── Composite ─────────────────────────────────────────────────────────────
  const out = document.createElement('canvas');
  out.width  = w;
  out.height = h;
  const ctx = out.getContext('2d')!;

  // Black background
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);

  // Video frame — letterboxed to match CSS object-fit: contain
  if (video && video.videoWidth) {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const scale = Math.min(w / vw, h / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    ctx.drawImage(video, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }

  // Annotation layer
  if (annotCanvas && annotCanvas.width > 0) {
    ctx.drawImage(annotCanvas, 0, 0, w, h);
  }

  // ── Output ────────────────────────────────────────────────────────────────
  const suffix = paneLabel ? `_${paneLabel}` : '';
  const name   = `Capture${suffix}_${new Date().toISOString().replace(/[:.]/g, '-')}.png`;

  const blob = await new Promise<Blob>((res, rej) =>
    out.toBlob(b => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png'),
  );

  return { blob, name };
}
