import { useState, useEffect, useRef, useCallback } from 'react';

export function useDevices() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  const refresh = useCallback(async () => {
    try {
      // Step 1 — enumerate directly.
      // In Electron with setPermissionCheckHandler returning true the browser
      // exposes device labels without a prior getUserMedia call, unlike a plain
      // web browser. This avoids the situation where the probe itself fails
      // (camera not yet connected, TCC not yet granted) and silently empties
      // the device list forever.
      let all = await navigator.mediaDevices.enumerateDevices();
      let inputs = all.filter(d => d.kind === 'videoinput');

      // Step 2 — if labels are absent (pure web-browser fallback path), do a
      // lightweight probe to unlock them, then re-enumerate.
      if (inputs.length > 0 && inputs.every(d => !d.label)) {
        try {
          const probe = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          probe.getTracks().forEach(t => t.stop());
          all    = await navigator.mediaDevices.enumerateDevices();
          inputs = all.filter(d => d.kind === 'videoinput');
        } catch {
          // Probe failed — keep the unlabelled entries so the deviceIds are at
          // least available for getUserMedia.
        }
      }

      setDevices(inputs);
    } catch {
      // MediaDevices API unavailable (non-secure context, etc.)
    }
  }, []);

  useEffect(() => {
    refresh();
    navigator.mediaDevices.addEventListener('devicechange', refresh);
    return () => navigator.mediaDevices.removeEventListener('devicechange', refresh);
  }, [refresh]);

  return { devices, refresh };
}
