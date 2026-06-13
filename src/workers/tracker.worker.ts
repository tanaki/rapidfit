/** Web Worker — LK tracking isolé du thread principal.
 *
 *  Protocole (main → worker) :
 *    { type: 'init',              points: LKPoint[] }   — définit les points initiaux
 *    { type: 'frame',             buffer, width, height } — nouvelle frame (buffer transféré)
 *    { type: 'add-point',         point: LKPoint }      — ajoute un point libre à chaud
 *    { type: 'clear-free-points' }                      — supprime tous les points free-*
 *    { type: 'reset' }                                  — remet tout à zéro
 *
 *  Protocole (worker → main) :
 *    { type: 'tracked', points: LKPoint[] }             — positions mises à jour
 */

import { toGrayscale, trackPoints, type LKPoint } from '../utils/lkFlow';

// ── État interne ──────────────────────────────────────────────────────────────

let prevGray: Float32Array | null = null;
let imgW = 0;
let imgH = 0;
let pts: LKPoint[] = [];

// ── Messages entrants ─────────────────────────────────────────────────────────

type InMsg =
  | { type: 'init';              points: LKPoint[] }
  | { type: 'frame';             buffer: ArrayBuffer; width: number; height: number }
  | { type: 'add-point';         point: LKPoint }
  | { type: 'update-point';      key: string; x: number; y: number }
  | { type: 'clear-free-points' }
  | { type: 'reset' };

self.onmessage = (e: MessageEvent<InMsg>) => {
  const msg = e.data;

  switch (msg.type) {

    case 'init':
      pts      = msg.points;
      prevGray = null;    // la prochaine frame servira de référence
      break;

    case 'frame': {
      const rgba  = new Uint8ClampedArray(msg.buffer);
      imgW        = msg.width;
      imgH        = msg.height;
      const next  = toGrayscale(rgba, imgW, imgH);

      if (prevGray !== null && pts.length > 0) {
        pts = trackPoints(prevGray, next, imgW, imgH, pts);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (self as any).postMessage({ type: 'tracked', points: pts });
      }

      prevGray = next;
      break;
    }

    case 'add-point':
      pts = [...pts, msg.point];
      break;

    case 'update-point':
      pts = pts.map(pt =>
        pt.key === msg.key ? { ...pt, x: msg.x, y: msg.y, lost: false, err: 1 } : pt,
      );
      break;

    case 'clear-free-points':
      pts = pts.filter(pt => !pt.key.startsWith('free-'));
      break;

    case 'reset':
      prevGray = null;
      pts      = [];
      break;
  }
};
