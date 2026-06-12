/** Lucas-Kanade sparse optical flow via OpenCV.js.
 *  Tracks a set of 2D points from one grayscale frame to the next. */

import type { SkeletonKey } from '../types';

export interface TrackedPoint {
  key: SkeletonKey | string; // joint id or free label
  x: number;
  y: number;
  lost: boolean;             // true si LK n'a pas pu suivre le point
}

// Cache the cv reference once loaded
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CV = any;

/** Run one LK iteration.
 *  @param cv      OpenCV runtime
 *  @param prevGray  Previous grayscale Mat (owned by caller)
 *  @param nextGray  Current  grayscale Mat (owned by caller)
 *  @param points    Points to track
 *  @returns Updated points (coordinates + lost flag) */
export function trackPoints(
  cv: CV,
  prevGray: CV,
  nextGray: CV,
  points: TrackedPoint[],
): TrackedPoint[] {
  if (points.length === 0) return points;

  // Build input Mat: float32, shape (N, 1, 2)
  const prevPts = pointsToMat(cv, points);
  const nextPts = new cv.Mat();
  const status  = new cv.Mat();
  const err     = new cv.Mat();

  try {
    const winSize  = new cv.Size(21, 21);
    const maxLevel = 3;
    const criteria = new cv.TermCriteria(
      cv.TERM_CRITERIA_EPS | cv.TERM_CRITERIA_COUNT,
      30,
      0.01,
    );

    cv.calcOpticalFlowPyrLK(
      prevGray, nextGray,
      prevPts, nextPts,
      status, err,
      winSize, maxLevel, criteria,
    );

    const result: TrackedPoint[] = [];
    for (let i = 0; i < points.length; i++) {
      const found = status.data[i] === 1;
      result.push({
        ...points[i],
        x:    found ? nextPts.data32F[i * 2]     : points[i].x,
        y:    found ? nextPts.data32F[i * 2 + 1] : points[i].y,
        lost: !found,
      });
    }
    return result;

  } finally {
    prevPts.delete();
    nextPts.delete();
    status.delete();
    err.delete();
  }
}

/** Convert a VideoElement frame to a grayscale OpenCV Mat. */
export function frameToGray(cv: CV, video: HTMLVideoElement): CV {
  const tmp = new cv.Mat(video.videoHeight, video.videoWidth, cv.CV_8UC4);
  const gray = new cv.Mat();

  // Capture via OffscreenCanvas
  const canvas = new OffscreenCanvas(video.videoWidth, video.videoHeight);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(video, 0, 0);
  const imageData = ctx.getImageData(0, 0, video.videoWidth, video.videoHeight);
  tmp.data.set(imageData.data);

  cv.cvtColor(tmp, gray, cv.COLOR_RGBA2GRAY);
  tmp.delete();
  return gray;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function pointsToMat(cv: CV, points: TrackedPoint[]): CV {
  const mat = new cv.Mat(points.length, 1, cv.CV_32FC2);
  for (let i = 0; i < points.length; i++) {
    mat.data32F[i * 2]     = points[i].x;
    mat.data32F[i * 2 + 1] = points[i].y;
  }
  return mat;
}
