import { useState, useCallback } from 'react';
import type { Layer, AnnotationElement } from '../types';
import { uid } from '../utils/canvas';

function makeLayer(name: string): Layer {
  return { id: uid(), name, visible: true, opacity: 100, locked: false, elements: [] };
}

export function useLayers(initialName = 'Calque 1') {
  const [layers, setLayers] = useState<Layer[]>(() => {
    const l = makeLayer(initialName);
    return [l];
  });
  const [activeLayerId, setActiveLayerId] = useState<string>(() => {
    // read from initial state — will sync on first render
    return '';
  });
  const [history, setHistory] = useState<Layer[][]>([]);
  const [future, setFuture] = useState<Layer[][]>([]);

  // init activeLayerId once
  const [initialized, setInitialized] = useState(false);
  if (!initialized) {
    // synchronously bootstrap during first render
    setActiveLayerId(layers[0].id);
    setInitialized(true);
  }

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
    const newLayer = makeLayer(`Calque ${layers.length + 1}`);
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
      const l = makeLayer(`Calque ${layers.length + 1}`);
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

  return {
    layers, activeLayerId, setActiveLayerId,
    history, future,
    addElement, addElementOnNewLayer, eraseAt, updateElement, deleteElement, beginDrag,
    undo, redo, clearActiveLayer,
    layerActions,
  };
}

export type LayersState = ReturnType<typeof useLayers>;
