/*
 * Cookie-Banner + Google Consent Mode v2 (wie ITME).
 *
 * gtag.js wird erst geladen, wenn analytische Cookies erlaubt sind.
 * Ohne Zustimmung: keine Google-Requests, keine _ga-Cookies.
 * Mess-ID in site-config.js: window.LACKDESIGN_SITE.gaMeasurementId
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'cookiePreferences';
  const CONSENT_EVENT = 'cookie-consent-changed';
  const DEFAULT_PREFERENCES = {
    necessary: true,
    functional: false,
    analytics: false,
  };

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() {
    window.dataLayer.push(arguments);
  };

  window.gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    wait_for_update: 500,
  });
  window.gtag('set', 'ads_data_redaction', true);

  function getGaId() {
    return String(window.LACKDESIGN_SITE?.gaMeasurementId || '').trim();
  }

  function readStoredConsent() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { preferences: { ...DEFAULT_PREFERENCES }, hasAccepted: false };
      const parsed = JSON.parse(raw);
      if (parsed.accepted !== true) {
        return { preferences: { ...DEFAULT_PREFERENCES }, hasAccepted: false };
      }
      return {
        preferences: {
          necessary: true,
          functional: parsed.functional === true,
          analytics: parsed.analytics === true,
        },
        hasAccepted: true,
      };
    } catch {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      return { preferences: { ...DEFAULT_PREFERENCES }, hasAccepted: false };
    }
  }

  function persistPreferences(preferences) {
    const stored = {
      necessary: true,
      functional: preferences.functional === true,
      analytics: preferences.analytics === true,
      accepted: true,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    return stored;
  }

  function updateConsentMode(analyticsGranted) {
    if (analyticsGranted) loadGoogleTag();
    window.gtag('consent', 'update', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: analyticsGranted ? 'granted' : 'denied',
    });

    const gaId = getGaId();
    if (gaId) {
      window['ga-disable-' + gaId] = !analyticsGranted;
    }
  }

  function loadGoogleTag() {
    const gaId = getGaId();
    if (!gaId || window.__gtagScriptRequested) return;
    window.__gtagScriptRequested = true;

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(gaId);
    script.onload = function () {
      window.gtag('js', new Date());
      window.gtag('config', gaId, {
        anonymize_ip: true,
        send_page_view: true,
      });
    };
    document.head.appendChild(script);
  }

  window.__loadGoogleTag = loadGoogleTag;

  const initial = readStoredConsent();
  let preferences = initial.preferences;
  let hasAccepted = initial.hasAccepted;
  let settingsOpen = false;
  let lastTrackedPath = null;

  if (hasAccepted) {
    updateConsentMode(preferences.analytics);
    if (preferences.analytics) {
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(function () {
          loadGoogleTag();
        }, { timeout: 4000 });
      } else {
        setTimeout(loadGoogleTag, 2500);
      }
    }
  }

  function deleteCookiesByCategory(category) {
    if (category === 'necessary') return;

    const prefixes = {
      analytics: ['_ga', '_gid', '_gat', '_gac_', '_gcl_'],
      functional: [],
    };
    const toDelete = prefixes[category] || [];
    if (!toDelete.length) return;

    const hostname = window.location.hostname;
    const domains = [hostname];
    if (hostname.includes('.')) {
      domains.push('.' + hostname.split('.').slice(-2).join('.'));
    }

    function expire(name, domain) {
      const base = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
      document.cookie = base;
      if (domain) document.cookie = base + ';domain=' + domain;
    }

    toDelete.forEach((prefix) => {
      expire(prefix);
      domains.forEach((domain) => expire(prefix, domain));
    });

    document.cookie.split(';').forEach((cookie) => {
      const name = cookie.split('=')[0].trim();
      if (toDelete.some((prefix) => name === prefix || name.startsWith(prefix))) {
        expire(name);
        domains.forEach((domain) => expire(name, domain));
      }
    });
  }

  if (!preferences.analytics) {
    deleteCookiesByCategory('analytics');
  }

  function applyPreferences(next) {
    preferences = {
      necessary: true,
      functional: next.functional === true,
      analytics: next.analytics === true,
    };
    persistPreferences(preferences);
    hasAccepted = true;
    settingsOpen = false;

    const tagAlreadyLoaded = Boolean(window.__gtagScriptRequested);
    updateConsentMode(preferences.analytics);

    if (!preferences.analytics) {
      deleteCookiesByCategory('analytics');
      lastTrackedPath = null;
    } else {
      const path = window.location.pathname + window.location.search + window.location.hash;
      if (tagAlreadyLoaded) {
        lastTrackedPath = null;
        trackPageView();
      } else {
        lastTrackedPath = path;
      }
    }

    window.dispatchEvent(new Event(CONSENT_EVENT));
  }

  function trackPageView() {
    if (!preferences.analytics || !getGaId()) return;
    loadGoogleTag();
    if (typeof window.gtag !== 'function') return;
    const path = window.location.pathname + window.location.search + window.location.hash;
    if (lastTrackedPath === path) return;
    lastTrackedPath = path;
    window.gtag('event', 'page_view', {
      page_path: path,
      page_location: window.location.href,
      page_title: document.title,
      send_to: getGaId(),
    });
  }

  function openCookieSettings() {
    settingsOpen = true;
    renderBanner();
  }

  window.LackdesignCookies = {
    openSettings: openCookieSettings,
    getPreferences: function () {
      return { ...preferences, accepted: hasAccepted };
    },
  };

  const CATEGORIES = [
    {
      id: 'necessary',
      required: true,
      name: 'Notwendige Cookies',
      description: 'Technisch erforderliche Speicherungen für den Betrieb der Website, zum Beispiel Ihre Cookie-Auswahl und die Darstellung der Seite. Sie können nicht deaktiviert werden.',
    },
    {
      id: 'functional',
      required: false,
      name: 'Funktionale Cookies',
      description: 'Optionale erweiterte Funktionen. Derzeit setzen wir in dieser Kategorie keine zusätzlichen Cookies. Die Auswahl wird gespeichert, falls später Funktionen dazukommen.',
    },
    {
      id: 'analytics',
      required: false,
      name: 'Analytische Cookies',
      description: 'Google Analytics hilft uns zu verstehen, wie Besucher die Website nutzen. Das Script und die Analyse-Cookies (_ga) werden nur gesetzt, wenn Sie zustimmen.',
    },
  ];

  let overlayEl = null;
  let bannerEl = null;
  let draft = null;
  let showDetails = false;
  let scrollLocked = false;
  let prevHtmlOverflow = '';
  let prevBodyOverflow = '';
  let savedScrollY = 0;

  function preventBackgroundScroll(event) {
    const target = event.target;
    if (target && target.closest && target.closest('[data-cookie-banner]')) return;
    event.preventDefault();
  }

  function lockScroll() {
    if (scrollLocked) return;
    scrollLocked = true;
    savedScrollY = window.scrollY;
    prevHtmlOverflow = document.documentElement.style.overflow;
    prevBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.dataset.cookieBannerOpen = 'true';
    document.addEventListener('wheel', preventBackgroundScroll, { passive: false, capture: true });
    document.addEventListener('touchmove', preventBackgroundScroll, { passive: false, capture: true });
  }

  function unlockScroll() {
    if (!scrollLocked) return;
    scrollLocked = false;
    document.documentElement.style.overflow = prevHtmlOverflow === 'hidden' ? '' : prevHtmlOverflow;
    document.body.style.overflow = prevBodyOverflow === 'hidden' ? '' : prevBodyOverflow;
    delete document.body.dataset.cookieBannerOpen;
    document.removeEventListener('wheel', preventBackgroundScroll, { capture: true });
    document.removeEventListener('touchmove', preventBackgroundScroll, { capture: true });
    window.scrollTo(0, savedScrollY);
  }

  function currentDraft() {
    return draft || { ...preferences };
  }

  function destroyBanner() {
    overlayEl?.remove();
    bannerEl?.remove();
    overlayEl = null;
    bannerEl = null;
    draft = null;
    showDetails = false;
    unlockScroll();
  }

  function shouldShowBanner() {
    return !hasAccepted || settingsOpen;
  }

  function handleAcceptAll() {
    applyPreferences({ necessary: true, functional: true, analytics: true });
    destroyBanner();
  }

  function handleRejectAll() {
    applyPreferences({ necessary: true, functional: false, analytics: false });
    destroyBanner();
  }

  function handleSave() {
    applyPreferences(currentDraft());
    destroyBanner();
  }

  function renderCategories(list) {
    const prefs = currentDraft();
    list.innerHTML = '';
    CATEGORIES.forEach((category) => {
      const row = document.createElement('div');
      row.className = 'cookie-banner__category';

      const copy = document.createElement('div');
      copy.className = 'cookie-banner__category-copy';

      const titleRow = document.createElement('div');
      titleRow.className = 'cookie-banner__category-title';
      const heading = document.createElement('h4');
      heading.textContent = category.name;
      titleRow.appendChild(heading);
      if (category.required) {
        const badge = document.createElement('span');
        badge.className = 'cookie-banner__badge';
        badge.textContent = 'Erforderlich';
        titleRow.appendChild(badge);
      }

      const desc = document.createElement('p');
      desc.textContent = category.description;

      copy.appendChild(titleRow);
      copy.appendChild(desc);

      const toggle = document.createElement('label');
      toggle.className = 'cookie-switch';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = prefs[category.id] === true;
      input.disabled = category.required;
      input.setAttribute('aria-label', category.name);
      input.addEventListener('change', () => {
        if (category.required) return;
        draft = { ...currentDraft(), [category.id]: input.checked };
      });
      const ui = document.createElement('span');
      ui.className = 'cookie-switch__ui';
      ui.setAttribute('aria-hidden', 'true');
      toggle.appendChild(input);
      toggle.appendChild(ui);

      row.appendChild(copy);
      row.appendChild(toggle);
      list.appendChild(row);
    });
  }

  function renderBanner() {
    if (!shouldShowBanner()) {
      destroyBanner();
      return;
    }

    draft = { ...preferences };
    showDetails = settingsOpen;
    lockScroll();

    if (!overlayEl) {
      overlayEl = document.createElement('div');
      overlayEl.className = 'cookie-banner__overlay';
      overlayEl.setAttribute('aria-hidden', 'true');
      document.body.appendChild(overlayEl);
    }

    if (!bannerEl) {
      bannerEl = document.createElement('div');
      bannerEl.className = 'cookie-banner';
      bannerEl.tabIndex = -1;
      bannerEl.setAttribute('data-cookie-banner', '');
      bannerEl.setAttribute('role', 'dialog');
      bannerEl.setAttribute('aria-modal', 'true');
      bannerEl.setAttribute('aria-labelledby', 'cookie-banner-title');
      bannerEl.innerHTML = `
        <div class="cookie-banner__accent"></div>
        <div class="cookie-banner__inner">
          <div class="cookie-banner__intro">
            <h3 id="cookie-banner-title">Cookie-Einstellungen</h3>
            <p>
              Wir verwenden Cookies, um Ihnen die bestmögliche Erfahrung auf unserer Website zu bieten.
              Sie können Ihre Einstellungen jederzeit anpassen.
              Bitte wählen Sie eine der Optionen unten, um fortzufahren.
              Weitere Informationen finden Sie in unserer
              <a href="datenschutz.html">Datenschutzerklärung</a>.
            </p>
          </div>
          <button type="button" class="cookie-banner__manage" aria-expanded="false">
            <span class="cookie-banner__manage-label">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z" stroke="currentColor" stroke-width="1.5"/><path d="M19.4 13a7.7 7.7 0 00.05-2l1.7-1.3-1.6-2.8-2 .5a7.6 7.6 0 00-1.7-1L15.4 4h-3.2L12 6.4a7.6 7.6 0 00-1.7 1l-2-.5-1.6 2.8L8.4 11a7.7 7.7 0 000 2l-1.7 1.3 1.6 2.8 2-.5a7.6 7.6 0 001.7 1l.4 2.4h3.2l.4-2.4a7.6 7.6 0 001.7-1l2 .5 1.6-2.8-1.7-1.3z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
              Cookie-Kategorien verwalten
            </span>
            <svg class="cookie-banner__chevron" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <div class="cookie-banner__categories" hidden></div>
          <div class="cookie-banner__actions">
            <button type="button" class="cookie-banner__btn cookie-banner__btn--ghost" data-action="reject">Alle ablehnen</button>
            <button type="button" class="cookie-banner__btn cookie-banner__btn--ghost" data-action="save">Auswahl speichern</button>
            <button type="button" class="cookie-banner__btn cookie-banner__btn--solid" data-action="accept">Alle akzeptieren</button>
          </div>
        </div>
      `;
      document.body.appendChild(bannerEl);

      const manageBtn = bannerEl.querySelector('.cookie-banner__manage');
      const list = bannerEl.querySelector('.cookie-banner__categories');

      manageBtn.addEventListener('click', () => {
        showDetails = !showDetails;
        manageBtn.setAttribute('aria-expanded', String(showDetails));
        manageBtn.classList.toggle('is-open', showDetails);
        list.hidden = !showDetails;
        if (showDetails) renderCategories(list);
      });

      bannerEl.querySelector('[data-action="reject"]').addEventListener('click', handleRejectAll);
      bannerEl.querySelector('[data-action="save"]').addEventListener('click', handleSave);
      bannerEl.querySelector('[data-action="accept"]').addEventListener('click', handleAcceptAll);
    }

    const manageBtn = bannerEl.querySelector('.cookie-banner__manage');
    const list = bannerEl.querySelector('.cookie-banner__categories');
    manageBtn.setAttribute('aria-expanded', String(showDetails));
    manageBtn.classList.toggle('is-open', showDetails);
    list.hidden = !showDetails;
    if (showDetails) renderCategories(list);

    bannerEl.focus();
  }

  function bindFooterButtons() {
    document.querySelectorAll('.js-cookie-settings').forEach((el) => {
      if (el.dataset.cookieBound) return;
      el.dataset.cookieBound = '1';
      el.addEventListener('click', (event) => {
        event.preventDefault();
        openCookieSettings();
      });
    });
  }

  function onHashChange() {
    if (!hasAccepted || !preferences.analytics) return;
    lastTrackedPath = null;
    trackPageView();
  }

  function bootBanner() {
    bindFooterButtons();
    if (shouldShowBanner()) renderBanner();
    window.addEventListener('hashchange', onHashChange);
  }

  function whenSiteReady(fn) {
    const start = () => {
      if (document.documentElement.classList.contains('is-locked')) {
        document.addEventListener('lackdesign:unlock', fn, { once: true });
        return;
      }
      fn();
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
      start();
    }
  }

  whenSiteReady(bootBanner);
})();
