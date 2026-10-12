/* Scroll, carousel and motion controls. No commerce or API state lives here. */
(() => {
  'use strict';
  const main = document.getElementById('main');
  const header = document.querySelector('.site-header');
  if (!main || !header) return;
  const journeyLayer = document.getElementById('dx-journey-layer');
  const sceneHost = document.getElementById('dx-webgl');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  let paused = false;
  try { paused = sessionStorage.getItem('dx-motion') === 'paused'; } catch (_) {}
  let dispose = () => {};
  let initQueued = false;
  const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
  const lerp = (a, b, t) => a + (b - a) * t;

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
    const docks = [...main.querySelectorAll('[data-brand-dock]'), ...document.querySelectorAll('.site-footer [data-brand-dock]')];
    const protectedCopy = [...document.querySelectorAll('#main h1,#main h2,#main h3,#main h4,#main p,#main a,#main button,#main summary,#main label,#main small,#main span,#main b,#main strong,.site-header,.site-footer p,.site-footer a,.site-footer h2,.site-footer small')].filter(el => !el.closest('[data-brand-dock]'));
    const sticky = main.querySelector('.dx-purpose-sticky');
    const motion = main.querySelector('[data-dx-motion]');
    let observer;
    let resizeObserver;
    let frame = 0;
    let autoTimer = 0;
    let slide = 0;
    let heroVisible = Boolean(hero);
    let focusHeld = false;
    let gesture = null;
    let currentDock = null;
    let opacity = 0;
    let split = 1;
    let pendingDock = null;
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
      frame = 0;syncHeader();
      if (!home) {
        if (journeyLayer) journeyLayer.hidden = true;
        publish({home:false,visible:false,paused:true,reduced:reduced.matches});return;
      }
      const vh=innerHeight||800,vw=document.documentElement.clientWidth||innerWidth||1280;
      const homeRect=home.getBoundingClientRect();
      const progress=clamp(-homeRect.top/Math.max(1,Math.max(home.scrollHeight,homeRect.height,vh)-vh));
      home.style.setProperty('--dx-progress',String(progress));
      if(sticky)sticky.classList.toggle('dx-sticky-too-tall',sticky.getBoundingClientRect().height>vh-150);
      const visibleNow=hero.getBoundingClientRect().bottom>vh*.4;
      if(visibleNow!==heroVisible){heroVisible=visibleNow;scheduleAuto();}
      const topGuard=header.getAttribute('aria-hidden')==='true'?0:header.getBoundingClientRect().height+12;
      const copyRects=protectedCopy.flatMap(el=>{
        if(el.closest('[aria-hidden="true"],[inert]'))return [];
        const rects=[...el.getClientRects()].filter(box=>box.width>0&&box.height>0&&box.bottom>0&&box.top<vh);
        if(!rects.length)return [];
        const style=getComputedStyle(el);if(style.display==='none'||style.visibility==='hidden')return [];
        return rects;
      });
      function blocked(r){
        const safe={left:r.left+6,right:r.right-6,top:Math.max(topGuard,r.top+6),bottom:Math.min(vh,r.bottom-6)};
        return safe.bottom>safe.top&&copyRects.some(box=>box.left<safe.right+10&&box.right>safe.left-10&&box.top<safe.bottom+10&&box.bottom>safe.top-10);
      }
      const candidates=[];
      for(const dock of docks){
        const parentSlide=dock.closest('[data-slide]');
        if(parentSlide&&!parentSlide.classList.contains('is-active'))continue;
        const r=dock.getBoundingClientRect();
        if(r.width<8||r.height<8)continue;
        // Clip static placeholders and the stage too, including beneath the fixed header.
        dock.style.clipPath=`inset(${Math.max(0,topGuard-r.top).toFixed(2)}px 0 ${Math.max(0,r.bottom-vh).toFixed(2)}px 0)`;
        const visiblePixels=Math.max(0,Math.min(vh,r.bottom)-Math.max(topGuard,r.top));
        const collision=blocked(r);dock.classList.toggle('dx-dock-blocked',collision);
        const center=(r.top+r.bottom)/2;
        const localSplit=clamp((Math.abs(center-vh*.52)/Math.max(1,vh*.48)-.15)/.85);
        dock.style.setProperty('--dx-split',animated()?String(localSplit):'0');
        dock.style.setProperty('--dx-circuit-x',animated()?(Math.sin(progress*Math.PI*6)*5).toFixed(2)+'px':'0px');
        dock.style.setProperty('--dx-circuit-y',animated()?(Math.sin(progress*Math.PI*4)*7).toFixed(2)+'px':'0px');
        if(visiblePixels>16&&!collision)candidates.push({dock,r,localSplit,score:visiblePixels/r.height*2-Math.abs(center-vh*.52)/vh});
      }
      candidates.sort((a,b)=>b.score-a.score);
      const best=candidates[0]||null;
      const dt=Math.min(64,Math.max(1,lastFrame?time-lastFrame:16));lastFrame=time;
      const weight=1-Math.exp(-dt/65);
      const instant=!animated();
      if(best&&best.dock!==currentDock)pendingDock=best.dock;
      else pendingDock=null;
      if(pendingDock){
        opacity=instant?0:lerp(opacity,0,weight);
        split=instant?1:lerp(split,1,weight);
        const oldRect=currentDock?.getBoundingClientRect();
        const oldVisible=oldRect&&oldRect.bottom>topGuard&&oldRect.top<vh;
        if(!currentDock||!oldVisible||opacity<.035||instant){
          currentDock?.classList.remove('dx-dock-active');
          currentDock=pendingDock;pendingDock=null;
          currentDock.classList.add('dx-dock-active');
          if(journeyLayer)currentDock.append(journeyLayer);
          opacity=instant?1:0;split=instant?0:1;
        }
      }
      const current=candidates.find(c=>c.dock===currentDock);
      let collision=Boolean(currentDock?.classList.contains('dx-dock-blocked'));
      let visible=Boolean(current);
      if(current){
        const r=current.r;
        const safe={left:r.left+6,right:r.right-6,top:Math.max(topGuard,r.top+6),bottom:Math.min(vh,r.bottom-6)};
        // Fail closed: even custom font sizes or newly expanded copy cannot be painted over.
        collision=blocked(r);
        visible=visible&&!collision&&safe.bottom>safe.top;
        if(journeyLayer)journeyLayer.style.clipPath=`inset(${Math.max(0,topGuard-r.top).toFixed(2)}px 0 ${Math.max(0,r.bottom-vh).toFixed(2)}px 0)`;
        if(!pendingDock){
          opacity=instant?(visible?1:0):lerp(opacity,visible?1:0,weight);
          split=instant?0:lerp(split,current.localSplit,weight);
        }
      }
      if(collision)opacity=0;
      if(journeyLayer){journeyLayer.hidden=!visible;journeyLayer.style.opacity=String(opacity);}
      if(sceneHost){
        sceneHost.dataset.dock=currentDock?.dataset.brandId||'';
        sceneHost.dataset.collision=String(collision);
        sceneHost.style.setProperty('--dx-split',String(split));
        sceneHost.style.setProperty('--dx-logo-color',currentDock?.dataset.brandTone==='light'?'#153254':'#fbf7ef');
        sceneHost.style.setProperty('--dx-logo-accent',currentDock?.dataset.brandTone==='light'?'#bd550f':'#fa7c24');
        sceneHost.style.setProperty('--dx-logo-edge',currentDock?.dataset.brandTone==='light'?'#0c2035':'#c8b79b');
      }
      const chapter=currentDock?.closest('[data-scene]');
      const name=chapter?.dataset.scene||'hero';
      const status=home.querySelector('.dx-journey-status');
      if(status&&chapter){status.querySelector('b').textContent=chapter.dataset.chapter||'DasturXona';}
      publish({home:true,visible:visible&&opacity>.02,paused:!animated()||pageSuspended,reduced:reduced.matches,scene:name,shape:'logo',progress,slide,mobile:vw<=680,tone:currentDock?.dataset.brandTone||'dark',split});
      if(animated())parallax.forEach(el=>{
        const box=el.parentElement.getBoundingClientRect();if(box.bottom< -100||box.top>vh+100)return;
        const shift=clamp((vh*.5-(box.top+box.height*.5))/Math.max(vh,box.height),-.5,.5)*(vw<=680?20:45);
        el.style.setProperty('--dx-parallax',shift.toFixed(2)+'px');
      });
      else parallax.forEach(el=>el.style.setProperty('--dx-parallax','0px'));
      let currentValue=-1;values.forEach((el,i)=>{if(el.getBoundingClientRect().top<vh*.6)currentValue=i;});
      values.forEach((el,i)=>el.classList.toggle('is-current',i===Math.max(0,currentValue)));
      if(animated()&&!document.hidden&&!pageSuspended&&(pendingDock||(visible&&Math.abs(opacity-1)>.005)||(current&&Math.abs(split-current.localSplit)>.005)))requestUpdate();
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
      currentDock?.classList.remove('dx-dock-active');
      if(journeyLayer){journeyLayer.hidden=true;document.body.insertBefore(journeyLayer,main);}
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
