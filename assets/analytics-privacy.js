window.sanitizeSiteAnalytics = function (type, payload) {
  if (location.hostname !== 'ytkgeo.github.io' || !location.pathname.startsWith('/yutianke/')) return false;
  if (navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true) return false;

  const sanitized = { ...payload };
  if (sanitized.referrer) {
    try {
      const referrer = new URL(sanitized.referrer);
      referrer.search = '';
      referrer.hash = '';
      sanitized.referrer = referrer.href;
    } catch {
      sanitized.referrer = '';
    }
  }
  return sanitized;
};
