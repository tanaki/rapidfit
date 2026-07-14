import { describe, it, expect } from 'vitest';
import { sourceKeyOf, layerMatchesSource, layersForCanvas, layersForPanel } from '../utils/sourceScope';
import type { Layer, PaneSource, Recording, Capture } from '../types';

const layer = (id: string, sourceKey?: string, visible = true): Layer => ({
  id, name: id, visible, opacity: 100, locked: false, elements: [], sourceKey,
});

const rec = { name: 'v1.webm' } as Recording;
const cap = { id: 'cap9' } as Capture;

describe('sourceScope', () => {
  it('sourceKeyOf par type de source', () => {
    expect(sourceKeyOf({ type: 'recording', recording: rec } as PaneSource)).toBe('rec:v1.webm');
    expect(sourceKeyOf({ type: 'image', capture: cap } as PaneSource)).toBe('img:cap9');
    expect(sourceKeyOf({ type: 'camera', deviceId: 'd' } as PaneSource)).toBe('cam');
    expect(sourceKeyOf({ type: 'none' } as PaneSource)).toBeNull();
  });

  it('layerMatchesSource : hérité (undefined) = toujours vrai', () => {
    expect(layerMatchesSource(layer('a'), 'rec:v1.webm')).toBe(true);
    expect(layerMatchesSource(layer('a'), null)).toBe(true);
  });

  it('layerMatchesSource : tagué ne matche que sa source', () => {
    expect(layerMatchesSource(layer('a', 'rec:v1.webm'), 'rec:v1.webm')).toBe(true);
    expect(layerMatchesSource(layer('a', 'rec:v1.webm'), 'rec:v2.webm')).toBe(false);
    expect(layerMatchesSource(layer('a', 'rec:v1.webm'), null)).toBe(false);
  });

  it('layersForCanvas : autre source forcée invisible, le reste intact', () => {
    const layers = [layer('legacy'), layer('a', 'rec:v1.webm'), layer('b', 'rec:v2.webm')];
    const out = layersForCanvas(layers, 'rec:v1.webm');
    expect(out.find(l => l.id === 'legacy')!.visible).toBe(true);
    expect(out.find(l => l.id === 'a')!.visible).toBe(true);
    expect(out.find(l => l.id === 'b')!.visible).toBe(false); // autre source → masqué
    expect(out).toHaveLength(3); // gardés dans le tableau (calque actif/dessin)
  });

  it('layersForCanvas : ne réactive pas un calque masqué par l’utilisateur', () => {
    const out = layersForCanvas([layer('a', 'rec:v1.webm', false)], 'rec:v1.webm');
    expect(out[0].visible).toBe(false); // match source mais masqué manuellement → reste masqué
  });

  it('layersForPanel : ne liste que la source active (+ hérités)', () => {
    const layers = [layer('legacy'), layer('a', 'rec:v1.webm'), layer('b', 'rec:v2.webm')];
    const out = layersForPanel(layers, 'rec:v1.webm');
    expect(out.map(l => l.id)).toEqual(['legacy', 'a']);
  });
});
