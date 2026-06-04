import { useState, useEffect, useCallback } from 'react';
import type { CompanySettings } from '../types';
import { DEFAULT_COMPANY } from '../types';

type API = {
  companyGet: () => Promise<CompanySettings>;
  companySave: (s: CompanySettings) => Promise<void>;
};

function api(): API | null {
  return (window as unknown as { electronAPI?: API }).electronAPI ?? null;
}

export function useCompany() {
  const [company, setCompany] = useState<CompanySettings>(DEFAULT_COMPANY);

  useEffect(() => {
    api()?.companyGet().then(s => setCompany(s)).catch(() => {});
  }, []);

  const save = useCallback(async (settings: CompanySettings) => {
    setCompany(settings);
    await api()?.companySave(settings);
  }, []);

  return { company, save };
}
