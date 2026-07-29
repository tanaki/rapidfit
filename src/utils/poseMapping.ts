/**
 * Maps MediaPipe's 33 pose landmarks to RapidFit's 8 skeleton joints.
 * Detects which body side is visible (left/right) from the video.
 */

import type { Point, SkeletonKey } from '../types';

/** MediaPipe PoseLandmarker landmark indices (from the 33-point model). */
const MP = {
  NOSE: 0,
  LEFT_SHOULDER: 11, LEFT_ELBOW: 13, LEFT_WRIST: 15,
  LEFT_HIP: 23, LEFT_KNEE: 25, LEFT_ANKLE: 27, LEFT_FOOT_INDEX: 31, LEFT_EAR: 7,
  RIGHT_SHOULDER: 12, RIGHT_ELBOW: 14, RIGHT_WRIST: 16,
  RIGHT_HIP: 24, RIGHT_KNEE: 26, RIGHT_ANKLE: 28, RIGHT_FOOT_INDEX: 32, RIGHT_EAR: 8,
} as const;

/** Mapping from RapidFit SkeletonKey → MediaPipe landmark index, per side. */
const SIDE_MAP: Record<'left' | 'right', Record<SkeletonKey, number>> = {
  left: {
    shoulder: MP.LEFT_SHOULDER, elbow: MP.LEFT_ELBOW, wrist: MP.LEFT_WRIST,
    hip: MP.LEFT_HIP, knee: MP.LEFT_KNEE, ankle: MP.LEFT_ANKLE,
    toes: MP.LEFT_FOOT_INDEX, head: MP.LEFT_EAR,
  },
  right: {
    shoulder: MP.RIGHT_SHOULDER, elbow: MP.RIGHT_ELBOW, wrist: MP.RIGHT_WRIST,
    hip: MP.RIGHT_HIP, knee: MP.RIGHT_KNEE, ankle: MP.RIGHT_ANKLE,
    toes: MP.RIGHT_FOOT_INDEX, head: MP.RIGHT_EAR,
  },
};

/** A normalised landmark as returned by MediaPipe (x, y in [0..1]). */
export interface NormalizedLandmark {
  x: number; y: number; z: number;
  visibility?: number;
}

/**
 * Detect which direction the cyclist is facing based on nose vs mid-hip.
 * When facing left, the left body side is toward the camera.
 */
function detectFacing(landmarks: NormalizedLandmark[]): 'left' | 'right' {
  const nose = landmarks[MP.NOSE];
  const midHipX = (landmarks[MP.LEFT_HIP].x + landmarks[MP.RIGHT_HIP].x) / 2;
  return nose.x < midHipX ? 'left' : 'right';
}

/**
 * Convert MediaPipe normalised landmarks to RapidFit skeleton points.
 * Coordinates are returned in VIDEO pixel space (not normalised).
 *
 * @param sideOption 'auto' to detect from pose, or force 'left'/'right'.
 */
export function landmarksToSkeleton(
  landmarks: NormalizedLandmark[],
  videoWidth: number,
  videoHeight: number,
  sideOption: 'left' | 'right' | 'auto' = 'auto',
): { points: Record<SkeletonKey, Point>; side: 'left' | 'right' } {
  const side = sideOption === 'auto' ? detectFacing(landmarks) : sideOption;
  const map = SIDE_MAP[side];

  const points = {} as Record<SkeletonKey, Point>;
  for (const [key, idx] of Object.entries(map) as [SkeletonKey, number][]) {
    const lm = landmarks[idx];
    points[key] = { x: lm.x * videoWidth, y: lm.y * videoHeight };
  }

  return { points, side };
}
