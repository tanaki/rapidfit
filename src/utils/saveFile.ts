import type { Recording } from '../types';

/**
 * Save a recording to the user's filesystem.
 * - Chrome/Edge: opens a native "Save As" dialog via File System Access API.
 * - Other browsers: triggers a regular <a> download to the Downloads folder.
 */
export async function saveRecordingToFile(rec: Recording): Promise<void> {
  if ('showSaveFilePicker' in window) {
    try {
      const ext = rec.name.split('.').pop() || 'webm';
      const handle = await (window as Window & { showSaveFilePicker: (opts: unknown) => Promise<FileSystemFileHandle> }).showSaveFilePicker({
        suggestedName: rec.name,
        types: [{
          description: 'Fichier vidéo',
          accept: ext === 'mp4'
            ? { 'video/mp4': ['.mp4'] }
            : { 'video/webm': ['.webm'] },
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(rec.blob);
      await writable.close();
      return;
    } catch (e: unknown) {
      // AbortError = user closed the picker without saving → no fallback needed
      if ((e as DOMException)?.name === 'AbortError') return;
      // Any other error → fall through to standard download
    }
  }
  // Fallback: browser-managed download (goes to Downloads folder)
  const a = document.createElement('a');
  a.href = rec.url;
  a.download = rec.name;
  a.click();
}
