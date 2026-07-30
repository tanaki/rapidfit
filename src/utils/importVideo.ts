/**
 * Video import processing pipeline.
 * Runs async steps on an imported file before persistence.
 * Extend ImportResult and add steps here as needed.
 */

export interface ImportResult {
  duration: number;
}

/**
 * Process an imported video file asynchronously.
 * Returns metadata extracted from the file (duration, etc.).
 */
export async function processImportedVideo(file: File): Promise<ImportResult> {
  const duration = await probeDuration(file);
  return { duration };
}

function probeDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const d = Number.isFinite(video.duration) ? video.duration : 0;
      URL.revokeObjectURL(url);
      resolve(d);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
    video.src = url;
  });
}
