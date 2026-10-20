import { binToGeometry, normalizeLetters, DEFAULT_LETTERS } from './sculpture-build.js';

export { normalizeLetters, DEFAULT_LETTERS, binToGeometry };

/**
 * @param {string} workerUrl
 */
export function createSculptureWorker(workerUrl) {
  let worker = null;
  let seq = 0;
  const pending = new Map();

  function ensureWorker() {
    if (worker) return worker;
    worker = new Worker(workerUrl);
    worker.onmessage = (event) => {
      const { id, ok, letters, buffer, error } = event.data || {};
      const entry = pending.get(id);
      if (!entry) return;
      pending.delete(id);
      if (ok) entry.resolve({ letters, buffer });
      else entry.reject(new Error(error || 'failed'));
    };
    worker.onerror = (event) => {
      for (const [, entry] of pending) entry.reject(event.error || new Error('worker'));
      pending.clear();
      worker?.terminate();
      worker = null;
    };
    return worker;
  }

  return {
    /**
     * @param {string} letters
     * @returns {Promise<{letters: string, buffer: ArrayBuffer}>}
     */
    build(letters) {
      const id = ++seq;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        try {
          ensureWorker().postMessage({ id, letters });
        } catch (error) {
          pending.delete(id);
          reject(error);
        }
      });
    },
    dispose() {
      for (const [, entry] of pending) entry.reject(new Error('disposed'));
      pending.clear();
      worker?.terminate();
      worker = null;
    },
  };
}

export function readQueryLetters() {
  try {
    return normalizeLetters(new URLSearchParams(location.search).get('s'));
  } catch {
    return null;
  }
}

/** @param {string} letters */
export function writeQueryLetters(letters) {
  try {
    const url = new URL(location.href);
    if (letters === DEFAULT_LETTERS) url.searchParams.delete('s');
    else url.searchParams.set('s', letters);
    history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  } catch {}
}
