// Données issues des fiches "Solutions Rapides & Diagramme de Dépannage" — AR.E de Pédaler
// Les chaînes sont stockées dans les fichiers de traduction (fr.json / en.json).

import type { TFunction } from 'i18next';

export interface PainCause {
  problem: string;
  solutions: string[];
}

export interface PainZone {
  id: string;
  name: string;
  causes: PainCause[];
}

export interface PainSection {
  id: string;
  title: string;
  emoji: string;
  zones: PainZone[];
}

/** Construit le guide de dépannage avec les chaînes traduites. */
export function getPainGuide(t: TFunction): PainSection[] {
  const k = (path: string) => t(`painGuide.${path}`);

  return [
    // ── Pied ──────────────────────────────────────────────────────────────────
    {
      id: 'pied',
      title: k('pied.title'),
      emoji: '🦶',
      zones: [
        {
          id: 'engoudissement-pied',
          name: k('pied.engoudissement-pied.name'),
          causes: [
            { problem: k('pied.engoudissement-pied.c0.p'), solutions: [k('pied.engoudissement-pied.c0.s0'), k('pied.engoudissement-pied.c0.s1'), k('pied.engoudissement-pied.c0.s2')] },
          ],
        },
        {
          id: 'douleur-cou-pied',
          name: k('pied.douleur-cou-pied.name'),
          causes: [
            { problem: k('pied.douleur-cou-pied.c0.p'), solutions: [k('pied.douleur-cou-pied.c0.s0'), k('pied.douleur-cou-pied.c0.s1'), k('pied.douleur-cou-pied.c0.s2'), k('pied.douleur-cou-pied.c0.s3')] },
          ],
        },
        {
          id: 'douleurs-pieds',
          name: k('pied.douleurs-pieds.name'),
          causes: [
            { problem: k('pied.douleurs-pieds.c0.p'), solutions: [k('pied.douleurs-pieds.c0.s0'), k('pied.douleurs-pieds.c0.s1'), k('pied.douleurs-pieds.c0.s2')] },
          ],
        },
        {
          id: 'crampes-pieds',
          name: k('pied.crampes-pieds.name'),
          causes: [
            { problem: k('pied.crampes-pieds.c0.p'), solutions: [k('pied.crampes-pieds.c0.s0'), k('pied.crampes-pieds.c0.s1')] },
            { problem: k('pied.crampes-pieds.c1.p'), solutions: [k('pied.crampes-pieds.c1.s0'), k('pied.crampes-pieds.c1.s1'), k('pied.crampes-pieds.c1.s2')] },
            { problem: k('pied.crampes-pieds.c2.p'), solutions: [k('pied.crampes-pieds.c2.s0'), k('pied.crampes-pieds.c2.s1')] },
            { problem: k('pied.crampes-pieds.c3.p'), solutions: [k('pied.crampes-pieds.c3.s0')] },
          ],
        },
        {
          id: 'tendon-achille',
          name: k('pied.tendon-achille.name'),
          causes: [
            { problem: k('pied.tendon-achille.c0.p'), solutions: [k('pied.tendon-achille.c0.s0'), k('pied.tendon-achille.c0.s1'), k('pied.tendon-achille.c0.s2')] },
            { problem: k('pied.tendon-achille.c1.p'), solutions: [k('pied.tendon-achille.c1.s0')] },
            { problem: k('pied.tendon-achille.c2.p'), solutions: [k('pied.tendon-achille.c2.s0'), k('pied.tendon-achille.c2.s1'), k('pied.tendon-achille.c2.s2')] },
          ],
        },
      ],
    },

    // ── Genou ─────────────────────────────────────────────────────────────────
    {
      id: 'genou',
      title: k('genou.title'),
      emoji: '🦵',
      zones: [
        {
          id: 'genou-anterieur',
          name: k('genou.genou-anterieur.name'),
          causes: [
            { problem: k('genou.genou-anterieur.c0.p'), solutions: [k('genou.genou-anterieur.c0.s0'), k('genou.genou-anterieur.c0.s1'), k('genou.genou-anterieur.c0.s2'), k('genou.genou-anterieur.c0.s3'), k('genou.genou-anterieur.c0.s4')] },
            { problem: k('genou.genou-anterieur.c1.p'), solutions: [k('genou.genou-anterieur.c1.s0'), k('genou.genou-anterieur.c1.s1')] },
            { problem: k('genou.genou-anterieur.c2.p'), solutions: [k('genou.genou-anterieur.c2.s0')] },
          ],
        },
        {
          id: 'genou-posterieur',
          name: k('genou.genou-posterieur.name'),
          causes: [
            { problem: k('genou.genou-posterieur.c0.p'), solutions: [k('genou.genou-posterieur.c0.s0'), k('genou.genou-posterieur.c0.s1'), k('genou.genou-posterieur.c0.s2'), k('genou.genou-posterieur.c0.s3'), k('genou.genou-posterieur.c0.s4'), k('genou.genou-posterieur.c0.s5')] },
          ],
        },
        {
          id: 'patte-oie',
          name: k('genou.patte-oie.name'),
          causes: [
            { problem: k('genou.patte-oie.c0.p'), solutions: [k('genou.patte-oie.c0.s0')] },
            { problem: k('genou.patte-oie.c1.p'), solutions: [k('genou.patte-oie.c1.s0'), k('genou.patte-oie.c1.s1')] },
            { problem: k('genou.patte-oie.c2.p'), solutions: [k('genou.patte-oie.c2.s0')] },
          ],
        },
        {
          id: 'rotule-interne',
          name: k('genou.rotule-interne.name'),
          causes: [
            { problem: k('genou.rotule-interne.c0.p'), solutions: [k('genou.rotule-interne.c0.s0'), k('genou.rotule-interne.c0.s1'), k('genou.rotule-interne.c0.s2'), k('genou.rotule-interne.c0.s3')] },
            { problem: k('genou.rotule-interne.c1.p'), solutions: [k('genou.rotule-interne.c1.s0')] },
          ],
        },
        {
          id: 'rotule-externe',
          name: k('genou.rotule-externe.name'),
          causes: [
            { problem: k('genou.rotule-externe.c0.p'), solutions: [k('genou.rotule-externe.c0.s0'), k('genou.rotule-externe.c0.s1'), k('genou.rotule-externe.c0.s2'), k('genou.rotule-externe.c0.s3')] },
          ],
        },
        {
          id: 'bandelette',
          name: k('genou.bandelette.name'),
          causes: [
            { problem: k('genou.bandelette.c0.p'), solutions: [k('genou.bandelette.c0.s0'), k('genou.bandelette.c0.s1')] },
            { problem: k('genou.bandelette.c1.p'), solutions: [k('genou.bandelette.c1.s0'), k('genou.bandelette.c1.s1')] },
            { problem: k('genou.bandelette.c2.p'), solutions: [k('genou.bandelette.c2.s0')] },
          ],
        },
      ],
    },

    // ── Hanche / Dos ──────────────────────────────────────────────────────────
    {
      id: 'hanche-dos',
      title: k('hanche-dos.title'),
      emoji: '🦴',
      zones: [
        {
          id: 'hanches',
          name: k('hanche-dos.hanches.name'),
          causes: [
            { problem: k('hanche-dos.hanches.c0.p'), solutions: [k('hanche-dos.hanches.c0.s0'), k('hanche-dos.hanches.c0.s1'), k('hanche-dos.hanches.c0.s2'), k('hanche-dos.hanches.c0.s3'), k('hanche-dos.hanches.c0.s4')] },
            { problem: k('hanche-dos.hanches.c1.p'), solutions: [k('hanche-dos.hanches.c1.s0'), k('hanche-dos.hanches.c1.s1'), k('hanche-dos.hanches.c1.s2'), k('hanche-dos.hanches.c1.s3'), k('hanche-dos.hanches.c1.s4')] },
            { problem: k('hanche-dos.hanches.c2.p'), solutions: [k('hanche-dos.hanches.c2.s0'), k('hanche-dos.hanches.c2.s1'), k('hanche-dos.hanches.c2.s2')] },
            { problem: k('hanche-dos.hanches.c3.p'), solutions: [k('hanche-dos.hanches.c3.s0')] },
          ],
        },
        {
          id: 'lombaires',
          name: k('hanche-dos.lombaires.name'),
          causes: [
            { problem: k('hanche-dos.lombaires.c0.p'), solutions: [k('hanche-dos.lombaires.c0.s0'), k('hanche-dos.lombaires.c0.s1'), k('hanche-dos.lombaires.c0.s2')] },
            { problem: k('hanche-dos.lombaires.c1.p'), solutions: [k('hanche-dos.lombaires.c1.s0'), k('hanche-dos.lombaires.c1.s1')] },
            { problem: k('hanche-dos.lombaires.c2.p'), solutions: [k('hanche-dos.lombaires.c2.s0'), k('hanche-dos.lombaires.c2.s1'), k('hanche-dos.lombaires.c2.s2'), k('hanche-dos.lombaires.c2.s3'), k('hanche-dos.lombaires.c2.s4')] },
          ],
        },
      ],
    },

    // ── Assise ────────────────────────────────────────────────────────────────
    {
      id: 'assise',
      title: k('assise.title'),
      emoji: '🚲',
      zones: [
        {
          id: 'perinee',
          name: k('assise.perinee.name'),
          causes: [
            { problem: k('assise.perinee.c0.p'), solutions: [k('assise.perinee.c0.s0'), k('assise.perinee.c0.s1'), k('assise.perinee.c0.s2'), k('assise.perinee.c0.s3')] },
            { problem: k('assise.perinee.c1.p'), solutions: [k('assise.perinee.c1.s0'), k('assise.perinee.c1.s1')] },
          ],
        },
        {
          id: 'appuis-selle',
          name: k('assise.appuis-selle.name'),
          causes: [
            { problem: k('assise.appuis-selle.c0.p'), solutions: [k('assise.appuis-selle.c0.s0'), k('assise.appuis-selle.c0.s1'), k('assise.appuis-selle.c0.s2'), k('assise.appuis-selle.c0.s3')] },
            { problem: k('assise.appuis-selle.c1.p'), solutions: [k('assise.appuis-selle.c1.s0')] },
          ],
        },
        {
          id: 'irritation-cuisses',
          name: k('assise.irritation-cuisses.name'),
          causes: [
            { problem: k('assise.irritation-cuisses.c0.p'), solutions: [k('assise.irritation-cuisses.c0.s0'), k('assise.irritation-cuisses.c0.s1'), k('assise.irritation-cuisses.c0.s2'), k('assise.irritation-cuisses.c0.s3')] },
          ],
        },
      ],
    },

    // ── Membre supérieur ──────────────────────────────────────────────────────
    {
      id: 'superieur',
      title: k('superieur.title'),
      emoji: '💪',
      zones: [
        {
          id: 'epaules-cervicales',
          name: k('superieur.epaules-cervicales.name'),
          causes: [
            { problem: k('superieur.epaules-cervicales.c0.p'), solutions: [k('superieur.epaules-cervicales.c0.s0'), k('superieur.epaules-cervicales.c0.s1'), k('superieur.epaules-cervicales.c0.s2')] },
            { problem: k('superieur.epaules-cervicales.c1.p'), solutions: [k('superieur.epaules-cervicales.c1.s0'), k('superieur.epaules-cervicales.c1.s1'), k('superieur.epaules-cervicales.c1.s2')] },
            { problem: k('superieur.epaules-cervicales.c2.p'), solutions: [k('superieur.epaules-cervicales.c2.s0')] },
            { problem: k('superieur.epaules-cervicales.c3.p'), solutions: [k('superieur.epaules-cervicales.c3.s0'), k('superieur.epaules-cervicales.c3.s1'), k('superieur.epaules-cervicales.c3.s2')] },
          ],
        },
        {
          id: 'mains-poignets',
          name: k('superieur.mains-poignets.name'),
          causes: [
            { problem: k('superieur.mains-poignets.c0.p'), solutions: [k('superieur.mains-poignets.c0.s0'), k('superieur.mains-poignets.c0.s1'), k('superieur.mains-poignets.c0.s2')] },
            { problem: k('superieur.mains-poignets.c1.p'), solutions: [k('superieur.mains-poignets.c1.s0'), k('superieur.mains-poignets.c1.s1')] },
            { problem: k('superieur.mains-poignets.c2.p'), solutions: [k('superieur.mains-poignets.c2.s0'), k('superieur.mains-poignets.c2.s1')] },
            { problem: k('superieur.mains-poignets.c3.p'), solutions: [k('superieur.mains-poignets.c3.s0')] },
          ],
        },
      ],
    },
  ];
}
