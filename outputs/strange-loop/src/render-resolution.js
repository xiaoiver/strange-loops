export function renderResolution(width, height, devicePixelRatio) {
  const ratio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  const pixelRatio = Math.min(ratio, width <= 760 ? 1.25 : 2);
  return {
    pixelRatio,
    bufferWidth: Math.max(1, Math.floor(width * pixelRatio)),
    bufferHeight: Math.max(1, Math.floor(height * pixelRatio)),
  };
}

// A DPR change can occur without a window resize, such as moving between displays.
export function observePixelRatio(onChange, host = window) {
  let query;
  function observe() {
    query?.removeEventListener('change', changed);
    query = host.matchMedia(`(resolution: ${host.devicePixelRatio}dppx)`);
    query.addEventListener('change', changed);
  }
  function changed() { observe(); onChange(); }
  observe();
  return () => query.removeEventListener('change', changed);
}
