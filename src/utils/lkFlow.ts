/** Lucas-Kanade sparse optical flow — pure TypeScript, zéro dépendance.
 *
 *  Pour chaque point tracké, résout le système 2×2 :
 *    [Σ Ix²    Σ Ix·Iy] [u]   [-Σ Ix·It]
 *    [Σ Ix·Iy  Σ Iy²  ] [v] = [-Σ Iy·It]
 *  sur une fenêtre WIN×WIN autour du point, de manière itérative. */

export interface LKPoint {
  key:  string;
  x:    number;
  y:    number;
  lost: boolean;
  /** Confiance 0..1 (0 = perdu, 1 = parfaitement tracké).
   *  Basée sur l'eigenvalue minimale du tenseur de structure LK. */
  err:  number;
}

const WIN_HALF = 10;     // fenêtre 21×21 — adaptée à 1080p
const MAX_ITER = 20;
const EPS2     = 1e-4;  // convergence : |δu|² + |δv|² < EPS2
const MIN_EIG  = 1e-3;  // seuil eigenvalue min (texture insuffisante → lost)

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Interpolation bilinéaire dans une image Float32. */
function bilinear(img: Float32Array, w: number, h: number, x: number, y: number): number {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = x0 + 1,        y1 = y0 + 1;
  if (x0 < 0 || x1 >= w || y0 < 0 || y1 >= h) return 0;
  const fx = x - x0, fy = y - y0;
  return (
    img[y0 * w + x0] * (1 - fx) * (1 - fy) +
    img[y0 * w + x1] *      fx  * (1 - fy) +
    img[y1 * w + x0] * (1 - fx) *      fy  +
    img[y1 * w + x1] *      fx  *      fy
  );
}

// ── API publique ──────────────────────────────────────────────────────────────

/** Conversion RGBA Uint8ClampedArray → niveaux de gris Float32Array. */
export function toGrayscale(data: Uint8ClampedArray, w: number, h: number): Float32Array {
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const j = i * 4;
    gray[i] = 0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2];
  }
  return gray;
}

/** Suit un seul point de `prev` vers `next` par LK itératif.
 *  @param px, py  Position dans prev (peut être non-entier)
 *  @returns  Nouvelle position dans next + flag `lost` */
export function trackPoint(
  prev: Float32Array,
  next: Float32Array,
  w: number,
  h: number,
  px: number,
  py: number,
): { x: number; y: number; lost: boolean; err: number } {
  let gx = px, gy = py;   // estimé courant dans next
  let lastLmin = MIN_EIG;  // conservé pour le calcul de confiance final

  for (let iter = 0; iter < MAX_ITER; iter++) {
    let A = 0, B = 0, C = 0;   // tenseur de structure [A B; B C]
    let bx = 0, by = 0;         // second membre

    for (let dy = -WIN_HALF; dy <= WIN_HALF; dy++) {
      const pyi = Math.round(py) + dy;
      if (pyi < 1 || pyi >= h - 1) continue;

      for (let dx = -WIN_HALF; dx <= WIN_HALF; dx++) {
        const pxi = Math.round(px) + dx;
        if (pxi < 1 || pxi >= w - 1) continue;

        // Gradients spatiaux (différences centrées) depuis prev
        const Ix = (prev[pyi * w + pxi + 1] - prev[pyi * w + pxi - 1]) * 0.5;
        const Iy = (prev[(pyi + 1) * w + pxi] - prev[(pyi - 1) * w + pxi]) * 0.5;

        // Différence temporelle : next à l'estimé courant vs prev
        const It = bilinear(next, w, h, gx + dx, gy + dy) - prev[pyi * w + pxi];

        A  += Ix * Ix;
        B  += Ix * Iy;
        C  += Iy * Iy;
        bx += Ix * It;
        by += Iy * It;
      }
    }

    // Eigenvalue minimale du tenseur — mesure la "trackabilité" de la zone
    const trace = A + C;
    const disc  = Math.sqrt((A - C) ** 2 + 4 * B * B);
    const lmin  = (trace - disc) * 0.5;
    if (lmin < MIN_EIG) return { x: px, y: py, lost: true, err: 0 };

    const det = A * C - B * B;
    if (Math.abs(det) < 1e-10) return { x: px, y: py, lost: true, err: 0 };

    lastLmin = lmin;

    // Cramer : [A B; B C][u;v] = [-bx;-by]
    const u = (B * by - C * bx) / det;
    const v = (B * bx - A * by) / det;

    gx += u;
    gy += v;

    if (u * u + v * v < EPS2) break;
  }

  if (gx < 0 || gx >= w || gy < 0 || gy >= h) return { x: px, y: py, lost: true, err: 0 };
  // err normalisée : lmin ≥ 0.05 → confiance 1, entre MIN_EIG et 0.05 → 0..1
  const GOOD_EIG = 0.05;
  return { x: gx, y: gy, lost: false, err: Math.min(lastLmin / GOOD_EIG, 1) };
}

/** Suit tous les points non-perdus. */
export function trackPoints(
  prev: Float32Array,
  next: Float32Array,
  w: number,
  h: number,
  points: LKPoint[],
): LKPoint[] {
  return points.map(pt => {
    if (pt.lost) return pt; // point déjà perdu — on ne retente pas
    return { ...pt, ...trackPoint(prev, next, w, h, pt.x, pt.y) };
  });
}
