import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Capture, Recording, PaneSource, Client, Session, Discipline, PersistedSessionState, Layer } from '../types';
import type { ReportData } from '../types';
import { uid } from '../utils/uid';
import type { useSessions } from './useSessions';
import type { LayersState } from './useLayers';
import type { VideoPaneHandle } from '../components/VideoPane';

interface Params {
  sessions: ReturnType<typeof useSessions>;
  singleLayers: LayersState;
  paneLayers1: LayersState;
  paneRef0: React.RefObject<VideoPaneHandle | null>;
  paneRef1: React.RefObject<VideoPaneHandle | null>;
  isLiveMode: boolean;
  deviceId: string;
  activeRecording: Recording | null;
  activeImage: Capture | null;
  paneBSource: PaneSource;
  splitMode: boolean;
  setSplitMode: (v: boolean) => void;
  captureLabels: Record<string, string>;
  recordingLabels: Record<string, string>;
  setCaptures: (v: Capture[]) => void;
  setRecordings: (v: Recording[]) => void;
  setActiveRecording: (v: Recording | null) => void;
  setActiveImage: (v: Capture | null) => void;
  setIsLiveMode: (v: boolean) => void;
  setPaneBSource: (v: PaneSource) => void;
  setCaptureLabels: (v: Record<string, string>) => void;
  setRecordingLabels: (v: Record<string, string>) => void;
  setSavedVideoRectA: (v: { w: number; h: number } | null) => void;
  setSavedVideoRectB: (v: { w: number; h: number } | null) => void;
}

export function useAppSession({
  sessions, singleLayers, paneLayers1, paneRef0, paneRef1,
  isLiveMode, deviceId, activeRecording, activeImage, paneBSource,
  splitMode, setSplitMode,
  captureLabels, recordingLabels,
  setCaptures, setRecordings, setActiveRecording, setActiveImage,
  setIsLiveMode, setPaneBSource, setCaptureLabels, setRecordingLabels,
  setSavedVideoRectA, setSavedVideoRectB,
}: Params) {
  const { t } = useTranslation();
  const [reportData, setReportData] = useState<ReportData | null>(null);
  // Miroir synchrone du compte rendu, lisible par saveCurrentState (before-quit)
  // sans attendre le re-render de l'état React.
  const reportDataRef = useRef<ReportData | null>(null);
  const [reportLoaded, setReportLoaded] = useState(false);
  const [showNewSession, setShowNewSession] = useState(false);
  const sessionLoadedRef = useRef(false);

  const makeDefaultLayer = useCallback((name: string): Layer => ({
    id: uid(), name, visible: true, opacity: 100, locked: false, elements: [],
  }), []);

  // Reset on session change
  useEffect(() => {
    setReportData(null);
    reportDataRef.current = null; // évite de réécrire l'ancien rapport dans la nouvelle session
    setReportLoaded(false);
    setCaptureLabels({});
    setRecordingLabels({});
  }, [sessions.activeSession?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save on quit ─────────────────────────────────────────────────────────
  const saveCurrentStateRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    const api = (window as unknown as { electronAPI?: {
      onBeforeQuit?: (cb: () => void) => () => void;
      confirmReadyToQuit?: () => void;
    }}).electronAPI;
    if (!api?.onBeforeQuit) return;
    const unsub = api.onBeforeQuit(async () => {
      await saveCurrentStateRef.current();
      api.confirmReadyToQuit?.();
    });
    return unsub;
  }, []);

  // Init / restore on first load
  useEffect(() => {
    if (sessions.isLoading) return;
    if (!sessions.activeSession) {
      setShowNewSession(true);
      return;
    }
    if (sessionLoadedRef.current) return;
    sessionLoadedRef.current = true;
    const sess = sessions.activeSession;
    sessions.loadSessionAssets(sess).then(async ({ captures: loaded, recordings: loadedRecs }) => {
      setCaptures(loaded);
      setRecordings(loadedRecs);
      await restoreState(sess, loadedRecs);
    });
  }, [sessions.isLoading, sessions.activeSession]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-save debouncée ───────────────────────────────────────────────────
  // Sauvegarde le state 1.5s après le dernier changement de layers/source.
  // Le ref "mounted" évite de sauvegarder au premier rendu (restore en cours).
  const autoSaveMountedRef = useRef(false);
  const autoSaveTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const autoSaveDeps = useMemo(() => ({
    layersA:  singleLayers.layers,
    activeA:  singleLayers.activeLayerId,
    layersB:  paneLayers1.layers,
    activeB:  paneLayers1.activeLayerId,
    isLiveMode, activeRecording, activeImage, paneBSource, splitMode,
  }), [singleLayers.layers, singleLayers.activeLayerId,
       paneLayers1.layers, paneLayers1.activeLayerId,
       isLiveMode, activeRecording, activeImage, paneBSource, splitMode]);

  useEffect(() => {
    if (!autoSaveMountedRef.current) { autoSaveMountedRef.current = true; return; }
    if (!sessions.activeSession) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => { saveCurrentState(); }, 1500);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [autoSaveDeps]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveCurrentState = useCallback(async () => {
    if (!sessions.activeSession?.folderPath) return;

    const paneASource: PersistedSessionState['paneA']['source'] = isLiveMode
      ? { type: 'camera', deviceId }
      : activeRecording
        ? { type: 'recording', filename: activeRecording.name }
        : activeImage
          ? { type: 'image', captureId: activeImage.id }
          : { type: 'none' };

    const paneBSrc: PersistedSessionState['paneB']['source'] =
      paneBSource.type === 'camera'    ? { type: 'camera',    deviceId: paneBSource.deviceId }
      : paneBSource.type === 'recording' ? { type: 'recording', filename: paneBSource.recording.name }
      : paneBSource.type === 'image'     ? { type: 'image', captureId: paneBSource.capture.id }
      : { type: 'none' };

    const state: PersistedSessionState = {
      paneA: {
        source:        paneASource,
        playbackTime:  isLiveMode ? 0 : (paneRef0.current?.getTime() ?? 0),
        layers:        singleLayers.layers,
        activeLayerId: singleLayers.activeLayerId,
        videoRect:     paneRef0.current?.getVideoRect() ?? undefined,
      },
      paneB: {
        source:        paneBSrc,
        playbackTime:  paneRef1.current?.getTime() ?? 0,
        layers:        paneLayers1.layers,
        activeLayerId: paneLayers1.activeLayerId,
        videoRect:     paneRef1.current?.getVideoRect() ?? undefined,
      },
      splitMode,
      mediaLabels: { captures: captureLabels, recordings: recordingLabels },
    };

    await sessions.saveSessionState(sessions.activeSession.folderPath, state);

    // Filet anti-perte : le compte rendu est écrit dans le même flush attendu
    // par le before-quit, donc garanti persisté à la fermeture de l'app.
    if (reportDataRef.current) {
      await sessions.saveReport(sessions.activeSession.folderPath, reportDataRef.current);
    }
  }, [sessions, isLiveMode, deviceId, activeRecording, activeImage, paneBSource, splitMode,
      singleLayers, paneLayers1, captureLabels, recordingLabels]); // eslint-disable-line react-hooks/exhaustive-deps

  // Garder la ref à jour pour le handler before-quit (évite les closures périmées)
  useEffect(() => { saveCurrentStateRef.current = saveCurrentState; }, [saveCurrentState]);

  const restoreState = useCallback(async (session: Session, recs: Recording[]) => {
    const state = await sessions.loadSessionState(session.folderPath);

    // Restaurer le mode split en premier pour que la pane B soit montée
    // avant qu'on tente d'y restaurer source / trajectoires.
    setSplitMode(state?.splitMode ?? false);

    if (state?.paneA.layers.length) {
      singleLayers.importLayers(state.paneA.layers, state.paneA.activeLayerId);
    } else {
      const l = makeDefaultLayer(t('layers.initialA'));
      singleLayers.importLayers([l], l.id);
    }
    setSavedVideoRectA(state?.paneA.videoRect ?? null);

    if (state?.paneB.layers.length) {
      paneLayers1.importLayers(state.paneB.layers, state.paneB.activeLayerId);
    } else {
      const l = makeDefaultLayer(t('layers.initialB'));
      paneLayers1.importLayers([l], l.id);
    }
    setSavedVideoRectB(state?.paneB.videoRect ?? null);

    const srcA = state?.paneA.source ?? { type: 'none' };
    if (srcA.type === 'camera') {
      setIsLiveMode(true); setActiveRecording(null); setActiveImage(null);
    } else if (srcA.type === 'recording') {
      const rec = recs.find(r => r.name === srcA.filename) ?? null;
      setActiveRecording(rec); setActiveImage(null); setIsLiveMode(false);
      if (rec) {
        const activeLayerCue = state?.paneA.layers.find(l => l.id === state?.paneA.activeLayerId)?.cueTime;
        const seekTarget = activeLayerCue ?? (state?.paneA.playbackTime ?? 0);
        if (seekTarget > 0) setTimeout(() => paneRef0.current?.seekTo(seekTarget), 400);
      }
    } else {
      setIsLiveMode(false); setActiveRecording(null); setActiveImage(null);
    }

    const srcB = state?.paneB.source ?? { type: 'none' };
    if (srcB.type === 'camera') {
      setPaneBSource({ type: 'camera', deviceId: srcB.deviceId });
    } else if (srcB.type === 'recording') {
      const rec = recs.find(r => r.name === srcB.filename) ?? null;
      if (rec) {
        setPaneBSource({ type: 'recording', recording: rec });
        const t1 = state?.paneB.playbackTime ?? 0;
        if (t1 > 0) setTimeout(() => paneRef1.current?.seekTo(t1), 400);
      } else {
        setPaneBSource({ type: 'none' });
      }
    } else {
      setPaneBSource({ type: 'none' });
    }

    setCaptureLabels(state?.mediaLabels?.captures ?? {});
    setRecordingLabels(state?.mediaLabels?.recordings ?? {});
    // Les trajectoires sont désormais des éléments de calque (type 'trajectory'),
    // restaurés avec les calques ci-dessus — rien de spécial à faire ici.
  }, [sessions, singleLayers, paneLayers1, makeDefaultLayer, t, // eslint-disable-line react-hooks/exhaustive-deps
      setIsLiveMode, setActiveRecording, setActiveImage, setPaneBSource, setSplitMode,
      setCaptureLabels, setRecordingLabels]);

  const applySession = useCallback(async (client: Client, session: Session) => {
    await saveCurrentState();
    await sessions.setActiveSession(client, session);
    const { captures: loaded, recordings: loadedRecs } = await sessions.loadSessionAssets(session);
    setCaptures(loaded);
    setRecordings(loadedRecs);
    await restoreState(session, loadedRecs);
  }, [saveCurrentState, sessions, restoreState, setCaptures, setRecordings]);

  const handleCreateClientAndSession = useCallback(async (
    clientData: Pick<Client, 'nom' | 'prenom' | 'email' | 'phone' | 'birthDate'>,
    sessionData: { discipline: Discipline; bikeFitDate: string; notes?: string },
  ) => {
    const client = await sessions.createClient(clientData);
    const session = await sessions.createSession(client.id, sessionData);
    await sessions.setActiveSession(client, session);
    setCaptures([]); setRecordings([]); setActiveRecording(null);
    setShowNewSession(false);
  }, [sessions, setCaptures, setRecordings, setActiveRecording]);

  const handleCreateSessionForClient = useCallback(async (
    clientId: string,
    sessionData: { discipline: Discipline; bikeFitDate: string; notes?: string },
  ) => {
    const client = sessions.clients.find(c => c.id === clientId)!;
    const session = await sessions.createSession(clientId, sessionData);
    await sessions.setActiveSession(client, session);
    setCaptures([]); setRecordings([]); setActiveRecording(null);
    setShowNewSession(false);
  }, [sessions, setCaptures, setRecordings, setActiveRecording]);

  const handleDeleteSession = useCallback(async (session: Session) => {
    const wasActive = await sessions.deleteSession(session);
    if (wasActive) {
      setCaptures([]); setRecordings([]); setActiveRecording(null);
      setIsLiveMode(false); setPaneBSource({ type: 'none' });
      setShowNewSession(true);
    }
  }, [sessions, setCaptures, setRecordings, setActiveRecording, setIsLiveMode, setPaneBSource]);

  const handleDeleteClient = useCallback(async (client: Client) => {
    const wasActive = await sessions.deleteClient(client);
    if (wasActive) {
      setCaptures([]); setRecordings([]); setActiveRecording(null);
      setIsLiveMode(false); setPaneBSource({ type: 'none' });
      setShowNewSession(true);
    }
  }, [sessions, setCaptures, setRecordings, setActiveRecording, setIsLiveMode, setPaneBSource]);

  const handleReportSave = useCallback(async (data: ReportData) => {
    reportDataRef.current = data;
    setReportData(data);
    if (sessions.activeSession?.folderPath) {
      await sessions.saveReport(sessions.activeSession.folderPath, data);
    }
  }, [sessions.activeSession?.folderPath, sessions.saveReport]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleReportUpdateClient = useCallback(async (
    updates: Partial<Pick<Client, 'weight' | 'height'>>,
  ) => {
    if (sessions.activeClient) {
      await sessions.updateClient({ ...sessions.activeClient, ...updates });
    }
  }, [sessions.activeClient, sessions.updateClient]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    reportData, setReportData,
    reportLoaded, setReportLoaded,
    showNewSession, setShowNewSession,
    applySession,
    handleCreateClientAndSession,
    handleCreateSessionForClient,
    handleDeleteSession,
    handleDeleteClient,
    handleReportSave,
    handleReportUpdateClient,
  };
}
