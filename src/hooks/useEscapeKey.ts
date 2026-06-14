import { useEffect } from 'react';

/**
 * Ferme un modal lorsque l'utilisateur appuie sur Échap.
 * @param onClose  Callback de fermeture (undefined = pas de fermeture)
 * @param enabled  Permet de désactiver la touche (ex. NewSessionModal avec canClose=false)
 */
export function useEscapeKey(onClose: (() => void) | undefined, enabled = true): void {
  useEffect(() => {
    if (!enabled || !onClose) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, enabled]);
}
