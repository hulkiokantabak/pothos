/* Anonymous page visits only; no game state, gifts, query strings or fragments. */
(function () {
  'use strict';
  var prefix = '/pothos/';
  if (location.origin !== 'https://hulkiokantabak.github.io' ||
      (location.pathname !== prefix.slice(0, -1) && location.pathname.indexOf(prefix) !== 0) ||
      navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' ||
      navigator.doNotTrack === 'yes' || window.doNotTrack === '1' ||
      navigator.msDoNotTrack === '1' || window.__pageAnalyticsStarted) return;
  window.__pageAnalyticsStarted = true;

  var page = location.pathname.replace(/\/index\.html$/, '/');
  var title = document.title;
  var referrer = '';
  try {
    if (document.referrer) {
      var ref = new URL(document.referrer);
      if (ref.protocol === 'https:' || ref.protocol === 'http:') referrer = ref.origin;
    }
  } catch (_) { /* Ignore malformed referrers. */ }

  window.goatcounter = { no_onload: true, no_events: true, path: page, title: title, referrer: referrer };
  var script = document.createElement('script');
  script.dataset.goatcounter = 'https://hulkiokantabak.goatcounter.com/count';
  script.src = 'https://gc.zgo.at/count.v5.js';
  script.integrity = 'sha384-atnOLvQb9t+jTSipvd75X2yginT4PjVbqDdlJAmxMm+wYElFmeR6EmLP5bYeoRVQ';
  script.crossOrigin = 'anonymous';
  script.async = true;
  script.onload = function () {
    var gc = window.goatcounter;
    if (!gc || typeof gc.get_data !== 'function' || typeof gc.count !== 'function') return;
    var getData = gc.get_data;
    gc.get_data = function (vars) {
      var data = getData(vars);
      // The official SDK includes a separate raw query field, even with a safe path.
      delete data.q;
      data.p = page;
      data.t = title;
      data.r = referrer;
      return data;
    };
    var counted = false;
    function countOnce() {
      if (counted || (document.visibilityState && document.visibilityState !== 'visible')) return;
      counted = true;
      document.removeEventListener('visibilitychange', countOnce);
      try { gc.count(); } catch (_) { /* Analytics must never interrupt the artwork. */ }
    }
    document.addEventListener('visibilitychange', countOnce);
    countOnce();
  };
  document.head.appendChild(script);
}());
