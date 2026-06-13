/** Ajustement d'ellipse par PCA (analyse en composantes principales).
 *  Entrée : nuage de points en coordonnées quelconques.
 *  Retourne le centre, les demi-axes, l'orientation et deux indicateurs :
 *  - circularity : b/a (0 = segment, 1 = cercle parfait)
 *  - regularity  : 1 - CV des distances normalisées au centre (0..1, 1 = parfait)
 */

export interface EllipseResult {
  cx:          number;  // centre x
  cy:          number;  // centre y
  a:           number;  // grand demi-axe (en unités d'entrée)
  b:           number;  // petit demi-axe
  angle:       number;  // orientation du grand axe (radians)
  circularity: number;  // b/a  — 0..1
  regularity:  number;  // 1 - CV des distances normalisées — 0..1
  n:           number;  // nombre de points utilisés
}

export function fitEllipse(pts: { x: number; y: number }[]): EllipseResult | null {
  if (pts.length < 6) return null;

  // ── Centre ───────────────────────────────────────────────────────────────
  let cx = 0, cy = 0;
  for (const p of pts) { cx += p.x; cy += p.y; }
  cx /= pts.length; cy /= pts.length;

  // ── Matrice de covariance 2×2 ────────────────────────────────────────────
  let Cxx = 0, Cxy = 0, Cyy = 0;
  for (const p of pts) {
    const dx = p.x - cx, dy = p.y - cy;
    Cxx += dx * dx; Cxy += dx * dy; Cyy += dy * dy;
  }
  Cxx /= pts.length; Cxy /= pts.length; Cyy /= pts.length;

  // ── Valeurs propres (matrice 2×2 symétrique) ─────────────────────────────
  const trace = Cxx + Cyy;
  const disc  = Math.sqrt(Math.max(0, (trace / 2) ** 2 - (Cxx * Cyy - Cxy * Cxy)));
  const λ1    = trace / 2 + disc; // grande valeur propre → grand axe
  const λ2    = trace / 2 - disc;

  const a = 2 * Math.sqrt(Math.max(0, λ1)); // 2σ ≈ 95 % des points
  const b = 2 * Math.sqrt(Math.max(0, λ2));

  // ── Orientation du grand axe ─────────────────────────────────────────────
  // Vecteur propre associé à λ1 : (Cxy, λ1 - Cxx) (normalisé automatiquement par atan2)
  const angle = Math.atan2(Cxy, λ1 - Cxx);

  const circularity = a > 1e-6 ? Math.min(b / a, 1) : 0;

  // ── Régularité : CV des distances normalisées par les demi-axes ──────────
  // Distance normalisée : sqrt((dx·cosθ + dy·sinθ)²/a² + (-dx·sinθ + dy·cosθ)²/b²)
  // Proche de 1 si le point est sur l'ellipse. Variance faible = trajectoire régulière.
  let meanD = 0;
  const cosA = Math.cos(angle), sinA = Math.sin(angle);
  const dists: number[] = [];
  for (const p of pts) {
    const dx = p.x - cx, dy = p.y - cy;
    const u  = dx * cosA + dy * sinA;
    const v  = -dx * sinA + dy * cosA;
    const d  = a > 1e-6 && b > 1e-6
      ? Math.sqrt((u / a) ** 2 + (v / b) ** 2)
      : 0;
    dists.push(d);
    meanD += d;
  }
  meanD /= pts.length;
  let variance = 0;
  for (const d of dists) variance += (d - meanD) ** 2;
  variance /= pts.length;
  const cv = meanD > 1e-6 ? Math.sqrt(variance) / meanD : 1;
  const regularity = Math.max(0, 1 - cv);

  return { cx, cy, a, b, angle, circularity, regularity, n: pts.length };
}
