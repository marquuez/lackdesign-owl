(function () {
  'use strict';

  const PLACE_KEY = 'lackdesign_place';
  const RESTORE_KEY = 'lackdesign_restore';

  document.querySelectorAll('.legal-back').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      try {
        sessionStorage.setItem(RESTORE_KEY, '1');
      } catch {
        /* ignore */
      }

      let sameOrigin = false;
      try {
        sameOrigin = Boolean(document.referrer) && new URL(document.referrer).origin === location.origin;
      } catch {
        sameOrigin = false;
      }

      if (sameOrigin && window.history.length > 1) {
        window.history.back();
        return;
      }

      try {
        const place = JSON.parse(sessionStorage.getItem(PLACE_KEY) || 'null');
        if (place?.href) {
          window.location.href = place.href;
          return;
        }
      } catch {
        /* ignore */
      }

      window.location.href = 'index.html';
    });
  });

  fetch('/api/site')
    .then((res) => (res.ok ? res.json() : null))
    .then((site) => {
      if (!site?.phoneHref) return;
      document.querySelectorAll('.js-call').forEach((el) => {
        el.href = site.phoneHref;
      });
    })
    .catch(() => {});
})();
