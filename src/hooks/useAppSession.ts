import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { Capture, Recording, PaneSource, Client, Session, Discipline, PersistedSessionState, Layer } from '../types';
import type { ReportData } from '../types';
import { uid } from '../utils/canvas';
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
}

export function useAppSession({
  sessions, singleLayers, paneLayers1, paneRef0, paneRef1,
  isLiveMode, deviceId, activeRecording, activeImage, paneBSource,
  captureLabels, recordingLabels,
  setCaptures, setRecordings, setActiveRecording, setActiveImage,
  setIsLiveMode, setPaneBSource, setCaptureLabels, setRecordingLabels,
}: Params) {
  const { t } = useTranslation();
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [reportLoaded, setReportLoaded] = useState(false);
  const [showNewSession, setShowNewSession] = useState(false);
  const sessionLoadedRef = useRef(false);

  const makeDefaultLayer = useCallback((name: string): Layer => ({
    id: uid(), name, visible: true, opacity: 100, locked: false, elements: [],
  }), []);

  // Reset on session change
  useEffect(() => {
    setReportData(null);
    setReportLoaded(false);
    setCaptureLabels({});
    setRecordingLabels({});
  }, [sessions.activeSession?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
      },
      paneB: {
        source:        paneBSrc,
        playbackTime:  paneRef1.current?.getTime() ?? 0,
        layers:        paneLayers1.layers,
        activeLayerId: paneLayers1.activeLayerId,
      },
      mediaLabels: { captures: captureLabels, recordings: recordingLabels },
    };

    await sessions.saveSessionState(sessions.activeSession.folderPath, state);
  }, [sessions, isLiveMode, deviceId, activeRecording, activeImage, paneBSource,
      singleLayers, paneLayers1, captureLabels, recordingLabels]); // eslint-disable-line react-hooks/exhaustive-deps

  const restoreState = useCallback(async (session: Session, recs: Recording[]) => {
    const state = await sessions.loadSessionState(session.folderPath);

    if (state?.paneA.layers.length) {
      singleLayers.importLayers(state.paneA.layers, state.paneA.activeLayerId);
    } else {
      const l = makeDefaultLayer(t('layers.initialA'));
      singleLayers.importLayers([l], l.id);
    }
    if (state?.paneB.layers.length) {
      paneLayers1.importLayers(state.paneB.layers, state.paneB.activeLayerId);
    } else {
      const l = makeDefaultLayer(t('layers.initialB'));
      paneLayers1.importLayers([l], l.id);
    }

    const srcA = state?.paneA.source ?? { type: 'none' };
    if (srcA.type === 'camera') {
      setIsLiveMode(true); setActiveRecording(null); setActiveImage(null);
    } else if (srcA.type === 'recording') {
      const rec = recs.find(r => r.name === srcA.filename) ?? null;
      setActiveRecording(rec); setActiveImage(null); setIsLiveMode(false);
      if (rec && (state?.paneA.playbackTime ?? 0) > 0) {
        const t0 = state!.paneA.playbackTime;
        setTimeout(() => paneRef0.current?.seekTo(t0), 400);
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
        if ((state?.paneB.playbackTime ?? 0) > 0) {
          const t1 = state!.paneB.playbackTime;
          setTimeout(() => paneRef1.current?.seekTo(t1), 400);
        }
      } else {
        setPaneBSource({ type: 'none' });
      }
    } else {
      setPaneBSource({ type: 'none' });
    }

    setCaptureLabels(state?.mediaLabels?.captures ?? {});
    setRecordingLabels(state?.mediaLabels?.recordings ?? {});
  }, [sessions, singleLayers, paneLayers1, makeDefaultLayer, t, // eslint-disable-line react-hooks/exhaustive-deps
      setIsLiveMode, setActiveRecording, setActiveImage, setPaneBSource,
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
