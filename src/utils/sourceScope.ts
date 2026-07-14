import type { PaneSource, Layer } from '../types';

/**
 * Clé stable identifiant une source de pane. Sert à rattacher un calque
 * d'annotations à la source sur laquelle il a été tracé (Cas B : un squelette
 * n'a de sens que sur SA vidéo). `null` = aucune source (rien à afficher).
 */
export function sourceKeyOf(source: PaneSource): string | null {
  switch (source.type) {
    case 'recording': return `rec:${source.recording.name}`;
    case 'image':     return `img:${source.capture.id}`;
    case 'camera':    return 'cam';
    default:          return null;
  }
}

/**
 * Un calque appartient-il à la source active ?
 * Les calques hérités (sans `sourceKey`) restent visibles partout (rétrocompat).
 */
export function layerMatchesSource(layer: Layer, key: string | null): boolean {
  return layer.sourceKey === undefined || layer.sourceKey === key;
}

/**
 * Calques ajustés pour le CANVAS : les calques d'une autre source sont forcés
 * `visible: false` (donc non rendus ni sélectionnables) mais restés dans le
 * tableau pour que la logique de calque actif / dessin continue de fonctionner.
 */
export function layersForCanvas(layers: Layer[], key: string | null): Layer[] {
  return layers.map(l => (layerMatchesSource(l, key) ? l : { ...l, visible: false }));
}

/** Calques à LISTER dans le panneau : uniquement ceux de la source active. */
export function layersForPanel(layers: Layer[], key: string | null): Layer[] {
  return layers.filter(l => layerMatchesSource(l, key));
}
