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

  function applyLegalContact(site) {
    const phone = String(site?.phone || '').trim();
    const email = String(site?.email || '').trim();
    const phoneHref = site?.phoneHref || (phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : '');
    const mailHref = site?.mailHref || (email ? `mailto:${email}` : '');

    if (phoneHref) {
      document.querySelectorAll('.js-call').forEach((el) => {
        el.href = phoneHref;
      });
      document.querySelectorAll('.js-phone-label').forEach((el) => {
        el.textContent = phone;
      });
    }
    if (mailHref) {
      document.querySelectorAll('.js-mail').forEach((el) => {
        el.href = mailHref;
        el.textContent = email;
      });
    }
  }

  applyLegalContact(window.LACKDESIGN_SITE);

  fetch('/api/site')
    .then((res) => (res.ok ? res.json() : null))
    .then((site) => {
      if (!site) return;
      applyLegalContact({
        phone: site.phone || window.LACKDESIGN_SITE?.phone,
        email: site.email || window.LACKDESIGN_SITE?.email,
        phoneHref: site.phoneHref,
        mailHref: site.mailHref,
      });
    })
    .catch(() => {});
})();
