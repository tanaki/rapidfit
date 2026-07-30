import { describe, it, expect } from 'vitest';
import { hitTestElement } from '../utils/canvas';
import type { SkeletonElement } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeSkeleton(overrides?: Partial<SkeletonElement['points']>): SkeletonElement {
  const defaults = {
    shoulder: { x: 200, y: 100 },
    elbow:    { x: 250, y: 200 },
    wrist:    { x: 300, y: 300 },
    hip:      { x: 200, y: 300 },
    knee:     { x: 200, y: 450 },
    ankle:    { x: 200, y: 600 },
    toes:     { x: 180, y: 650 },
    head:     { x: 200, y: 50 },
  };
  return {
    type: 'skeleton',
    id: 'test-sk',
    color: '#22c55e',
    strokeWidth: 2,
    points: { ...defaults, ...overrides },
  };
}

// ── Skeleton hitTest — joints only ──────────────────────────────────────────

describe('hitTestElement — skeleton', () => {
  const sk = makeSkeleton();
  const tol = 8;

  it('hit on a joint dot returns true', () => {
    // Click exactly on the shoulder joint
    expect(hitTestElement(sk, { x: 200, y: 100 }, tol)).toBe(true);
  });

  it('hit near a joint dot (within tolerance) returns true', () => {
    // Click 5px away from shoulder — within default 8px tolerance
    expect(hitTestElement(sk, { x: 205, y: 100 }, tol)).toBe(true);
  });

  it('hit just outside joint tolerance returns false', () => {
    // Click 10px away from shoulder — outside 8px tolerance
    expect(hitTestElement(sk, { x: 210, y: 100 }, tol)).toBe(false);
  });

  it('hit on a bone segment (midpoint between two joints) returns false', () => {
    // Midpoint of shoulder-elbow bone: (225, 150)
    const mid = {
      x: (sk.points.shoulder.x + sk.points.elbow.x) / 2,
      y: (sk.points.shoulder.y + sk.points.elbow.y) / 2,
    };
    // Ensure midpoint is far enough from both joints
    const distToShoulder = Math.hypot(mid.x - sk.points.shoulder.x, mid.y - sk.points.shoulder.y);
    const distToElbow = Math.hypot(mid.x - sk.points.elbow.x, mid.y - sk.points.elbow.y);
    expect(distToShoulder).toBeGreaterThan(tol);
    expect(distToElbow).toBeGreaterThan(tol);
    // Should NOT hit
    expect(hitTestElement(sk, mid, tol)).toBe(false);
  });

  it('hit far from skeleton returns false', () => {
    expect(hitTestElement(sk, { x: 800, y: 800 }, tol)).toBe(false);
  });

  it('hit on each of the 8 joints returns true', () => {
    for (const [, pt] of Object.entries(sk.points)) {
      expect(hitTestElement(sk, pt, tol)).toBe(true);
    }
  });

  it('hit on hip-knee bone midpoint (long segment) returns false', () => {
    // hip=(200,300), knee=(200,450) → midpoint=(200,375)
    // Distance to both joints = 75px >> tolerance
    expect(hitTestElement(sk, { x: 200, y: 375 }, tol)).toBe(false);
  });
});
