export function trackEvent(name, params = {}) {
  try {
    if (window.dataLayer && typeof window.dataLayer.push === 'function') {
      window.dataLayer.push({ event: name, ...params });
    }
    if (typeof window.gtag === 'function') {
      window.gtag('event', name, params);
    }
    // console fallback for local dev
    // eslint-disable-next-line no-console
    console.debug('[analytics]', name, params);
  } catch (e) {
    // ignore analytics errors
  }
}
