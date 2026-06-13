import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTracking, FREE_COLORS } from '../hooks/useTracking';

// ── segmentColor (copie locale de la fonction pure) ───────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function lighten(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.round(r + (255 - r) * factor)},${Math.round(g + (255 - g) * factor)},${Math.round(b + (255 - b) * factor)})`;
}

const COLOR_DRIFT_FRAMES = 1800;
const COLOR_DRIFT_MAX    = 0.55;

function segmentColor(baseColor: string, globalIdx: number): string {
  return lighten(baseColor, Math.min(globalIdx / COLOR_DRIFT_FRAMES, 1) * COLOR_DRIFT_MAX);
}

// ── Tests segmentColor ────────────────────────────────────────────────────────

describe('segmentColor', () => {
  const base = '#84cc16';

  it('retourne la couleur de base non eclaircie a index 0', () => {
    const [r, g, b] = hexToRgb(base);
    expect(segmentColor(base, 0)).toBe(`rgb(${r},${g},${b})`);
  });

  it('eclaircit progressivement avec index croissant', () => {
    const c0    = segmentColor(base, 0);
    const c900  = segmentColor(base, 900);
    const c1800 = segmentColor(base, 1800);
    const parseR = (s: string) => parseInt(s.slice(4).split(',')[0]);
    expect(parseR(c900)).toBeGreaterThan(parseR(c0));
    expect(parseR(c1800)).toBeGreaterThan(parseR(c900));
  });

  it('plafonne a COLOR_DRIFT_MAX au-dela de COLOR_DRIFT_FRAMES', () => {
    expect(segmentColor(base, COLOR_DRIFT_FRAMES)).toBe(segmentColor(base, COLOR_DRIFT_FRAMES * 2));
  });

  it('est deterministe — meme index retourne meme couleur', () => {
    expect(segmentColor(base, 450)).toBe(segmentColor(base, 450));
  });
});

// ── Tests useTracking ─────────────────────────────────────────────────────────

interface FakeWorker {
  onmessage: ((e: MessageEvent) => void) | null;
  onerror:   ((e: ErrorEvent)   => void) | null;
  messages:  unknown[];
  postMessage(data: unknown): void;
  terminate(): void;
}

let mockWorker: FakeWorker;

beforeEach(() => {
  vi.stubGlobal('Worker', function (this: FakeWorker) {
    this.onmessage = null;
    this.onerror   = null;
    this.messages  = [];
    this.postMessage = (data: unknown) => { this.messages.push(data); };
    this.terminate   = () => {};
    mockWorker = this;
  });
});

function makeVideoRef() {
  const video = { videoWidth: 1280, videoHeight: 720, paused: true, ended: false } as HTMLVideoElement;
  return { current: video } as React.RefObject<HTMLVideoElement>;
}

describe('useTracking', () => {
  it('demarre en mode off avec source null', () => {
    const { result } = renderHook(() =>
      useTracking({ videoRef: makeVideoRef(), onUpdateSkeleton: vi.fn() }),
    );
    expect(result.current.tracking.mode).toBe('off');
    expect(result.current.tracking.source).toBeNull();
  });

  it('startTracking skeleton — source skeleton, mode active', () => {
    const { result } = renderHook(() =>
      useTracking({ videoRef: makeVideoRef(), onUpdateSkeleton: vi.fn() }),
    );
    act(() => { result.current.startTracking([], 'skeleton'); });
    expect(result.current.tracking.mode).toBe('active');
    expect(result.current.tracking.source).toBe('skeleton');
    expect(mockWorker.messages).toContainEqual({ type: 'init', points: [] });
  });

  it('startTracking trajectory — source trajectory, mode active', () => {
    const { result } = renderHook(() =>
      useTracking({ videoRef: makeVideoRef(), onUpdateSkeleton: vi.fn() }),
    );
    act(() => { result.current.startTracking([], 'trajectory'); });
    expect(result.current.tracking.mode).toBe('active');
    expect(result.current.tracking.source).toBe('trajectory');
  });

  it('startTracking sans source — defaut skeleton', () => {
    const { result } = renderHook(() =>
      useTracking({ videoRef: makeVideoRef(), onUpdateSkeleton: vi.fn() }),
    );
    act(() => { result.current.startTracking([]); });
    expect(result.current.tracking.source).toBe('skeleton');
  });

  it('stopTracking repasse en mode off et vide historique', () => {
    const { result } = renderHook(() =>
      useTracking({ videoRef: makeVideoRef(), onUpdateSkeleton: vi.fn() }),
    );
    act(() => { result.current.startTracking([]); });
    act(() => { result.current.stopTracking(); });
    expect(result.current.tracking.mode).toBe('off');
    expect(result.current.trajectoryHistoryRef.current.size).toBe(0);
  });

  it('addFreePoint cree une entree dans trajectoryHistoryRef', () => {
    const { result } = renderHook(() =>
      useTracking({ videoRef: makeVideoRef(), onUpdateSkeleton: vi.fn() }),
    );
    act(() => { result.current.startTracking([]); });
    act(() => { result.current.addFreePoint(100, 200, 'layer-abc', FREE_COLORS[0]); });

    const entry = result.current.trajectoryHistoryRef.current.get('layer-abc');
    expect(entry).toBeDefined();
    expect(entry!.color).toBe(FREE_COLORS[0]);
    expect(entry!.initialX).toBe(100);
    expect(entry!.initialY).toBe(200);
    expect(entry!.points).toHaveLength(0);
    expect(entry!.totalAdded).toBe(0);
  });

  it('addFreePoint envoie add-point au worker avec la cle du calque', () => {
    const { result } = renderHook(() =>
      useTracking({ videoRef: makeVideoRef(), onUpdateSkeleton: vi.fn() }),
    );
    act(() => { result.current.startTracking([]); });
    act(() => { result.current.addFreePoint(50, 75, 'layer-xyz', FREE_COLORS[1]); });

    expect(mockWorker.messages).toContainEqual({
      type: 'add-point',
      point: { key: 'layer-xyz', x: 50, y: 75, lost: false },
    });
  });

  it('startTracking reinitialise historique de trajectoire', () => {
    const { result } = renderHook(() =>
      useTracking({ videoRef: makeVideoRef(), onUpdateSkeleton: vi.fn() }),
    );
    act(() => { result.current.startTracking([]); });
    act(() => { result.current.addFreePoint(10, 20, 'layer-1', FREE_COLORS[0]); });
    expect(result.current.trajectoryHistoryRef.current.size).toBe(1);

    act(() => { result.current.startTracking([]); });
    expect(result.current.trajectoryHistoryRef.current.size).toBe(0);
  });

  it('les points tracked du worker alimentent entree correspondante', () => {
    const { result } = renderHook(() =>
      useTracking({ videoRef: makeVideoRef(), onUpdateSkeleton: vi.fn() }),
    );
    act(() => { result.current.startTracking([]); });
    act(() => { result.current.addFreePoint(100, 100, 'layer-t', FREE_COLORS[0]); });

    act(() => {
      mockWorker.onmessage?.({
        data: { type: 'tracked', points: [{ key: 'layer-t', x: 105, y: 98, lost: false }] },
      } as MessageEvent);
    });

    const entry = result.current.trajectoryHistoryRef.current.get('layer-t');
    expect(entry!.points).toHaveLength(1);
    expect(entry!.points[0]).toEqual({ x: 105, y: 98 });
    expect(entry!.totalAdded).toBe(1);
  });

  it('un point lost ne s ajoute pas a entree', () => {
    const { result } = renderHook(() =>
      useTracking({ videoRef: makeVideoRef(), onUpdateSkeleton: vi.fn() }),
    );
    act(() => { result.current.startTracking([]); });
    act(() => { result.current.addFreePoint(100, 100, 'layer-lost', FREE_COLORS[0]); });

    act(() => {
      mockWorker.onmessage?.({
        data: { type: 'tracked', points: [{ key: 'layer-lost', x: 105, y: 98, lost: true }] },
      } as MessageEvent);
    });

    const entry = result.current.trajectoryHistoryRef.current.get('layer-lost');
    expect(entry!.points).toHaveLength(0);
    expect(entry!.totalAdded).toBe(0);
  });
});
