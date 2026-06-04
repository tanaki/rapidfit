import { useState, useRef, useCallback } from 'react';
import type { Layer, AnnotationElement } from '../types';
import { uid, rescaleElement } from '../utils/canvas';
import i18n from '../i18n';

function makeLayer(name: string): Layer {
  return { id: uid(), name, visible: true, opacity: 100, locked: false, elements: [] };
}

export function useLayers(initialName = 'Calque 1') {
  // Create the initial layer once — stable via ref so both useState calls share the same id
  const initRef = useRef<Layer | null>(null);
  if (!initRef.current) initRef.current = makeLayer(initialName);

  const [layers, setLayers] = useState<Layer[]>([initRef.current]);
  const [activeLayerId, setActiveLayerId] = useState<string>(initRef.current.id);
  const [history, setHistory] = useState<Layer[][]>([]);
  const [future, setFuture] = useState<Layer[][]>([]);

  const pushHistory = useCallback((prev: Layer[]) => {
    setHistory(h => [...h.slice(-49), prev]);
    setFuture([]);
  }, []);

  const updateLayers = useCallback((fn: (prev: Layer[]) => Layer[]) => {
    setLayers(prev => { pushHistory(prev); return fn(prev); });
  }, [pushHistory]);

  const addElement = useCallback((layerId: string, el: AnnotationElement) => {
    updateLayers(prev => prev.map(l =>
      l.id === layerId ? { ...l, elements: [...l.elements, el] } : l
    ));
  }, [updateLayers]);

  // Crée automatiquement un nouveau calque pour chaque annotation
  const addElementOnNewLayer = useCallback((el: AnnotationElement) => {
    const newLayer = makeLayer(i18n.t('layers.default', { n: layers.length + 1 }));
    setHistory(h => [...h.slice(-49), layers]);
    setFuture([]);
    setLayers(prev => [...prev, { ...newLayer, elements: [el] }]);
    setActiveLayerId(newLayer.id);
  }, [layers]);

  const eraseAt = useCallback((layerId: string, p: { x: number; y: number }, radius: number) => {
    setLayers(prev => prev.map(l => {
      if (l.id !== layerId) return l;
      return { ...l, elements: l.elements.filter(el =>
        el.type !== 'path' || !el.points.some(pt => Math.hypot(pt.x - p.x, pt.y - p.y) < radius)
      )};
    }));
  }, []);

  const updateElement = useCallback((layerId: string, el: AnnotationElement) => {
    setLayers(prev => prev.map(l =>
      l.id === layerId ? { ...l, elements: l.elements.map(e => e.id === el.id ? el : e) } : l
    ));
  }, []);

  const deleteElement = useCallback((layerId: string, elementId: string) => {
    updateLayers(prev => prev.map(l =>
      l.id === layerId ? { ...l, elements: l.elements.filter(e => e.id !== elementId) } : l
    ));
  }, [updateLayers]);

  const beginDrag = useCallback(() => {
    setHistory(h => [...h.slice(-49), layers]);
    setFuture([]);
  }, [layers]);

  const undo = useCallback(() => {
    setHistory(h => {
      if (!h.length) return h;
      const prev = h[h.length - 1];
      setFuture(f => [layers, ...f]);
      setLayers(prev);
      return h.slice(0, -1);
    });
  }, [layers]);

  const redo = useCallback(() => {
    setFuture(f => {
      if (!f.length) return f;
      const next = f[0];
      setHistory(h => [...h, layers]);
      setLayers(next);
      return f.slice(1);
    });
  }, [layers]);

  const clearActiveLayer = useCallback(() => {
    updateLayers(prev => prev.map(l =>
      l.id === activeLayerId ? { ...l, elements: [] } : l
    ));
  }, [updateLayers, activeLayerId]);

  const layerActions = {
    onAdd: () => {
      const l = makeLayer(i18n.t('layers.default', { n: layers.length + 1 }));
      setLayers(prev => [...prev, l]);
      setActiveLayerId(l.id);
    },
    onDelete: (id: string) => {
      if (layers.length <= 1) return;
      updateLayers(prev => prev.filter(l => l.id !== id));
      if (activeLayerId === id) {
        setActiveLayerId(layers.find(l => l.id !== id)?.id ?? '');
      }
    },
    onToggleVisible: (id: string) =>
      setLayers(prev => prev.map(l => l.id === id ? { ...l, visible: !l.visible } : l)),
    onToggleLock: (id: string) =>
      setLayers(prev => prev.map(l => l.id === id ? { ...l, locked: !l.locked } : l)),
    onRename: (id: string, name: string) =>
      setLayers(prev => prev.map(l => l.id === id ? { ...l, name } : l)),
    onOpacity: (id: string, opacity: number) =>
      setLayers(prev => prev.map(l => l.id === id ? { ...l, opacity } : l)),
    onMoveUp: (id: string) => {
      setLayers(prev => {
        const i = prev.findIndex(l => l.id === id);
        if (i >= prev.length - 1) return prev;
        const next = [...prev]; [next[i], next[i + 1]] = [next[i + 1], next[i]]; return next;
      });
    },
    onMoveDown: (id: string) => {
      setLayers(prev => {
        const i = prev.findIndex(l => l.id === id);
        if (i <= 0) return prev;
        const next = [...prev]; [next[i], next[i - 1]] = [next[i - 1], next[i]]; return next;
      });
    },
  };

  // Rescale all element coordinates — called when the canvas changes size
  const rescaleElements = useCallback((sx: number, sy: number) => {
    if (sx === 1 && sy === 1) return;
    setLayers(prev => prev.map(l => ({
      ...l,
      elements: l.elements.map(el => rescaleElement(el, sx, sy)),
    })));
  }, []);

  const importLayers = useCallback((srcLayers: Layer[], srcActiveId: string) => {
    setLayers(srcLayers);
    setActiveLayerId(srcActiveId);
    setHistory([]);
    setFuture([]);
  }, []);

  return {
    layers, activeLayerId, setActiveLayerId,
    history, future,
    addElement, addElementOnNewLayer, eraseAt, updateElement, deleteElement, beginDrag,
    undo, redo, clearActiveLayer, importLayers, rescaleElements,
    layerActions,
  };
}

export type LayersState = ReturnType<typeof useLayers>;
