import { describe, it, expect } from 'vitest';
import { landmarksToSkeleton, type NormalizedLandmark } from '../utils/poseMapping';
import { SKELETON_KEYS } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a 33-landmark array with sensible defaults, overridable per index. */
function makeLandmarks(overrides: Partial<Record<number, Partial<NormalizedLandmark>>> = {}): NormalizedLandmark[] {
  const lm: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  for (const [idx, patch] of Object.entries(overrides)) {
    Object.assign(lm[Number(idx)], patch);
  }
  return lm;
}

// MediaPipe landmark indices
const NOSE = 0;
const L_HIP = 23, R_HIP = 24;
const L_SHOULDER = 11, L_ELBOW = 13, L_WRIST = 15;
const L_KNEE = 25, L_ANKLE = 27, L_FOOT = 31, L_EAR = 7;
const R_SHOULDER = 12, R_ELBOW = 14, R_WRIST = 16;
const R_KNEE = 26, R_ANKLE = 28, R_FOOT = 32, R_EAR = 8;

// ── Side detection ──────────────────────────────────────────────────────────

describe('landmarksToSkeleton — side detection', () => {
  it('detects left-facing cyclist (nose left of hips)', () => {
    const lm = makeLandmarks({
      [NOSE]:  { x: 0.2 },
      [L_HIP]: { x: 0.4 },
      [R_HIP]: { x: 0.6 },
    });
    const result = landmarksToSkeleton(lm, 1920, 1080, 'auto');
    expect(result.side).toBe('left');
  });

  it('detects right-facing cyclist (nose right of hips)', () => {
    const lm = makeLandmarks({
      [NOSE]:  { x: 0.8 },
      [L_HIP]: { x: 0.4 },
      [R_HIP]: { x: 0.6 },
    });
    const result = landmarksToSkeleton(lm, 1920, 1080, 'auto');
    expect(result.side).toBe('right');
  });

  it('respects forced side option (left)', () => {
    const lm = makeLandmarks({
      [NOSE]:  { x: 0.8 }, // facing right
      [L_HIP]: { x: 0.4 },
      [R_HIP]: { x: 0.6 },
    });
    const result = landmarksToSkeleton(lm, 1920, 1080, 'left');
    expect(result.side).toBe('left');
  });

  it('respects forced side option (right)', () => {
    const lm = makeLandmarks({
      [NOSE]:  { x: 0.2 }, // facing left
      [L_HIP]: { x: 0.4 },
      [R_HIP]: { x: 0.6 },
    });
    const result = landmarksToSkeleton(lm, 1920, 1080, 'right');
    expect(result.side).toBe('right');
  });
});

// ── Landmark mapping ────────────────────────────────────────────────────────

describe('landmarksToSkeleton — landmark mapping', () => {
  it('returns all 8 skeleton keys', () => {
    const lm = makeLandmarks();
    const result = landmarksToSkeleton(lm, 1920, 1080, 'left');
    for (const key of SKELETON_KEYS) {
      expect(result.points).toHaveProperty(key);
    }
  });

  it('maps left-side landmarks when side is left', () => {
    const lm = makeLandmarks({
      [L_SHOULDER]: { x: 0.1, y: 0.2 },
      [L_ELBOW]:    { x: 0.15, y: 0.3 },
      [L_WRIST]:    { x: 0.2, y: 0.4 },
      [L_HIP]:      { x: 0.3, y: 0.5 },
      [L_KNEE]:     { x: 0.35, y: 0.6 },
      [L_ANKLE]:    { x: 0.4, y: 0.8 },
      [L_FOOT]:     { x: 0.45, y: 0.9 },
      [L_EAR]:      { x: 0.05, y: 0.1 },
    });
    const result = landmarksToSkeleton(lm, 1000, 1000, 'left');
    expect(result.points.shoulder).toEqual({ x: 100, y: 200 });
    expect(result.points.elbow).toEqual({ x: 150, y: 300 });
    expect(result.points.wrist).toEqual({ x: 200, y: 400 });
    expect(result.points.hip).toEqual({ x: 300, y: 500 });
    expect(result.points.knee).toEqual({ x: 350, y: 600 });
    expect(result.points.ankle).toEqual({ x: 400, y: 800 });
    expect(result.points.toes).toEqual({ x: 450, y: 900 });
    expect(result.points.head).toEqual({ x: 50, y: 100 });
  });

  it('maps right-side landmarks when side is right', () => {
    const lm = makeLandmarks({
      [R_SHOULDER]: { x: 0.9, y: 0.2 },
      [R_ELBOW]:    { x: 0.85, y: 0.3 },
      [R_WRIST]:    { x: 0.8, y: 0.4 },
      [R_HIP]:      { x: 0.7, y: 0.5 },
      [R_KNEE]:     { x: 0.65, y: 0.6 },
      [R_ANKLE]:    { x: 0.6, y: 0.8 },
      [R_FOOT]:     { x: 0.55, y: 0.9 },
      [R_EAR]:      { x: 0.95, y: 0.1 },
    });
    const result = landmarksToSkeleton(lm, 1000, 1000, 'right');
    expect(result.points.shoulder).toEqual({ x: 900, y: 200 });
    expect(result.points.elbow).toEqual({ x: 850, y: 300 });
    expect(result.points.hip).toEqual({ x: 700, y: 500 });
    expect(result.points.head).toEqual({ x: 950, y: 100 });
  });
});

// ── Coordinate scaling ──────────────────────────────────────────────────────

describe('landmarksToSkeleton — coordinate scaling', () => {
  it('scales normalized coords to video pixel space', () => {
    const lm = makeLandmarks({
      [L_HIP]: { x: 0.25, y: 0.75 },
    });
    const result = landmarksToSkeleton(lm, 1920, 1080, 'left');
    expect(result.points.hip.x).toBeCloseTo(1920 * 0.25);
    expect(result.points.hip.y).toBeCloseTo(1080 * 0.75);
  });

  it('works with non-standard resolutions', () => {
    const lm = makeLandmarks({
      [L_KNEE]: { x: 0.5, y: 0.5 },
    });
    const result = landmarksToSkeleton(lm, 640, 480, 'left');
    expect(result.points.knee).toEqual({ x: 320, y: 240 });
  });

  it('all points are in pixel space (not normalized)', () => {
    const lm = makeLandmarks();
    // Set all landmarks to 0.5, 0.5
    const result = landmarksToSkeleton(lm, 1920, 1080, 'left');
    for (const pt of Object.values(result.points)) {
      expect(pt.x).toBe(960);
      expect(pt.y).toBe(540);
    }
  });
});
