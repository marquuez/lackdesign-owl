(function () {
  'use strict';

  const INTRO_DURATION = 2600;
  const INTRO_SEEN_KEY = 'lackdesign_intro_seen';
  const PLACE_KEY = 'lackdesign_place';
  const RESTORE_KEY = 'lackdesign_restore';
  const SLIDE_INTERVAL = 7000;

  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }

  const intro = document.getElementById('intro');
  const mainContent = document.getElementById('mainContent');
  const siteHeader = document.getElementById('siteHeader');
  const menuToggle = document.getElementById('menuToggle');
  const megaMenu = document.getElementById('megaMenu');
  const contactForm = document.getElementById('contactForm');
  const heroPause = document.getElementById('heroPause');
  const heroDots = document.querySelectorAll('.hero__dot');
  const heroSlides = document.querySelectorAll('.hero__slide');
  const heroVideo = document.querySelector('.hero__video');
  const revealElements = document.querySelectorAll('.reveal');
  const parallaxTiles = document.querySelectorAll('.tile__bg');
  const menuLinks = document.querySelectorAll('[data-menu-link]');
  const menuLabel = menuToggle?.querySelector('.site-header__menu-label');
  const navItems = document.querySelectorAll('.mega-nav__item');
  const stagePanels = document.querySelectorAll('.mega-stage');
  const previewLinks = document.querySelectorAll('[data-preview]');
  const pageNav = document.getElementById('pageNav');
  const pageNavUp = document.getElementById('pageNavUp');
  const pageNavDown = document.getElementById('pageNavDown');
  const chapters = Array.from(document.querySelectorAll('[data-chapter]'));

  let currentSlide = 0;
  let slideTimer = null;
  let carouselPaused = false;
  let videoPaused = false;

  /* ─── Intro ─── */
  function shouldPlayIntro() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    if (document.documentElement.classList.contains('skip-intro')) return false;

    try {
      const nav = performance.getEntriesByType('navigation')[0];
      if (nav?.type === 'back_forward') return false;
      if (nav?.type === 'reload') return true;
      if (!sessionStorage.getItem(INTRO_SEEN_KEY)) return true;
    } catch {
      return true;
    }
    return false;
  }

  function finishIntro() {
    intro?.querySelector('.intro__bar')?.setAttribute('aria-valuenow', '100');
    intro?.classList.add('is-done');
    intro?.setAttribute('aria-busy', 'false');
    mainContent?.classList.add('is-ready');
    siteHeader?.classList.add('is-visible');
    pageNav?.classList.add('is-visible');
    document.body.classList.remove('intro-active');
    document.documentElement.classList.add('skip-intro');

    try {
      sessionStorage.setItem(INTRO_SEEN_KEY, '1');
    } catch {
      /* ignore */
    }

    revealElements.forEach((el) => {
      if (isInViewport(el)) el.classList.add('is-visible');
    });

    restorePlace();
    startCarousel();
  }

  function runIntro() {
    if (!shouldPlayIntro()) {
      finishIntro();
      return;
    }

    document.body.classList.add('intro-active');
    setTimeout(finishIntro, INTRO_DURATION);
  }

  /* ─── Hero video ─── */
  function initHeroVideo() {
    if (!heroVideo) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      heroVideo.pause();
      heroVideo.removeAttribute('autoplay');
      return;
    }

    const play = () => {
      heroVideo.play().catch(() => {});
    };

    play();
    document.addEventListener('click', play, { once: true });
  }

  function toggleVideo() {
    if (!heroVideo) return;
    videoPaused = !videoPaused;

    if (videoPaused) {
      heroVideo.pause();
      carouselPaused = true;
      stopCarousel();
    } else {
      heroVideo.play().catch(() => {});
      carouselPaused = false;
      startCarousel();
    }

    const pauseIcon = heroPause?.querySelector('.icon-pause');
    const playIcon = heroPause?.querySelector('.icon-play');
    if (pauseIcon && playIcon) {
      pauseIcon.hidden = videoPaused;
      playIcon.hidden = !videoPaused;
    }
    heroPause?.setAttribute('aria-label', videoPaused ? 'Video abspielen' : 'Video pausieren');
  }

  /* ─── Hero carousel (text only; video keeps playing) ─── */
  function goToSlide(index) {
    if (index === currentSlide) return;

    const prev = heroSlides[currentSlide];
    const next = heroSlides[index];
    if (!prev || !next) return;

    prev.classList.remove('is-active');
    prev.setAttribute('aria-hidden', 'true');
    next.setAttribute('aria-hidden', 'false');
    next.classList.add('is-active');

    heroDots.forEach((dot, i) => {
      const active = i === index;
      dot.classList.toggle('is-active', active);
      dot.setAttribute('aria-selected', String(active));
    });

    currentSlide = index;
  }

  function nextSlide() {
    goToSlide((currentSlide + 1) % heroSlides.length);
  }

  function startCarousel() {
    stopCarousel();
    if (carouselPaused) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    slideTimer = setInterval(nextSlide, SLIDE_INTERVAL);
  }

  function stopCarousel() {
    if (slideTimer) {
      clearInterval(slideTimer);
      slideTimer = null;
    }
  }

  heroDots.forEach((dot) => {
    dot.addEventListener('click', () => {
      const index = Number(dot.dataset.goto);
      goToSlide(index);
      startCarousel();
    });
  });

  heroPause?.addEventListener('click', toggleVideo);

  /* ─── Header scroll ─── */
  function updateHeader() {
    siteHeader?.classList.toggle('is-scrolled', window.scrollY > 40);
  }

  /* ─── Section up/down ─── */
  function getCurrentChapterIndex() {
    const threshold = window.innerHeight * 0.38;
    let index = 0;
    chapters.forEach((el, i) => {
      if (el.getBoundingClientRect().top <= threshold) index = i;
    });
    return index;
  }

  function savePlace() {
    try {
      sessionStorage.setItem(PLACE_KEY, JSON.stringify({
        href: `${location.pathname}${location.search}${location.hash}`,
        y: window.scrollY,
      }));
    } catch {
      /* ignore */
    }
  }

  function restorePlace() {
    let should = false;
    try {
      should = sessionStorage.getItem(RESTORE_KEY) === '1';
      const nav = performance.getEntriesByType('navigation')[0];
      if (nav?.type === 'back_forward') should = true;
    } catch {
      /* ignore */
    }
    if (!should) return;

    try {
      sessionStorage.removeItem(RESTORE_KEY);
      const place = JSON.parse(sessionStorage.getItem(PLACE_KEY) || 'null');
      if (!place || typeof place.y !== 'number') return;
      const html = document.documentElement;
      const previous = html.style.scrollBehavior;
      html.style.scrollBehavior = 'auto';
      window.scrollTo(0, place.y);
      html.style.scrollBehavior = previous;
      syncPromoFromHash();
    } catch {
      /* ignore */
    }
  }

  function scrollToChapter(index) {
    const el = chapters[index];
    if (!el?.id) return;
    if (`#${el.id}` !== location.hash) {
      history.pushState({ chapter: el.id }, '', `#${el.id}`);
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    syncPromoFromHash();
  }

  function updatePageNav() {
    const index = getCurrentChapterIndex();
    if (pageNavUp) pageNavUp.disabled = index <= 0;
    if (pageNavDown) pageNavDown.disabled = index >= chapters.length - 1;
  }

  pageNavUp?.addEventListener('click', () => {
    scrollToChapter(getCurrentChapterIndex() - 1);
  });

  pageNavDown?.addEventListener('click', () => {
    scrollToChapter(getCurrentChapterIndex() + 1);
  });

  /* ─── Hero isometric scroll ─── */
  const heroIso = document.getElementById('hero');
  const heroIsoFrame = document.getElementById('heroIsoFrame');
  const heroSticky = heroIso?.querySelector('.hero');
  const heroActions = heroIso?.querySelector('.hero__actions');
  const heroLogo = document.getElementById('heroLogo');
  const headerLogo = document.querySelector('.site-header__logo');
  const heroTrack = document.getElementById('heroTrack');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function easeSmooth(t) {
    return t * t * (3 - 2 * t);
  }

  function getHeroLogoStartH() {
    if (window.matchMedia('(max-width: 399px)').matches) return 42;
    if (window.matchMedia('(max-width: 899px)').matches) return 48;
    return 64;
  }

  function getLogoSourceSize(logoImg) {
    const attrW = parseInt(logoImg?.getAttribute('width') || '', 10) || 0;
    const attrH = parseInt(logoImg?.getAttribute('height') || '', 10) || 0;
    const nw = logoImg?.naturalWidth || 0;
    const nh = logoImg?.naturalHeight || 0;

    if (attrW > 0 && attrH > 0 && (nw < attrW * 0.85 || nh < attrH * 0.85)) {
      return { nw: attrW, nh: attrH };
    }
    if (nw > 0 && nh > 0) return { nw, nh };
    return { nw: attrW || 928, nh: attrH || 622 };
  }

  function getHeroLogoTargetH(logoImg, mobile) {
    const { nh } = getLogoSourceSize(logoImg);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const maxSharpH = nh / dpr;
    const layoutTarget = Math.min(
      window.innerWidth * (mobile ? 0.72 : 0.5),
      window.innerHeight * (mobile ? 0.32 : 0.36),
      mobile ? 260 : 400
    );
    return Math.min(layoutTarget, maxSharpH);
  }

  function applyHeroLogoSize(logoImg, logoH) {
    if (!logoImg) return;
    const { nw, nh } = getLogoSourceSize(logoImg);
    const logoW = logoH * (nw / nh);
    logoImg.style.height = `${logoH}px`;
    logoImg.style.width = `${logoW}px`;
    logoImg.style.maxWidth = 'none';
    logoImg.style.maxHeight = 'none';
  }

  function resetHeroLogoSize(logoImg) {
    if (!logoImg) return;
    logoImg.style.removeProperty('height');
    logoImg.style.removeProperty('width');
    logoImg.style.removeProperty('max-width');
    logoImg.style.removeProperty('max-height');
  }

  const heroLogoImg = heroLogo?.querySelector('img');
  if (heroLogoImg) {
    const refreshHeroLogo = () => updateHeroIso();
    if (heroLogoImg.complete) {
      refreshHeroLogo();
    } else {
      heroLogoImg.addEventListener('load', refreshHeroLogo, { once: true });
    }
  }

  function updateHeroLogo(rise, foldP) {
    if (!heroLogo) return;

    const riseEased = easeSmooth(rise);
    const foldEased = easeSmooth(Math.min(foldP / 0.32, 1));
    const mobile = window.matchMedia('(max-width: 899px)').matches;
    const logoImg = heroLogo.querySelector('img');
    const startH = getHeroLogoStartH();
    const targetH = getHeroLogoTargetH(logoImg, mobile);
    const logoH = startH + (targetH - startH) * riseEased;
    const startY = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 72) / 2;
    const endY = window.innerHeight * (mobile ? 0.38 : 0.42);
    const y = startY + (endY - startY) * riseEased;
    const visible = rise > 0.012 ? 1 : 0;
    const opacity = visible * (1 - foldEased);
    const blur = foldEased * 22;

    if (logoImg) {
      applyHeroLogoSize(logoImg, logoH);
    }
    heroLogo.style.top = `${y}px`;
    heroLogo.style.transform = 'translate3d(-50%, -50%, 0)';
    heroLogo.style.opacity = String(opacity);
    heroLogo.style.filter = blur > 0.4 ? `blur(${blur}px)` : '';

    if (headerLogo) {
      const headerOut = Math.min(rise / 0.16, 1);
      const headerBack = foldP > 0.42
        ? easeSmooth(Math.min((foldP - 0.42) / 0.38, 1))
        : 0;
      const headerOpacity = Math.max(1 - headerOut, headerBack);
      headerLogo.style.opacity = String(headerOpacity);
      headerLogo.classList.toggle('is-away', headerOpacity < 0.12);
    }

    if (heroTrack) {
      const titleHide = easeSmooth(Math.min(rise * 1.25, 1));
      heroTrack.style.opacity = String(1 - titleHide);
      heroTrack.style.filter = titleHide > 0.35 ? `blur(${(titleHide - 0.35) * 14}px)` : '';
    }
  }

  function updateHeroIso() {
    if (!heroIso || !heroIsoFrame) return;

    if (reduceMotion) {
      heroActions?.style.setProperty('--hero-actions-rise', '0px');
      heroActions?.classList.add('is-ready');
      heroActions?.removeAttribute('aria-hidden');
      if (heroLogo) {
        heroLogo.style.opacity = '0';
        resetHeroLogoSize(heroLogo.querySelector('img'));
      }
      if (headerLogo) {
        headerLogo.style.opacity = '';
        headerLogo.classList.remove('is-away');
      }
      if (heroTrack) {
        heroTrack.style.opacity = '';
        heroTrack.style.filter = '';
      }
      return;
    }

    const travel = heroIso.offsetHeight - window.innerHeight;
    if (travel <= 0) return;
    const rect = heroIso.getBoundingClientRect();
    const scrolled = Math.min(Math.max(-rect.top, 0), travel);
    const foldTravel = window.innerHeight;
    const actionTravel = Math.max(travel - foldTravel, 1);

    let rise = 1;
    let foldP = 0;
    const riseTravel = Math.min(window.innerHeight * 0.48, actionTravel * 0.36);
    if (scrolled <= riseTravel) {
      rise = scrolled / Math.max(riseTravel, 1);
    } else if (scrolled <= actionTravel) {
      rise = 1;
    } else {
      foldP = Math.min((scrolled - actionTravel) / foldTravel, 1);
    }

    const startY = window.innerHeight * 0.72;
    const actionsReady = rise > 0.92;
    heroActions?.style.setProperty('--hero-actions-rise', `${(1 - easeSmooth(rise)) * startY}px`);
    heroActions?.classList.toggle('is-ready', actionsReady);
    heroActions?.toggleAttribute('aria-hidden', !actionsReady);

    updateHeroLogo(rise, foldP);

    const eased = easeSmooth(foldP);
    heroIsoFrame.style.transform = `rotateX(${eased * 92}deg) rotateZ(${eased * -4}deg)`;
    heroIsoFrame.style.pointerEvents = foldP > 0.45 ? 'none' : '';
    heroSticky?.classList.toggle('is-folded', foldP > 0.96);
  }

  /* ─── Parallax on tiles ─── */
  function updateParallax() {
    parallaxTiles.forEach((bg) => {
      const section = bg.closest('.tile');
      if (!section) return;

      const rect = section.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;

      const progress = (window.innerHeight - rect.top) / (window.innerHeight + rect.height);
      const offset = (progress - 0.5) * 60;
      bg.style.transform = `translateY(${offset}px) scale(1.06)`;
    });
  }

  /* ─── Reveal observer ─── */
  function initRevealObserver() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('is-visible');
        });
      },
      { threshold: 0.18, rootMargin: '0px 0px -50px 0px' }
    );

    revealElements.forEach((el) => observer.observe(el));
  }

  function isInViewport(el) {
    const rect = el.getBoundingClientRect();
    return rect.top < window.innerHeight * 0.9 && rect.bottom > 0;
  }

  /* ─── Mega menu ─── */
  function setStage(id) {
    stagePanels.forEach((panel) => {
      panel.classList.toggle('is-active', panel.dataset.stage === id);
    });
    previewLinks.forEach((link) => {
      link.classList.toggle('is-active', link.dataset.preview === id);
    });
  }

  function openNavItem(item) {
    navItems.forEach((el) => {
      const open = el === item;
      el.classList.toggle('is-open', open);
      el.querySelector('.mega-nav__trigger')?.setAttribute('aria-expanded', String(open));
    });
    if (item?.dataset.panel) setStage(item.dataset.panel);
  }

  function toggleMenu(open) {
    const isOpen = open ?? !megaMenu?.classList.contains('is-open');
    megaMenu?.classList.toggle('is-open', isOpen);
    menuToggle?.classList.toggle('is-open', isOpen);
    menuToggle?.setAttribute('aria-expanded', String(isOpen));
    megaMenu?.setAttribute('aria-hidden', String(!isOpen));
    document.body.classList.toggle('menu-open', isOpen);

    if (menuLabel) {
      menuLabel.textContent = isOpen
        ? (menuLabel.dataset.labelClose || 'Schließen')
        : (menuLabel.dataset.labelOpen || 'Menü');
    }
    menuToggle?.setAttribute('aria-label', isOpen ? 'Menü schließen' : 'Menü öffnen');
  }

  menuToggle?.addEventListener('click', () => toggleMenu());

  navItems.forEach((item) => {
    item.querySelector('.mega-nav__trigger')?.addEventListener('click', () => {
      if (item.classList.contains('is-open')) {
        setStage(item.dataset.panel);
        return;
      }
      openNavItem(item);
    });
  });

  previewLinks.forEach((link) => {
    const show = () => {
      if (link.dataset.preview) setStage(link.dataset.preview);
    };
    link.addEventListener('mouseenter', show);
    link.addEventListener('focus', show);
  });

  menuLinks.forEach((link) => {
    link.addEventListener('click', () => toggleMenu(false));
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') toggleMenu(false);
  });

  /* ─── Contact form ─── */
  const contactStatus = document.getElementById('contactStatus');
  const callDock = document.getElementById('callDock');

  function applyPublicContact(site) {
    if (site?.phoneHref) {
      document.querySelectorAll('.js-call').forEach((el) => {
        el.href = site.phoneHref;
        if (el.classList.contains('contact__direct') || el.closest('.contact__direct')) {
          el.textContent = site.phone;
        }
      });
      document.querySelectorAll('.contact__direct .js-call').forEach((el) => {
        el.textContent = site.phone;
      });
      if (callDock) {
        callDock.classList.add('is-on');
        callDock.removeAttribute('hidden');
        document.body.classList.add('has-call-dock');
      }
    }
    if (site?.mailHref) {
      document.querySelectorAll('.js-mail').forEach((el) => {
        el.href = site.mailHref;
        el.textContent = site.email;
      });
    }
  }

  function normalizeContact(raw) {
    const phone = String(raw?.phone || '').trim();
    const email = String(raw?.email || '').trim();
    return {
      phone,
      phoneHref: phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : '',
      email,
      mailHref: email ? `mailto:${email}` : '',
    };
  }

  let publicContact = normalizeContact(window.LACKDESIGN_SITE);
  applyPublicContact(publicContact);

  fetch('/api/site')
    .then((res) => (res.ok ? res.json() : null))
    .then((site) => {
      if (!site?.phoneHref && !site?.mailHref) return;
      publicContact = site;
      applyPublicContact(site);
    })
    .catch(() => {});

  function openMailClient(payload, serviceLabel) {
    if (!publicContact.email) return false;
    const body = [
      `Name: ${payload.name}`,
      `E-Mail: ${payload.email}`,
      `Telefon: ${payload.phone || '—'}`,
      `Leistung: ${serviceLabel}`,
      '',
      payload.message,
    ].join('\r\n');
    const query = `subject=${encodeURIComponent(`Anfrage über die Website – ${serviceLabel}`)}&body=${encodeURIComponent(body)}`;
    window.location.href = `mailto:${publicContact.email}?${query}`;
    return true;
  }

  contactForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = contactForm.querySelector('.btn-submit span');
    const original = btn?.textContent;
    const submitBtn = contactForm.querySelector('.btn-submit');
    if (contactStatus) {
      contactStatus.hidden = true;
      contactStatus.className = 'form-status';
    }
    if (submitBtn) submitBtn.disabled = true;
    if (btn) btn.textContent = 'Senden …';

    try {
      const payload = {
        name: contactForm.name.value,
        email: contactForm.email.value,
        phone: contactForm.phone?.value || '',
        service: contactForm.service.value,
        message: contactForm.message.value,
        company: contactForm.company?.value || '',
        privacy: Boolean(contactForm.privacy?.checked),
      };

      let res = null;
      try {
        res = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch {
        res = null;
      }

      // Auf statischem Hosting gibt es keinen Versand-Endpunkt. Dann uebergeben
      // wir die Anfrage an das E-Mail-Programm, statt Erfolg vorzutaeuschen.
      if (!res || res.status === 404 || res.status === 405) {
        const label = contactForm.service.selectedOptions[0]?.textContent || payload.service;
        if (!openMailClient(payload, label)) {
          throw new Error('Das Formular ist derzeit nicht aktiv. Bitte rufen Sie uns an.');
        }
        if (btn && original) btn.textContent = original;
        if (contactStatus) {
          contactStatus.hidden = false;
          contactStatus.className = 'form-status is-ok';
          contactStatus.textContent = 'Ihr E-Mail-Programm wurde mit der Anfrage geöffnet. Bitte schicken Sie die Nachricht dort ab.';
        }
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Senden fehlgeschlagen.');
      contactForm.reset();
      if (btn) btn.textContent = 'Gesendet ✓';
      if (contactStatus) {
        contactStatus.hidden = false;
        contactStatus.className = 'form-status is-ok';
        contactStatus.textContent = 'Danke. Wir haben Ihre Anfrage erhalten und senden Ihnen eine Bestätigung per E-Mail.';
      }
      setTimeout(() => {
        if (btn && original) btn.textContent = original;
      }, 3500);
    } catch (err) {
      if (btn && original) btn.textContent = original;
      if (contactStatus) {
        contactStatus.hidden = false;
        contactStatus.className = 'form-status is-err';
        contactStatus.textContent = err.message || 'Nachricht konnte nicht gesendet werden.';
      }
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  /* ─── Scroll handler ─── */
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      updateHeader();
      updateHeroIso();
      updateParallax();
      updatePromoFly();
      updatePageNav();
      ticking = false;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });

  /* ─── Promo fly-through ─── */
  const promoFly = document.querySelector('.promo--fly');
  const promoFlyCards = promoFly ? promoFly.querySelectorAll('.promo__flip') : [];

  function updatePromoFly() {
    if (!promoFly || !promoFlyCards.length || reduceMotion) return;
    const rect = promoFly.getBoundingClientRect();
    const view = window.innerHeight;
    const p = Math.min(1, Math.max(0, (view - rect.top) / (view * 0.72)));
    const eased = p * p * (3 - 2 * p);
    promoFlyCards.forEach((card, index) => {
      if (card.classList.contains('is-flipped')) {
        card.style.transform = '';
        return;
      }
      const delay = index * 0.1;
      const span = 1 - delay;
      const local = span <= 0 ? 1 : Math.min(1, Math.max(0, (eased - delay) / span));
      if (local >= 0.995) {
        card.style.transform = '';
        return;
      }
      const z = (1 - local) * -220;
      const y = (1 - local) * 48;
      const scale = 0.9 + local * 0.1;
      card.style.transform = `translate3d(0, ${y}px, ${z}px) scale(${scale})`;
    });
  }

  /* ─── Promo flip ─── */
  const promoFlipSetters = {};

  function bindPromoFlip(rootId, frontId, backId) {
    const root = document.getElementById(rootId);
    const front = document.getElementById(frontId);
    const back = document.getElementById(backId);
    if (!root || !front || !back) return;

    function setOpen(open) {
      root.classList.toggle('is-flipped', open);
      if (open) root.style.transform = '';
      front.setAttribute('aria-expanded', String(open));
    }

    promoFlipSetters[rootId] = setOpen;
    front.addEventListener('click', () => {
      setOpen(true);
      if (location.hash !== `#${rootId}`) {
        history.pushState({ promo: rootId }, '', `#${rootId}`);
      }
    });
    back.addEventListener('click', (event) => {
      if (event.target.closest('a')) return;
      setOpen(false);
      if (location.hash === `#${rootId}`) {
        history.pushState({ promo: null }, '', `${location.pathname}${location.search}`);
      }
    });
  }

  bindPromoFlip('keramikFlip', 'keramikFlipFront', 'keramikFlipBack');
  bindPromoFlip('sonderlackFlip', 'sonderlackFlipFront', 'sonderlackFlipBack');

  function syncPromoFromHash() {
    const id = window.location.hash.slice(1);
    Object.keys(promoFlipSetters).forEach((key) => {
      promoFlipSetters[key](key === id);
    });
  }

  function onHistoryChange() {
    syncPromoFromHash();
    const id = location.hash.slice(1);
    const target = id ? document.getElementById(id) : null;
    if (target) {
      const html = document.documentElement;
      const previous = html.style.scrollBehavior;
      html.style.scrollBehavior = 'auto';
      target.scrollIntoView({ behavior: 'auto', block: 'start' });
      html.style.scrollBehavior = previous;
    }
    updateHeader();
    updatePageNav();
  }

  window.addEventListener('hashchange', onHistoryChange);
  window.addEventListener('popstate', onHistoryChange);

  document.querySelectorAll('a[href="impressum.html"], a[href="datenschutz.html"]').forEach((link) => {
    link.addEventListener('click', savePlace);
  });
  window.addEventListener('pagehide', savePlace);
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) restorePlace();
    updateHeader();
    updatePageNav();
  });

  /* ─── Init ─── */
  function boot() {
    initHeroVideo();
    initRevealObserver();
    runIntro();
    updateHeader();
    updatePageNav();
    updateHeroIso();
    updatePromoFly();
    syncPromoFromHash();
  }

  // Hinter dem Zugangscode wartet der Seitenaufbau, sonst laeuft das Intro
  // unsichtbar ab und waere nach dem Entsperren schon vorbei.
  if (document.documentElement.classList.contains('is-locked')) {
    document.addEventListener('lackdesign:unlock', boot, { once: true });
  } else {
    boot();
  }
})();
