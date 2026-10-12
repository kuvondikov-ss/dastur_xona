/* Scroll, carousel and motion controls. No commerce or API state lives here. */
(() => {
  'use strict';
  const main = document.getElementById('main');
  const header = document.querySelector('.site-header');
  if (!main || !header) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  let paused = false;
  try { paused = sessionStorage.getItem('dx-motion') === 'paused'; } catch (_) {}
  let dispose = () => {};
  let initQueued = false;
  const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
  const lerp = (a, b, t) => a + (b - a) * t;
  const positions = {
    hero: [77, 43, 480, 1], world: [89, 67, 195, .82],
    merch: [91, 25, 155, .6], digital: [8, 76, 145, .62],
    purpose: [27, 67, 295, .92], makers: [91, 26, 155, .65],
    questions: [90, 44, 145, .55], finale: [81, 43, 360, .95]
  };
  const mobilePositions = {
    hero: [72, 68, 230, .96], world: [86, 78, 82, .52],
    merch: [87, 28, 78, .45], digital: [86, 78, 78, .45],
    purpose: [82, 75, 90, .5], makers: [86, 28, 78, .45],
    questions: [86, 72, 78, .42], finale: [80, 43, 115, .7]
  };

  function init() {
    dispose();
    const events = new AbortController();
    const home = main.querySelector('#dx-immersive-home');
    const homeRoute = Boolean(home) || ['', '#', '#/'].includes(location.hash);
    const hero = main.querySelector('.dx-cinema');
    const chapters = [...main.querySelectorAll('[data-scene]')];
    const slides = hero ? [...hero.querySelectorAll('[data-slide]')] : [];
    const tabs = hero ? [...hero.querySelectorAll('[data-dx-slide]')] : [];
    const parallax = [...main.querySelectorAll('[data-dx-parallax]')];
    const values = [...main.querySelectorAll('[data-value-step]')];
    const motion = main.querySelector('[data-dx-motion]');
    let observer;
    let resizeObserver;
    let frame = 0;
    let autoTimer = 0;
    let slide = 0;
    let heroVisible = Boolean(hero);
    let focusHeld = false;
    let gesture = null;
    let pose = null;
    let lastFrame = 0;
    let pageSuspended = false;
    let alive = true;
    document.documentElement.classList.toggle('dx-enter-home', homeRoute);
    document.body.classList.add('dx-motion-ready');
    document.body.classList.toggle('dx-document-hidden', document.hidden);
    if (!home) main.querySelectorAll('.page-top,.dx-bot-card,.detail-grid,.product-card,.news-card,.value-card').forEach(el => el.setAttribute('data-reveal', ''));

    function animated() { return !paused && !reduced.matches; }
    function syncMotion() {
      const off = !animated();
      document.body.classList.toggle('dx-motion-paused', off);
      if (motion) {
        const label = off ? 'Harakatni yoqish' : 'Harakatni to‘xtatish';
        motion.setAttribute('aria-label', label);
        motion.setAttribute('aria-pressed', String(off));
        motion.querySelector('.dx-motion-icon').textContent = off ? '▶' : 'Ⅱ';
        motion.querySelector('span:last-child').textContent = label;
        motion.disabled = reduced.matches;
        if (reduced.matches) motion.title = 'Qurilmada kamaytirilgan harakat tanlangan';
      }
      if (off) main.querySelectorAll('.dx-wait').forEach(el => el.classList.remove('dx-wait'));
      if (off) main.querySelectorAll('[data-dx-tilt]').forEach(el => {
        el.style.setProperty('--tilt-x', '0deg');el.style.setProperty('--tilt-y', '0deg');
      });
    }
    function scheduleAuto() {
      clearTimeout(autoTimer);
      const held = !animated() || !heroVisible || document.hidden || pageSuspended || focusHeld;
      if (hero) hero.classList.toggle('dx-carousel-held', held);
      if (!hero || slides.length < 2 || held) return;
      autoTimer = setTimeout(() => showSlide((slide + 1) % slides.length), 8000);
    }
    function showSlide(index) {
      if (!slides.length) return;
      slide = (index + slides.length) % slides.length;
      slides.forEach((el, i) => {
        const active = i === slide;
        el.classList.toggle('is-active', active);
        el.setAttribute('aria-hidden', String(!active));
        el.inert = !active;
        if (active) el.removeAttribute('inert'); else el.setAttribute('inert', '');
      });
      tabs.forEach((el, i) => {
        el.classList.toggle('is-active', i === slide);
        el.setAttribute('aria-pressed', String(i === slide));
      });
      document.body.dataset.dxSlide = String(slide);
      scheduleAuto();
      requestUpdate();
    }
    function syncHeader() {
      const visible = !homeRoute || window.scrollY > 80;
      document.documentElement.classList.toggle('dx-header-revealed', visible);
      header.inert = !visible;
      header.setAttribute('aria-hidden', String(!visible));
      if (visible) header.removeAttribute('inert'); else header.setAttribute('inert', '');
    }
    function publish(state) {
      window.dxSceneState = state;
      document.dispatchEvent(new CustomEvent('dx:scene-state', { detail: state }));
    }
    function update(time = performance.now()) {
      frame = 0;
      syncHeader();
      const host = document.getElementById('dx-webgl');
      const layer = document.getElementById('dx-journey-layer');
      if (!home) {
        if (host) host.style.setProperty('--dx-scene-opacity', '0');
        if (layer) layer.style.removeProperty('clip-path');
        publish({ home: false, visible: false, paused: true, reduced: reduced.matches });
        return;
      }
      const y = window.scrollY;
      const vh = innerHeight || 800;
      const vw = document.documentElement.clientWidth || innerWidth || 1280;
      const rect = home.getBoundingClientRect();
      const height = Math.max(home.scrollHeight, rect.height, vh);
      const progress = clamp(-rect.top / Math.max(1, height - vh));
      home.style.setProperty('--dx-progress', String(progress));
      const visibleNow = hero.getBoundingClientRect().bottom > vh * .4;
      if (visibleNow !== heroVisible) { heroVisible = visibleNow;scheduleAuto(); }

      const marks = chapters.map(el => ({ el, rect: el.getBoundingClientRect() }));
      let active = 0;
      marks.forEach((m, i) => { if (m.rect.top <= vh * .48) active = i; });
      const chapter = marks[active] ? marks[active].el : hero;
      const name = chapter.dataset.scene || 'hero';
      const status = home.querySelector('.dx-journey-status');
      if (status) {
        status.querySelector('span').textContent = String(active + 1).padStart(2, '0');
        status.querySelector('b').textContent = chapter.dataset.chapter;
      }
      // Both viewport sizes follow the same continuous path. Chapter labels never snap the pose.
      let previous = marks[0], next = marks[0];
      for (let i = 1; i < marks.length; i++) {
        const point = marks[i].rect.top + y - vh * .48;
        if (y < point) { next = marks[i];break; }
        previous = marks[i];next = marks[i];
      }
      const start = Math.max(0, previous.rect.top + y - vh * .48);
      const end = Math.max(start + 1, next.rect.top + y - vh * .48);
      const t = clamp((y - start) / (end - start));
      const ease = t * t * (3 - 2 * t);
      const track = vw <= 680 ? mobilePositions : positions;
      function at(mark) {
        const scene = mark.el.dataset.scene;
        const p = [...(track[scene] || track.hero)];
        if (scene === 'hero' && slide !== 0) {
          // Keep the brand visible and avoid covering the products in the campaign images.
          return vw <= 680 ? [86, 67, 95, .58] : slide === 1 ? [91, 74, 140, .6] : [90, 27, 145, .7];
        }
        if (vw > 680 && vw < 1100 && scene !== 'hero') { p[2] = Math.min(p[2], 130);p[3] = Math.min(p[3], .65); }
        return p;
      }
      const a = at(previous), b = at(next);
      const position = a.map((v, i) => lerp(v, b[i], ease));
      if (!animated() && name !== 'hero') position[3] = 0;
      const size = Math.min(position[2], vw * .6, Math.max(40, vh - 140));
      const half = size / 2 + 12;
      const top = Math.max(half, Math.min(100 + size / 2, vh / 2));
      const bottom = Math.max(top, Math.min(vh - half - 42, rect.bottom - half));
      const target = [
        clamp(position[0] / 100 * vw, half, Math.max(half, vw - half)),
        clamp(position[1] / 100 * vh, top, bottom),size,position[3]
      ];
      const dt = Math.min(64, Math.max(1, lastFrame ? time - lastFrame : 16));
      lastFrame = time;
      const weight = 1 - Math.exp(-dt / 75);
      pose = !pose || !animated() ? target : pose.map((v, i) => lerp(v, target[i], weight));
      // Keep the eased pose inside a viewport that can shrink during mobile scrolling.
      pose[2] = Math.min(pose[2], vw * .6, Math.max(40, vh - 140));
      const currentHalf = pose[2] / 2 + 12;
      pose[0] = clamp(pose[0], currentHalf, Math.max(currentHalf, vw - currentHalf));
      const currentTop = Math.max(currentHalf, Math.min(100 + pose[2] / 2, vh / 2));
      pose[1] = clamp(pose[1], currentTop, Math.max(currentTop, Math.min(vh - currentHalf - 42, rect.bottom - currentHalf)));
      const settling = pose.some((v, i) => Math.abs(v - target[i]) > (i === 3 ? .005 : .2));
      if (!settling) pose = target;
      if (host) {
        host.style.setProperty('--dx-scene-x', pose[0].toFixed(2) + 'px');
        host.style.setProperty('--dx-scene-y', pose[1].toFixed(2) + 'px');
        host.style.setProperty('--dx-scene-size', pose[2].toFixed(2) + 'px');
        host.style.setProperty('--dx-scene-opacity', String(pose[3]));
      }
      // Decorative geometry must not bleed into the header or the footer.
      if (layer) layer.style.clipPath = `inset(${Math.max(0, rect.top).toFixed(2)}px 0 ${Math.max(0, vh - rect.bottom).toFixed(2)}px 0)`;
      const visible = rect.bottom > 100 && rect.top < vh && pose[3] > .01;
      const state = { home: true, visible, paused: !animated() || pageSuspended, reduced: reduced.matches, scene: name, shape: 'logo', progress, slide, mobile: vw <= 680 };
      publish(state);
      if (animated()) {
        parallax.forEach(el => {
          const box = el.parentElement.getBoundingClientRect();
          if (box.bottom < -100 || box.top > vh + 100) return;
          const shift = clamp((vh * .5 - (box.top + box.height * .5)) / Math.max(vh, box.height), -.5, .5) * (vw <= 680 ? 26 : 65);
          el.style.setProperty('--dx-parallax', shift.toFixed(2) + 'px');
        });
      } else parallax.forEach(el => el.style.setProperty('--dx-parallax', '0px'));
      let currentValue = -1;
      values.forEach((el, i) => { if (el.getBoundingClientRect().top < vh * .6) currentValue = i; });
      values.forEach((el, i) => el.classList.toggle('is-current', i === Math.max(0, currentValue)));
      if (settling && !document.hidden && !pageSuspended) requestUpdate();
    }
    function requestUpdate() { if (!frame) frame = requestAnimationFrame(update); }
    function onScroll(event) {
      const link = event.target.closest('[data-dx-scroll]');
      if (!link) return;
      const id = link.getAttribute('href').slice(1);
      const target = document.getElementById(id);
      if (!target) return;
      event.preventDefault();
      const top = id === 'dx-top' ? 0 : target.getBoundingClientRect().top + window.scrollY - 82;
      window.scrollTo({ top: Math.max(0, top), behavior: animated() ? 'smooth' : 'instant' });
    }
    main.addEventListener('click', onScroll, { signal: events.signal });
    window.addEventListener('scroll', requestUpdate, { passive: true, signal: events.signal });
    window.addEventListener('resize', requestUpdate, { passive: true, signal: events.signal });
    function syncVisibility() {
      document.body.classList.toggle('dx-document-hidden', document.hidden || pageSuspended);
      lastFrame = 0;scheduleAuto();requestUpdate();
    }
    document.addEventListener('visibilitychange', syncVisibility, { signal: events.signal });
    window.addEventListener('pagehide', () => { pageSuspended = true;syncVisibility(); }, { signal: events.signal });
    window.addEventListener('pageshow', () => { pageSuspended = false;syncVisibility(); }, { signal: events.signal });
    if (home && 'ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(requestUpdate);resizeObserver.observe(home);
    }
    main.addEventListener('load', requestUpdate, { capture: true, signal: events.signal });
    if (document.fonts) document.fonts.ready.then(() => { if (alive) requestUpdate(); });
    if (motion) motion.addEventListener('click', () => {
      paused = !paused;
      try { sessionStorage.setItem('dx-motion', paused ? 'paused' : 'running'); } catch (_) {}
      syncMotion();scheduleAuto();requestUpdate();
    }, { signal: events.signal });
    if (hero) {
      tabs.forEach(el => el.addEventListener('click', () => showSlide(Number(el.dataset.dxSlide)), { signal: events.signal }));
      hero.querySelector('[data-dx-prev]').addEventListener('click', () => showSlide(slide - 1), { signal: events.signal });
      hero.querySelector('[data-dx-next]').addEventListener('click', () => showSlide(slide + 1), { signal: events.signal });
      hero.addEventListener('keydown', event => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          event.preventDefault();showSlide(slide + (event.key === 'ArrowRight' ? 1 : -1));
        }
      }, { signal: events.signal });
      hero.addEventListener('focusin', () => { focusHeld = true;scheduleAuto(); }, { signal: events.signal });
      hero.addEventListener('focusout', event => { focusHeld = hero.contains(event.relatedTarget);scheduleAuto(); }, { signal: events.signal });
      hero.addEventListener('pointerdown', event => { if (event.pointerType !== 'mouse') gesture = [event.clientX, event.clientY]; }, { passive: true, signal: events.signal });
      hero.addEventListener('pointerup', event => {
        if (!gesture) return;
        const dx = event.clientX - gesture[0], dy = event.clientY - gesture[1];gesture = null;
        if (Math.abs(dx) > 60 && Math.abs(dy) < 45) showSlide(slide + (dx < 0 ? 1 : -1));
      }, { passive: true, signal: events.signal });
      hero.addEventListener('pointercancel', () => { gesture = null; }, { signal: events.signal });
      showSlide(0);
    }
    main.querySelectorAll('[data-dx-tilt]').forEach(card => {
      card.addEventListener('pointermove', event => {
        if (!animated() || !fine.matches) return;
        const box = card.getBoundingClientRect();
        card.style.setProperty('--tilt-x', -((event.clientY - box.top) / Math.max(1, box.height) - .5) * 8 + 'deg');
        card.style.setProperty('--tilt-y', ((event.clientX - box.left) / Math.max(1, box.width) - .5) * 8 + 'deg');
      }, { signal: events.signal });
      card.addEventListener('pointerleave', () => { card.style.setProperty('--tilt-x', '0deg');card.style.setProperty('--tilt-y', '0deg'); }, { signal: events.signal });
    });
    if ('IntersectionObserver' in window && animated()) {
      observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.remove('dx-wait');
          observer.unobserve(entry.target);
        });
      }, { threshold: .07, rootMargin: '0px 0px 70px 0px' });
      main.querySelectorAll('[data-reveal]').forEach(el => {
        if (el.getBoundingClientRect().top > innerHeight) { el.classList.add('dx-wait');observer.observe(el); }
      });
    }
    syncMotion();
    update();
    dispose = () => {
      alive = false;
      events.abort();clearTimeout(autoTimer);
      if (frame) cancelAnimationFrame(frame);
      if (observer) observer.disconnect();
      if (resizeObserver) resizeObserver.disconnect();
    };
  }
  new MutationObserver(() => {
    if (initQueued) return;
    initQueued = true;
    requestAnimationFrame(() => { initQueued = false;init(); });
  }).observe(main, { childList: true });
  reduced.addEventListener('change', init);
  init();
})();
