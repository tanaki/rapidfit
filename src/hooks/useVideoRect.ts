/**
 * Computes the actual display rectangle of an `object-contain` video
 * inside a container of (containerW × containerH), given the video's
 * intrinsic aspect ratio.
 *
 * Returns { x, y, w, h } in container-pixel space, or null when unknown.
 */
export interface VideoRect { x: number; y: number; w: number; h: number }

export function computeVideoRect(
  containerW: number,
  containerH: number,
  videoAspect: number, // videoWidth / videoHeight
): VideoRect {
  const containerAspect = containerW / containerH;
  let displayW: number;
  let displayH: number;

  if (containerAspect > videoAspect) {
    // Container is wider → height-constrained, black bars left/right
    displayH = containerH;
    displayW = containerH * videoAspect;
  } else {
    // Container is taller (or same) → width-constrained, black bars top/bottom
    displayW = containerW;
    displayH = containerW / videoAspect;
  }

  return {
    x: (containerW - displayW) / 2,
    y: (containerH - displayH) / 2,
    w: displayW,
    h: displayH,
  };
}
