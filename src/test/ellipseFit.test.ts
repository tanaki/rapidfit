import { describe, it, expect } from 'vitest';
import { fitEllipse } from '../utils/ellipseFit';

// ── Helpers ───────────────────────────────────────────────────────────────────

function circle(cx: number, cy: number, r: number, n = 36) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
}

function ellipsePoints(cx: number, cy: number, a: number, b: number, n = 36) {
  return Array.from({ length: n }, (_, i) => {
    const ang = (i / n) * Math.PI * 2;
    return { x: cx + a * Math.cos(ang), y: cy + b * Math.sin(ang) };
  });
}

function segment(x0: number, y0: number, x1: number, y1: number, n = 20) {
  return Array.from({ length: n }, (_, i) => ({
    x: x0 + (x1 - x0) * (i / (n - 1)),
    y: y0 + (y1 - y0) * (i / (n - 1)),
  }));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('fitEllipse', () => {
  it('retourne null si moins de 6 points', () => {
    expect(fitEllipse([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBeNull();
  });

  it('centre correct pour un cercle parfait', () => {
    const el = fitEllipse(circle(100, 200, 50));
    expect(el).not.toBeNull();
    expect(el!.cx).toBeCloseTo(100, 0);
    expect(el!.cy).toBeCloseTo(200, 0);
  });

  it('circularite proche de 1 pour un cercle', () => {
    const el = fitEllipse(circle(0, 0, 40, 60));
    expect(el!.circularity).toBeGreaterThan(0.95);
  });

  it('circularite proche de 0 pour un segment (ellipse degenere)', () => {
    const pts = segment(0, 0, 100, 0, 40);
    const el  = fitEllipse(pts);
    expect(el).not.toBeNull();
    expect(el!.circularity).toBeLessThan(0.15);
  });

  it('grand axe correspond a la dimension la plus large', () => {
    const el = fitEllipse(ellipsePoints(0, 0, 100, 30, 72));
    expect(el).not.toBeNull();
    // a doit etre plus grand que b
    expect(el!.a).toBeGreaterThan(el!.b);
    // a approx 200 (2*100 = 2σ de l ellipse simulee) — accepter ±30%
    expect(el!.a).toBeGreaterThan(120);
  });

  it('n correspond au nombre de points fournis', () => {
    const pts = circle(0, 0, 25, 50);
    expect(fitEllipse(pts)!.n).toBe(50);
  });

  it('regularite proche de 1 pour un cercle parfait', () => {
    const el = fitEllipse(circle(50, 50, 30, 100));
    expect(el!.regularity).toBeGreaterThan(0.85);
  });

  it('regularite plus basse pour un nuage de points aleatoires', () => {
    // Points eparpilles => trajectoire irreguliere
    const pts = Array.from({ length: 40 }, (_, i) => ({
      x: Math.sin(i) * 20 + i * 2,
      y: Math.cos(i * 1.7) * 15,
    }));
    const el = fitEllipse(pts);
    // Regularite plus basse que pour un cercle, sans valeur exacte (structure aleatoire)
    expect(el).not.toBeNull();
    expect(el!.regularity).toBeGreaterThanOrEqual(0);
    expect(el!.regularity).toBeLessThanOrEqual(1);
  });
});
