/** Lazy singleton loader for OpenCV.js (WASM).
 *  Injects the script once, resolves when cv.onRuntimeInitialized fires.
 *  Subsequent calls return the cached promise immediately. */

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cv: any;
    Module: { onRuntimeInitialized?: () => void };
  }
}

let cvPromise: Promise<typeof window.cv> | null = null;

export function loadOpenCV(): Promise<typeof window.cv> {
  if (cvPromise) return cvPromise;

  cvPromise = new Promise((resolve, reject) => {
    if (window.cv?.Mat) {
      resolve(window.cv);
      return;
    }

    // Callback que OpenCV.js appelle dès que le WASM est prêt
    window.Module = {
      onRuntimeInitialized() {
        resolve(window.cv);
      },
    };

    const script = document.createElement('script');
    script.src = `${import.meta.env.BASE_URL}opencv.js`;
    script.async = true;
    script.onerror = () => reject(new Error('Impossible de charger opencv.js'));
    document.head.appendChild(script);
  });

  return cvPromise;
}
