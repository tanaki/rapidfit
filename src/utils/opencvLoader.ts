/** Lazy singleton loader for OpenCV.js (WASM — @techstark/opencv-js UMD build).
 *
 *  The UMD factory calls cv(Module) synchronously and returns the Module object
 *  (not a Promise). The Module is populated with cv methods only AFTER the WASM
 *  binary is compiled — emscripten signals this via Module.onRuntimeInitialized.
 *  We set that callback on the already-created window.cv object right after the
 *  script tag loads (WASM compilation is always async, so there is time). */

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cv: any;
  }
}

const LOAD_TIMEOUT_MS = 45_000;

let cvPromise: Promise<typeof window.cv> | null = null;

export function loadOpenCV(): Promise<typeof window.cv> {
  if (cvPromise) return cvPromise;

  cvPromise = new Promise((resolve, reject) => {
    // Already fully initialized
    if (window.cv && typeof window.cv.Mat !== 'undefined') {
      resolve(window.cv);
      return;
    }

    const doLoad = () => {
      const script = document.createElement('script');
      script.src = `${import.meta.env.BASE_URL}opencv.js`;
      script.async = true;

      script.onerror = () => {
        cvPromise = null;
        reject(new Error('Impossible de charger opencv.js'));
      };

      script.onload = () => {
        const cv = window.cv;
        if (!cv) {
          cvPromise = null;
          reject(new Error('opencv.js chargé mais window.cv absent'));
          return;
        }

        // Fast path: WASM already initialized (edge case)
        if (typeof cv.Mat !== 'undefined') {
          resolve(cv);
          return;
        }

        // Normal path: WASM compiles asynchronously.
        // window.cv IS the Module object created by the UMD factory.
        // Setting onRuntimeInitialized here is safe — emscripten reads it
        // when the WASM instantiation Promise settles (always after this tick).
        const timeout = setTimeout(() => {
          cvPromise = null;
          reject(new Error('Timeout : OpenCV WASM non initialisé après 45 s'));
        }, LOAD_TIMEOUT_MS);

        cv.onRuntimeInitialized = () => {
          clearTimeout(timeout);
          resolve(cv);
        };
      };

      document.head.appendChild(script);
    };

    // Script already injected but WASM still compiling: hook onto existing Module
    if (window.cv && typeof window.cv.Mat === 'undefined') {
      const timeout = setTimeout(() => {
        cvPromise = null;
        reject(new Error('Timeout : OpenCV WASM non initialisé après 45 s'));
      }, LOAD_TIMEOUT_MS);
      window.cv.onRuntimeInitialized = () => {
        clearTimeout(timeout);
        resolve(window.cv);
      };
    } else {
      doLoad();
    }
  });

  return cvPromise;
}
