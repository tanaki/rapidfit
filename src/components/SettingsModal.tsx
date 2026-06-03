import type { VideoConfig } from '../types';
import { RESOLUTIONS, FRAMERATES } from '../types';

interface Props {
  config: VideoConfig;
  onChange: (c: VideoConfig) => void;
  onClose: () => void;
  devices: MediaDeviceInfo[];
}

export function SettingsModal({ config, onChange, onClose, devices }: Props) {
  const update = (partial: Partial<VideoConfig>) => onChange({ ...config, ...partial });

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1000]"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#13131f] border border-[#22223b] rounded-xl p-6 w-96 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-slate-100">Paramètres vidéo</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">✕</button>
        </div>

        <div className="flex flex-col gap-4">
          {/* Device */}
          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-400">Caméra</span>
            <select
              value={config.deviceId}
              onChange={e => update({ deviceId: e.target.value })}
              className="bg-[#22223b] text-slate-200 text-sm rounded-lg px-3 py-2 border border-[#3d3d5c] outline-none"
            >
              <option value="">Caméra par défaut</option>
              {devices.map(d => (
                <option key={d.deviceId} value={d.deviceId}>{d.label || `Caméra ${d.deviceId.slice(0, 8)}`}</option>
              ))}
            </select>
          </label>

          {/* Resolution */}
          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-400">Résolution</span>
            <select
              value={Object.entries(RESOLUTIONS).find(([, v]) => v.width === config.width)?.[0] || '1080p'}
              onChange={e => {
                const r = RESOLUTIONS[e.target.value];
                if (r) update({ width: r.width, height: r.height });
              }}
              className="bg-[#22223b] text-slate-200 text-sm rounded-lg px-3 py-2 border border-[#3d3d5c] outline-none"
            >
              {Object.entries(RESOLUTIONS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </label>

          {/* Frame rate */}
          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-400">Images/seconde</span>
            <div className="flex gap-2">
              {FRAMERATES.map(fps => (
                <button
                  key={fps}
                  onClick={() => update({ frameRate: fps })}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    config.frameRate === fps
                      ? 'bg-indigo-600 text-white'
                      : 'bg-[#22223b] text-slate-300 hover:bg-[#2d2d48]'
                  }`}
                >
                  {fps} fps
                </button>
              ))}
            </div>
          </label>

          {/* Video bitrate */}
          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-400">Débit vidéo : {config.videoBitrate} kbps</span>
            <input
              type="range" min={500} max={50000} step={500} value={config.videoBitrate}
              onChange={e => update({ videoBitrate: Number(e.target.value) })}
              className="accent-indigo-500"
            />
            <div className="flex justify-between text-[10px] text-slate-600">
              <span>500 kbps</span><span>50 Mbps</span>
            </div>
          </label>

        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors"
        >
          Appliquer
        </button>
      </div>
    </div>
  );
}
