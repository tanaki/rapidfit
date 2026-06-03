import { useState, useEffect, useRef, useCallback } from 'react';
import type { VideoConfig } from '../types';

export function useCamera(config: VideoConfig) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: config.deviceId ? { exact: config.deviceId } : undefined,
          width:     { ideal: config.width },
          height:    { ideal: config.height },
          frameRate: { ideal: config.frameRate },
        },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsActive(true);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [config]);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsActive(false);
  }, []);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return { videoRef, streamRef, isActive, error, start, stop };
}

export function useDevices() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  const refresh = useCallback(async () => {
    try {
      const probe = await navigator.mediaDevices.getUserMedia({ video: true });
      probe.getTracks().forEach(t => t.stop());
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices(all.filter(d => d.kind === 'videoinput'));
    } catch {
      // permission denied or no device
    }
  }, []);

  useEffect(() => {
    refresh();
    navigator.mediaDevices.addEventListener('devicechange', refresh);
    return () => navigator.mediaDevices.removeEventListener('devicechange', refresh);
  }, [refresh]);

  return { devices, refresh };
}
