// Illustrations des cotes/angles (source : doc normes IFV — Institut de Formation
// du Vélo). Un seul jeu suffit : l'angle illustré est le même quelle que soit la
// discipline, seule la valeur cible change.
import kneeExtension from '../assets/cotes/kneeExtension.png';
import ankleExtension from '../assets/cotes/ankleExtension.png';
import ankleKneeFlex from '../assets/cotes/ankleKneeFlex.png';
import hipAngle from '../assets/cotes/hipAngle.png';
import tibialAlignment from '../assets/cotes/tibialAlignment.png';
import trunkAngle from '../assets/cotes/trunkAngle.png';
import shoulderAngle from '../assets/cotes/shoulderAngle.png';
import elbowAngle from '../assets/cotes/elbowAngle.png';

/** Clé de ligne du guide (REFERENCE_ROWS) → illustration. */
export const COTE_ILLUSTRATIONS: Record<string, string> = {
  kneeExtension,
  ankleExtension,
  ankleKneeFlex,
  hipAngle,
  tibialAlignment,
  trunkAngle,
  shoulderAngle,
  elbowAngle,
};
