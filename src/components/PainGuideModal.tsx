import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PAIN_GUIDE } from '../data/painGuide';

interface Props {
  onClose: () => void;
}

export function PainGuideModal({ onClose }: Props) {
  const { t } = useTranslation();
  // Track which section and which zone are open
  const [openSection, setOpenSection] = useState<string | null>(PAIN_GUIDE[0].id);
  const [openZone, setOpenZone]       = useState<string | null>(null);

  const toggleSection = (id: string) => {
    setOpenSection(prev => prev === id ? null : id);
    setOpenZone(null);
  };

  const toggleZone = (id: string) => {
    setOpenZone(prev => prev === id ? null : id);
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1000]"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#13131f] border border-[#22223b] rounded-xl w-[760px] max-h-[90vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#22223b] shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-100">{t('painGuide.title')}</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {t('painGuide.subtitle')}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">✕</button>
        </div>

        {/* Disclaimer */}
        <div className="px-6 py-2.5 bg-amber-950/30 border-b border-amber-900/30 shrink-0">
          <p className="text-[10px] text-amber-400/80 leading-relaxed">
            {t('painGuide.disclaimer')}
          </p>
        </div>

        {/* Accordion */}
        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-1.5">
          {PAIN_GUIDE.map(section => {
            const sectionOpen = openSection === section.id;
            return (
              <div key={section.id} className="rounded-lg border border-[#22223b] overflow-hidden">

                {/* Section header */}
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-[#1a1a2e] hover:bg-[#1e1e38] transition-colors text-left"
                >
                  <span className="text-lg leading-none">{section.emoji}</span>
                  <span className="flex-1 text-sm font-semibold text-slate-200">{section.title}</span>
                  <span className={`text-slate-500 text-xs transition-transform duration-200 ${sectionOpen ? 'rotate-180' : ''}`}>▼</span>
                </button>

                {/* Section content */}
                {sectionOpen && (
                  <div className="divide-y divide-[#22223b]">
                    {section.zones.map(zone => {
                      const zoneOpen = openZone === zone.id;
                      return (
                        <div key={zone.id}>

                          {/* Zone header */}
                          <button
                            onClick={() => toggleZone(zone.id)}
                            className="w-full flex items-center gap-2 px-5 py-2.5 bg-[#13131f] hover:bg-[#1a1a2e] transition-colors text-left"
                          >
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${zoneOpen ? 'bg-indigo-400' : 'bg-slate-600'}`} />
                            <span className="flex-1 text-[13px] font-medium text-slate-300">{zone.name}</span>
                            <span className={`text-slate-600 text-[10px] transition-transform duration-200 ${zoneOpen ? 'rotate-180' : ''}`}>▼</span>
                          </button>

                          {/* Zone detail */}
                          {zoneOpen && (
                            <div className="px-5 pb-4 pt-1 bg-[#0f0f1e] space-y-4">
                              {zone.causes.map((cause, ci) => (
                                <div key={ci} className="flex gap-3">
                                  {/* Cause */}
                                  <div className="shrink-0 mt-0.5">
                                    <div className="w-5 h-5 rounded-full bg-[#22223b] border border-[#3d3d5c] flex items-center justify-center text-[9px] font-bold text-slate-400">
                                      {ci + 1}
                                    </div>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[12px] text-amber-300/90 font-medium leading-snug mb-2">
                                      {cause.problem}
                                    </p>
                                    <ul className="space-y-1">
                                      {cause.solutions.map((sol, si) => (
                                        <li key={si} className="flex items-start gap-2 text-[12px] text-slate-400 leading-snug">
                                          <span className="text-indigo-400 mt-px shrink-0">→</span>
                                          <span>{sol}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#22223b] shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {t('painGuide.close')}
          </button>
        </div>

      </div>
    </div>
  );
}
