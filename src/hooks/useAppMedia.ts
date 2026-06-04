import { useState, useCallback, useRef } from 'react';
import type { Capture, Recording, PaneSource } from '../types';
import { uid } from '../utils/canvas';
import { saveRecordingToFile } from '../utils/saveFile';
import type { useSessions } from './useSessions';

interface Params {
  splitMode: boolean;
  activePaneIndex: 0 | 1;
  setPaneBSource: (s: PaneSource) => void;
  sessions: ReturnType<typeof useSessions>;
  persistRecording: (r: Recording) => void;
  removeRecording: (id: string) => void;
}

export function useAppMedia({
  splitMode, activePaneIndex, setPaneBSource, sessions, persistRecording, removeRecording,
}: Params) {
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [activeRecording, setActiveRecording] = useState<Recording | null>(null);
  const [activeImage, setActiveImage] = useState<Capture | null>(null);
  const [captureLabels, setCaptureLabels] = useState<Record<string, string>>({});
  const [recordingLabels, setRecordingLabels] = useState<Record<string, string>>({});
  const [showMediaPanel, setShowMediaPanel] = useState(false);

  // Keep a stable ref to avoid stale closures in handleImportFile
  const splitModeRef = useRef(splitMode);
  const activePaneRef = useRef(activePaneIndex);
  splitModeRef.current = splitMode;
  activePaneRef.current = activePaneIndex;

  const handleCapture = useCallback((blob: Blob, name: string, paneLabel?: string) => {
    const url = URL.createObjectURL(blob);
    const cap: Capture = { id: uid(), name, blob, url, createdAt: new Date(), paneLabel };
    setCaptures(prev => [cap, ...prev]);
    setShowMediaPanel(true);
    if (sessions.activeSession) {
      sessions.saveCapture(sessions.activeSession, blob, name);
    }
  }, [sessions]);

  const handleDeleteCapture = useCallback((id: string) => {
    setCaptures(prev => {
      const cap = prev.find(c => c.id === id);
      if (cap) URL.revokeObjectURL(cap.url);
      return prev.filter(c => c.id !== id);
    });
  }, []);

  const handleDownloadCapture = useCallback((cap: Capture) => {
    const a = document.createElement('a');
    a.href = cap.url; a.download = cap.name; a.click();
  }, []);

  const handleSelectCapture = useCallback((cap: Capture) => {
    if (splitModeRef.current && activePaneRef.current === 1) {
      setPaneBSource({ type: 'image', capture: cap });
    } else {
      setActiveImage(cap);
      setActiveRecording(null);
    }
  }, [setPaneBSource]);

  const handleSelectRecording = useCallback((rec: Recording) => {
    if (splitModeRef.current && activePaneRef.current === 1) {
      setPaneBSource({ type: 'recording', recording: rec });
    } else {
      setActiveRecording(rec);
      setActiveImage(null);
    }
  }, [setPaneBSource]);

  const handleDeleteRecording = useCallback((id: string) => {
    setRecordings(prev => {
      const rec = prev.find(r => r.id === id);
      if (rec) URL.revokeObjectURL(rec.url);
      return prev.filter(r => r.id !== id);
    });
    setActiveRecording(r => (r?.id === id ? null : r));
    removeRecording(id);
  }, [removeRecording]);

  const handleDownloadRecording = useCallback((rec: Recording) => {
    saveRecordingToFile(rec);
  }, []);

  const handleImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const isImage = /\.(png|jpe?g|webp|gif)$/i.test(file.name);
    if (isImage) {
      const cap: Capture = { id: uid(), name: file.name, blob: file, url, createdAt: new Date() };
      setCaptures(prev => [cap, ...prev]);
      if (sessions.activeSession) sessions.saveCapture(sessions.activeSession, file, file.name);
      handleSelectCapture(cap);
    } else {
      const rec: Recording = { id: uid(), name: file.name, blob: file, url, createdAt: new Date(), duration: 0 };
      setRecordings(prev => [rec, ...prev]);
      persistRecording(rec);
      handleSelectRecording(rec);
    }
    e.target.value = '';
  }, [sessions, persistRecording, handleSelectCapture, handleSelectRecording]);

  const handleRenameCapture = useCallback((id: string, name: string) => {
    setCaptureLabels(prev => ({ ...prev, [id]: name }));
  }, []);

  const handleRenameRecording = useCallback((id: string, name: string) => {
    setRecordingLabels(prev => ({ ...prev, [id]: name }));
  }, []);

  return {
    captures, setCaptures,
    recordings, setRecordings,
    activeRecording, setActiveRecording,
    activeImage, setActiveImage,
    captureLabels, setCaptureLabels,
    recordingLabels, setRecordingLabels,
    showMediaPanel, setShowMediaPanel,
    handleCapture,
    handleDeleteCapture,
    handleDownloadCapture,
    handleSelectCapture,
    handleSelectRecording,
    handleDeleteRecording,
    handleDownloadRecording,
    handleImportFile,
    handleRenameCapture,
    handleRenameRecording,
  };
}
