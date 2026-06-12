/** Lazy singleton loader for OpenCV.js (WASM — @techstark/opencv-js UMD build).
 *
 *  The UMD bundle sets `window.cv = cv(Module)` where `cv(Module)` is an
 *  emscripten Promise that resolves to the initialized cv instance.
 *  We await that Promise after the script tag loads. */

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cv: any;
  }
}

let cvPromise: Promise<typeof window.cv> | null = null;

export function loadOpenCV(): Promise<typeof window.cv> {
  if (cvPromise) return cvPromise;

  cvPromise = new Promise((resolve, reject) => {
    // Already fully initialized (cv is the module object, not a Promise)
    if (window.cv && typeof window.cv.then !== 'function' && typeof window.cv.Mat !== 'undefined') {
      resolve(window.cv);
      return;
    }

    const inject = () => {
      const script = document.createElement('script');
      script.src = `${import.meta.env.BASE_URL}opencv.js`;
      script.async = true;
      script.onerror = () => reject(new Error('Impossible de charger opencv.js'));
      script.onload = async () => {
        try {
          // window.cv is an emscripten Promise — await it to get the cv instance
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cv: any = await window.cv;
          resolve(cv);
        } catch (e) {
          reject(e);
        }
      };
      document.head.appendChild(script);
    };

    // Script already injected (e.g., partial load): await the existing Promise
    if (window.cv && typeof window.cv.then === 'function') {
      window.cv.then(resolve, reject);
    } else {
      inject();
    }
  });

  return cvPromise;
}
