/** Web Worker — LK tracking isolé du thread principal.
 *
 *  Protocole (main → worker) :
 *    { type: 'init',      points: LKPoint[] }              — définit les points initiaux
 *    { type: 'frame',     buffer, width, height }          — nouvelle frame (buffer transféré)
 *    { type: 'add-point', point: LKPoint }                 — ajoute un point libre à chaud
 *    { type: 'reset' }                                     — remet tout à zéro
 *
 *  Protocole (worker → main) :
 *    { type: 'tracked', points: LKPoint[] }                — positions mises à jour
 */

import { toGrayscale, trackPoints, type LKPoint } from '../utils/lkFlow';

let prevGray: Float32Array | null = null;
let imgW = 0;
let imgH = 0;
let pts: LKPoint[] = [];

type InMsg =
  | { type: 'init';      points: LKPoint[] }
  | { type: 'frame';     buffer: ArrayBuffer; width: number; height: number }
  | { type: 'add-point'; point: LKPoint }
  | { type: 'reset' };

self.onmessage = (e: MessageEvent<InMsg>) => {
  const msg = e.data;

  switch (msg.type) {

    case 'init':
      pts      = msg.points;
      prevGray = null;
      break;

    case 'frame': {
      const rgba = new Uint8ClampedArray(msg.buffer);
      imgW       = msg.width;
      imgH       = msg.height;
      const next = toGrayscale(rgba, imgW, imgH);

      if (prevGray !== null && pts.length > 0) {
        pts = trackPoints(prevGray, next, imgW, imgH, pts);
        (self as unknown as DedicatedWorkerGlobalScope).postMessage({ type: 'tracked', points: pts });
      }

      prevGray = next;
      break;
    }

    case 'add-point':
      pts = [...pts, msg.point];
      break;

    case 'reset':
      prevGray = null;
      pts      = [];
      break;
  }
};
