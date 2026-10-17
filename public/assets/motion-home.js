'use strict';
(() => {
  let cleanup = () => {};
  const clamp = (n, min = 0, max = 1) => Math.max(min, Math.min(max, n));
  const symbols = () => `<svg class="motion-symbols" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><defs>
    <linearGradient id="cloth" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#345371"/><stop offset=".48" stop-color="#153254"/><stop offset="1" stop-color="#081b32"/></linearGradient>
    <linearGradient id="sleeve" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#0c213a"/><stop offset=".52" stop-color="#294866"/><stop offset="1" stop-color="#112c48"/></linearGradient>
    <linearGradient id="ceramic" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#c7bba5"/><stop offset=".25" stop-color="#faf5e7"/><stop offset=".65" stop-color="#fffdf4"/><stop offset="1" stop-color="#d4c9b5"/></linearGradient>
    <linearGradient id="canvas" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff7e4"/><stop offset=".55" stop-color="#e6d5b5"/><stop offset="1" stop-color="#bcaa89"/></linearGradient>
    <linearGradient id="hood" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#365574"/><stop offset=".5" stop-color="#0b2038"/><stop offset="1" stop-color="#203d58"/></linearGradient>
    <symbol id="motion-model-hoodie" viewBox="0 0 600 620">
      <path d="M209 146 137 163 58 361 119 386 188 250 174 519Q300 548 425 519L411 250 481 386 542 361 464 163 391 146Z" fill="url(#sleeve)" stroke="#0b233b" stroke-width="3"/>
      <path d="m137 163 76-20 175 1 76 19-51 86 14 263q-130 34-254 0l14-263Z" fill="url(#cloth)"/>
      <path d="M208 152Q178 93 222 58q77-45 154 0 43 35 12 94L300 197Z" fill="url(#hood)" stroke="#42607b" stroke-width="2"/>
      <path d="M221 145Q211 89 249 77q52-19 103 0 36 17 23 69l-74 37Z" fill="#091e34"/>
      <path d="m209 148 83 46-33-52m131 6-82 46 33-52" fill="none" stroke="#57718a" stroke-width="3"/>
      <path d="m272 184-7 112m62-112 8 112" stroke="#ddc9a7" stroke-width="3" stroke-linecap="round"/><path d="m263 288 4 14m66-14 4 14" stroke="#c78445" stroke-width="5"/>
      <path d="m222 373-19 86q96 23 193 0l-19-86-43-8h-69Z" fill="#17334f" stroke="#3a5570" stroke-width="2"/>
      <path d="m221 379 37 19m120-19-38 19m-156 91q115 22 231 0" stroke="#0b223b" stroke-width="3" fill="none"/>
      <path d="m177 501-2 20q129 35 252-1l-2-19q-125 27-248 0" fill="#102a43"/>
      <path d="m58 361-6 17 61 27 7-20m422-24 7 17-61 27-8-20" fill="#0d253e"/>
      <path d="m157 198-49 134m335-134 49 134M194 278l-7 194m219-194 6 194" stroke="#7d91a2" stroke-opacity=".17" stroke-width="3"/>
      <image href="/assets/brand-mark.svg" x="309" y="239" width="63" height="61" class="garment-mark"/>
      <text x="299" y="345" fill="#e9dfca" text-anchor="middle" font-family="Montserrat,Arial,sans-serif" font-weight="600" font-size="17" letter-spacing="4">DASTUR XONA</text>
    </symbol>
    <symbol id="motion-model-mug" viewBox="0 0 600 620">
      <path d="M406 190h37c141 0 133 232-7 232h-37v-57h33c66 0 72-117 3-117h-30Z" fill="url(#ceramic)" stroke="#c8baa2" stroke-width="4"/>
      <path d="m132 161 10 298c6 64 267 69 275 0l10-298Z" fill="url(#ceramic)"/>
      <ellipse cx="280" cy="162" rx="148" ry="51" fill="#f9f2e2" stroke="#cfc2aa" stroke-width="4"/>
      <ellipse cx="280" cy="164" rx="128" ry="36" fill="#153254"/><ellipse cx="280" cy="169" rx="119" ry="26" fill="#0a213a"/>
      <path d="M146 447q127 54 267 0" stroke="#b5a58b" stroke-width="3" fill="none" opacity=".55"/>
      <path d="m163 216 7 207" stroke="#fffdf6" stroke-width="13" stroke-linecap="round" opacity=".48"/>
      <image href="/assets/brand-mark.svg" x="208" y="259" width="140" height="132"/>
      <text x="278" y="420" text-anchor="middle" fill="#153254" font-family="Montserrat,Arial,sans-serif" font-size="12" letter-spacing="3">MILLIY RUH.</text>
    </symbol>
    <symbol id="motion-model-tote" viewBox="0 0 600 620">
      <path d="M210 234V133c0-100 171-100 171 0v101" stroke="#b6a585" stroke-width="26" fill="none"/>
      <path d="M200 230V131c0-98 171-98 171 0v99" stroke="#efdfbd" stroke-width="22" fill="none"/>
      <path d="m137 199 318 0 30 321q-185 34-370 0Z" fill="url(#canvas)" stroke="#c7b38d" stroke-width="3"/>
      <path d="m143 205 13 291-34 21m327-312-9 292 39 20" fill="none" stroke="#b6a381" stroke-width="3"/>
      <path d="M158 225h275M141 507q153 25 318 0" stroke="#c9b895" stroke-width="2" stroke-dasharray="4 5" fill="none"/>
      <path d="m201 204 2 47m167-47-2 47" stroke="#dac8a5" stroke-width="24"/>
      <image href="/assets/brand-mark.svg" x="212" y="285" width="170" height="158"/>
      <text x="297" y="475" text-anchor="middle" fill="#153254" font-family="Montserrat,Arial,sans-serif" font-weight="600" font-size="15" letter-spacing="3">G‘OYALARNI OLIB YURING.</text>
    </symbol>
  </defs></svg>`;
  function render({products, projects, banners, news, card, newsPreview, faq, esc, icon, imageSrc, safeLink}) {
    const defaults = [
      {title:'Milliy ruh.\nYangi ifoda.',subtitle:'Dasturxona / Merch va suvenirlar',description:'Milliy naqshlar. Kundalik buyumlar. O‘zingizga yaqin bir olam.',image:'/assets/merch-campaign-v2.webp',link:'#/dokon',label:'Do‘konni ko‘rish'},
      {title:'G‘oyalar\njonlanadigan joy.',subtitle:'Dasturxona / IT · Dizayn · Media',description:'Birga o‘rganamiz. Birga yaratamiz. Bilimni amaliy mahsulotga aylantiramiz.',image:'/assets/creative-atelier-v2.webp',link:'#/it-proyektlar',label:'Loyihalarni ko‘rish'},
      {title:'Bir jamoa.\nKo‘p imkoniyat.',subtitle:'Dasturxona / Hamjamiyat',description:'Yangiliklar, yangi g‘oyalar va jamoamiz hayotini kuzatib boring.',image:'/assets/heritage-stage-v2.webp',link:'https://t.me/dastur_xona',label:'Telegram kanalimiz'}
    ];
    const slides = (banners.length ? banners : [...news.map(n=>({title:n.title,subtitle:'Dasturxona / Yangiliklar',description:n.excerpt,image:n.cover,link:'#/yangilik/'+encodeURIComponent(n.slug),label:'Yangilikni o‘qish'})),...defaults]).slice(0,15);
    const featured = [...products.filter(p=>p.category==='merch').slice(0,2),...products.filter(p=>p.category==='souvenir').slice(0,2)];
    for(const p of products)if(featured.length<4&&!featured.includes(p))featured.push(p);
    const findProduct = (pattern,category) => products.find(p=>pattern.test(p.id+' '+p.name)) || products.find(p=>p.category===category);
    const models = [
      {id:'hoodie',label:'Kiyim',title:'Naqsh\njonlanadi.',text:'Milliy ildizlar. Zamonaviy ifoda. O‘zingizni kundalik uslubingizda namoyon eting.',product:findProduct(/hudi|hoodie/i,'merch'),note:'01 — Kiying. His qiling.'},
      {id:'mug',label:'Suvenir',title:'Har kuni.\nO‘zingiz bilan.',text:'Ish stolingizda, ilk qahvangizda va yangi g‘oyalaringiz yonida — Dasturxona ruhi.',product:findProduct(/krujka|mug/i,'souvenir'),note:'02 — Kichik buyum. Katta ma’no.'},
      {id:'tote',label:'Aksessuar',title:'G‘oyalarni\nolib yuring.',text:'Darsdan ishga. Uchrashuvdan yangi loyihaga. Siz bilan birga yuradigan milliy ruh.',product:findProduct(/tote|sumka/i,'merch'),note:'03 — Harakatdagi g‘oyalar.'}
    ];
    const productUrl=p=>p?'#/mahsulot/'+encodeURIComponent(p.id):'#/dokon';
    const modelSvg=(id,cls='')=>`<svg class="merch-model ${cls}" viewBox="0 0 600 620" aria-hidden="true"><use href="#motion-model-${id}"/></svg>`;
    return `<div class="home-page motion-homepage">${symbols()}
      <section class="home-hero motion-hero" aria-label="Dasturxona yangiliklari" aria-roledescription="karusel" data-motion-hero>
        <div class="motion-hero-brand"><a href="#/" aria-label="Dasturxona — bosh sahifa"><img src="/assets/wordmark.svg" width="226" height="50" alt="DASTUR XONA"></a><span>Milliy ruh. Raqamli g‘oya.</span></div>
        <div class="motion-slides">${slides.map((s,i)=>{
          const href=safeLink(s.link,'#/dokon'), external=/^https?:/.test(href);
          return `<article class="motion-slide${i===0?' is-active':''}" data-slide="${i}" role="group" aria-roledescription="slayd" aria-label="${i+1} / ${slides.length}" ${i?'hidden inert':''}>
            <img class="motion-slide-image" src="${esc(imageSrc(s.image||defaults[i%3].image))}" width="1672" height="941" alt="" ${i?'loading="lazy"':'fetchpriority="high"'} decoding="async">
            <div class="motion-slide-shade"></div><div class="container motion-slide-copy${String(s.title||'').length>48?' motion-title-long':''}"><span class="motion-kicker">${esc(s.subtitle||'Dasturxona / Yangiliklar')}</span><${i?'h2':'h1'}${i?'':' id="home-title"'}>${esc(s.title||'Dasturxona').replace(/\n/g,'<br>')}</${i?'h2':'h1'}><p>${esc(s.description||'')}</p><a class="motion-hero-link" href="${esc(href)}" ${external?'target="_blank" rel="noopener noreferrer"':''}>${esc(s.label||'Batafsil')}<span>${icon('arrow')}</span></a></div>
          </article>`;
        }).join('')}</div>
        <div class="container motion-hero-bottom"><div class="motion-slide-select" role="group" aria-label="Slaydni tanlash">${slides.map((s,i)=>`<button type="button" data-slide-to="${i}" aria-label="${i+1}-slayd: ${esc(s.title)}" aria-pressed="${i===0}"><span>${String(i+1).padStart(2,'0')}</span><i></i></button>`).join('')}</div><div class="motion-slide-actions"><button type="button" data-slide-prev aria-label="Oldingi slayd">${icon('arrow')}</button><button type="button" data-slide-pause aria-label="Slaydlar almashishini to‘xtatish" aria-pressed="false">${icon('minus')}</button><button type="button" data-slide-next aria-label="Keyingi slayd">${icon('arrow')}</button></div></div>
        <button class="motion-scroll-cue" type="button" data-scroll-target="motion-merch">Kashf etish uchun suring<span>↓</span></button><span class="sr-only" data-slide-status role="status" aria-live="polite"></span>
      </section>
      <section class="motion-merch-track" id="motion-merch" aria-label="Merch va suvenirlar: naqsh jonlanadi" data-motion-track>
        <div class="motion-merch-pin" data-merch-pin><div class="container motion-chapter-line"><span>01 / MERCH VA SUVENIRLAR</span><span>Naqshdan — kundalik hayotga</span></div>
          <div class="motion-pattern" aria-hidden="true"><img src="/assets/brand-mark.svg" width="980" height="854" alt=""></div>
          <div class="container motion-beats">${models.map((m,i)=>`<article class="motion-beat${i===0?' is-active':''}" data-merch-step="${i}"><div class="motion-beat-copy"><span class="motion-kicker">${esc(m.note)}</span><h2>${esc(m.title).replace(/\n/g,'<br>')}</h2><p>${esc(m.text)}</p><a class="motion-product-link" href="${productUrl(m.product)}"><span>${esc(m.product?.name.replace(/^Dasturxona\s*[—–-]\s*/i,'')||m.label)}<small>${m.product?'Mahsulot bilan tanishing':'Do‘konni ko‘rish'}</small></span>${icon('arrow')}</a></div><div class="motion-object motion-object-${m.id}">${modelSvg(m.id)}<span class="motion-object-caption">DASTURXONA / ${esc(m.label.toUpperCase())}</span></div></article>`).join('')}</div>
          <div class="container motion-merch-bottom"><div class="motion-chapter-tabs" role="group" aria-label="Kolleksiya bo‘limini tanlash">${models.map((m,i)=>`<button type="button" data-merch-to="${i}" aria-pressed="${i===0}"><b>${String(i+1).padStart(2,'0')}</b>${esc(m.label)}<i></i></button>`).join('')}</div><span class="motion-merch-hint">Davom eting <span>↓</span></span></div>
        </div>
      </section>
      <section class="motion-collection"><div class="container"><div class="motion-collection-heading" data-motion-reveal><div><span class="motion-kicker">Bitta ruh. Turli ifodalar.</span><h2>O‘zingizga<br>yaqinini toping.</h2></div><a class="motion-round-link" href="#/dokon">Do‘konga<br>o‘tish ${icon('arrow')}</a></div>${featured.length?`<div class="product-grid motion-products" data-motion-reveal>${featured.map(p=>card(p,true)).join('')}</div>`:'<p class="note-box">Yangi kolleksiya tayyorlanmoqda. Yangiliklarni kuzatib boring.</p>'}
        <nav class="quick-links motion-quick-links" aria-label="Tezkor yo‘nalishlar"><a href="#/dokon?tur=merch">${icon('shirt')}<span><b>Merch</b><small>Kiyim va aksessuarlar</small></span>${icon('arrow')}</a><a href="#/dokon?tur=souvenir">${icon('gift')}<span><b>Suvenirlar</b><small>Kundalik hayotingizga milliy ruh</small></span>${icon('arrow')}</a><a href="https://t.me/dasturxona_bot" target="_blank" rel="noopener noreferrer">${icon('telegram')}<span><b>Telegram Mini App</b><small>Stars, Premium va o‘yinlar</small></span>${icon('arrow')}</a></nav>
      </div></section>
      <section class="motion-digital-track" data-digital-track aria-labelledby="motion-digital-title"><div class="motion-digital-pin"><div class="container motion-chapter-line"><span>02 / IT LOYIHALAR</span><span>G‘oyadan — mahsulotgacha</span></div><div class="container motion-digital-grid"><div class="motion-digital-copy"><span class="motion-kicker">Milliy ildizlar. Raqamli kelajak.</span><h2 id="motion-digital-title">G‘oyalar<br><em>chegara bilmaydi.</em></h2><p>Dasturxona — mahsulotlar ortidagi g‘oyalar ham. Telegram xizmatlaridan veb-loyihalargacha, bilimni amaliyotga aylantiramiz.</p><div class="motion-project-links">${projects.slice(0,4).map(p=>`<a href="#/loyiha/${encodeURIComponent(p.id)}"><span>${esc(p.name)}<small>${esc(p.id==='dasturxona-bot'?'Stars · Premium · O‘yinlar':p.subtitle||'IT loyiha')}</small></span>${icon('arrow')}</a>`).join('')}</div><a class="motion-light-link" href="#/it-proyektlar">Barcha IT loyihalar ${icon('arrow')}</a></div><div class="motion-digital-stage" aria-hidden="true"><svg class="motion-digital-circuit" viewBox="0 0 600 600"><path d="M20 390h95l85-85h200l85-85h95"/><circle cx="20" cy="390" r="9"/><circle cx="580" cy="220" r="9"/></svg><div class="motion-emblem"><img src="/assets/brand-mark.svg" alt="" width="980" height="854"><img src="/assets/brand-mark.svg" alt="" width="980" height="854"></div><div class="motion-phone"><div class="motion-phone-notch"></div><div class="motion-phone-screen"><span>TELEGRAM MINI APP</span><img src="/assets/wordmark.svg" alt="" width="226" height="50"><h3>Bir joyda.<br>Ko‘p imkoniyat.</h3><div class="motion-phone-services"><div>✦<b>Stars</b></div><div>★<b>Premium</b></div><div>↗<b>O‘yinlar</b></div><div>＋<b>Referal</b></div></div><div class="motion-phone-foot">DASTURXONA BOT ${icon('arrow')}</div></div></div><div class="motion-browser"><div class="motion-browser-bar"><i></i><i></i><i></i><span>dasturxona.uz</span></div><div class="motion-browser-screen"><img src="/assets/wordmark.svg" class="motion-browser-logo" alt="" width="226" height="50"><h3>Milliy ruh.<br>Yangi ifoda.</h3><div class="motion-browser-products">${['hoodie','mug','tote'].map(id=>modelSvg(id)).join('')}</div><span>G‘oyalar uchun yangi makon. ${icon('arrow')}</span></div></div></div></div><div class="container motion-digital-bottom"><span>01 / G‘oya</span><i></i><span>02 / Yechim</span><i></i><span>03 / Mahsulot</span></div></div></section>
      <section class="motion-team"><div class="container motion-team-grid"><figure data-motion-reveal><img src="/assets/creative-atelier-v2.webp" width="1672" height="941" alt="Dasturxona: IT, dizayn va media yo‘nalishlarining brend kompozitsiyasi" loading="lazy"><figcaption>IT / DIZAYN / MEDIA</figcaption></figure><div data-motion-reveal><span class="motion-kicker">03 / Mahsulot ortidagi jamoa</span><h2>O‘rganamiz.<br>Yaratamiz.<br><em>Birga o‘samiz.</em></h2><p>Har bir mahsulot — sinab ko‘rish, yangi bilim va birgalikdagi mehnat natijasi. Bizni birlashtiradigan narsa — yaratishga bo‘lgan qiziqish.</p><a class="text-link" href="#/biz-haqimizda">Jamoamiz bilan tanishing ${icon('arrow')}</a></div></div></section>
      ${news.length?`<section class="motion-home-news"><div class="container" data-motion-reveal>${newsPreview()}</div></section>`:''}
      <section class="container section faq-layout motion-faq"><div data-motion-reveal><span class="motion-kicker">Xariddan oldin</span><h2>Savollaringizga<br>javoblar.</h2><p>Buyurtma, yetkazish va jamoamiz haqida.</p><a class="text-link" href="#/malumot/tolov">Buyurtma tartibi ${icon('arrow')}</a></div><div data-motion-reveal>${faq()}</div></section>
      <section class="motion-finale" aria-labelledby="motion-finale-title"><div class="container"><span class="motion-kicker">Milliy ruh. Raqamli g‘oya.</span><div class="motion-finale-heading"><h2 id="motion-finale-title">Birga<br><em>yaratamiz.</em></h2><div class="motion-finale-mark" aria-hidden="true"><svg viewBox="0 0 400 200"><path d="M18 100h75l42-42h130l42 42h75"/><circle cx="18" cy="100" r="9"/><circle cx="382" cy="100" r="9"/></svg><img src="/assets/brand-mark.svg" width="980" height="854" alt=""></div></div><div class="motion-finale-bottom"><p>Yangi mahsulotlar, jamoa hayoti va keyingi g‘oyalar — kanalimizda.</p><a href="https://t.me/dastur_xona" target="_blank" rel="noopener noreferrer">Telegram kanalimiz ${icon('arrow')}</a><button type="button" data-scroll-target="top" aria-label="Sahifa boshiga qaytish">↑</button></div></div></section>
      <button class="motion-toggle" type="button" data-motion-toggle aria-pressed="false" aria-label="Animatsiyani to‘xtatish"><span data-motion-toggle-icon>Ⅱ</span><span data-motion-toggle-text>Harakatni to‘xtatish</span></button>
    </div>`;
  }
  function destroy() { cleanup(); cleanup = () => {}; }
  function init() {
    destroy();
    const root = document.querySelector('.motion-homepage');
    if(!root)return;
    const body = document.body, header = document.querySelector('.site-header');
    const hero = root.querySelector('[data-motion-hero]'), track = root.querySelector('[data-motion-track]'), digital = root.querySelector('[data-digital-track]');
    const slides = [...root.querySelectorAll('[data-slide]')], slideButtons = [...root.querySelectorAll('[data-slide-to]')];
    const beats = [...root.querySelectorAll('[data-merch-step]')], tabs = [...root.querySelectorAll('[data-merch-to]')];
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const removers = [];
    const listen = (target,type,fn,opts) => {target.addEventListener(type,fn,opts);removers.push(()=>target.removeEventListener(type,fn,opts));};
    let paused = false, slidePaused = false, hovered = false, focused = false, heroVisible = true;
    let slideIndex = 0, beatIndex = -1, timer = 0, frame = 0, pointer = null, dead = false;
    try { paused = localStorage.getItem('dasturxona-motion-paused') === 'true'; } catch {}
    let reduced = Boolean(media?.matches);
    body.classList.add('motion-home','motion-ready');
    function schedule() { if(!frame&&!dead&&!document.hidden)frame=requestAnimationFrame(paint); }
    function stopTimer() { clearTimeout(timer); timer = 0; }
    function planSlide() {
      stopTimer();
      const stopped = paused||slidePaused||reduced||hovered||focused||document.hidden||!heroVisible||slides.length<2;
      hero.classList.toggle('slider-paused',stopped);
      const button=root.querySelector('[data-slide-pause]');
      button.setAttribute('aria-pressed',String(paused||slidePaused||reduced));
      button.setAttribute('aria-label',slidePaused?'Slaydlar almashishini davom ettirish':'Slaydlar almashishini to‘xtatish');
      button.hidden=reduced||slides.length<2;button.disabled=paused;
      button.innerHTML=paused||slidePaused||reduced?'▶':'Ⅱ';
      if(!stopped)timer=setTimeout(()=>setSlide(slideIndex+1),7000);
    }
    function setSlide(index, announce=false) {
      if(!slides.length)return;
      slideIndex=(index+slides.length)%slides.length;
      slides.forEach((s,i)=>{s.hidden=i!==slideIndex;s.inert=i!==slideIndex;s.classList.toggle('is-active',i===slideIndex);});
      slideButtons.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===slideIndex)));
      const rail=root.querySelector('.motion-slide-select'),activeButton=slideButtons[slideIndex];
      if(rail.scrollTo)rail.scrollTo({left:activeButton.offsetLeft-rail.offsetLeft,behavior:'instant'});
      if(announce)root.querySelector('[data-slide-status]').textContent=`${slideIndex+1} / ${slides.length}: ${slides[slideIndex].querySelector('h1,h2').textContent}`;
      planSlide();
    }
    function selectBeat(index) {
      if(index===beatIndex)return;beatIndex=index;
      beats.forEach((b,i)=>{b.classList.toggle('is-active',i===index);if(!reduced){b.setAttribute('aria-hidden',String(i!==index));b.inert=i!==index;}else{b.removeAttribute('aria-hidden');b.inert=false;}});
      tabs.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));
      root.querySelector('[data-merch-pin]').classList.toggle('is-dark',index===1);
    }
    function paint() {
      frame=0;if(dead)return;
      const height=window.innerHeight||800;
      const heroRect=hero.getBoundingClientRect();
      const wasVisible=heroVisible;heroVisible=heroRect.bottom>0&&heroRect.top<height;
      if(wasVisible!==heroVisible)planSlide();
      const showHeader=heroRect.bottom<=1;
      body.classList.toggle('motion-header-visible',showHeader);header.inert=!showHeader;
      header.setAttribute('aria-hidden',String(!showHeader));
      const rect=track.getBoundingClientRect(), distance=Math.max(1,track.offsetHeight-height);
      const progress=clamp(-rect.top/distance), index=Math.min(2,Math.floor(progress*3));
      if(!reduced)selectBeat(index);
      track.style.setProperty('--merch-progress',progress.toFixed(4));
      track.style.setProperty('--pattern-turn',`${paused||reduced?0:progress*110}deg`);
      track.style.setProperty('--object-turn',`${paused||reduced?0:Math.sin(progress*Math.PI*4)*12}deg`);
      track.style.setProperty('--object-rise',`${paused||reduced?0:Math.sin(progress*Math.PI*6)*-18}px`);
      const dRect=digital.getBoundingClientRect(),dp=clamp(-dRect.top/Math.max(1,digital.offsetHeight-height));
      body.classList.toggle('motion-in-scene',(rect.top<=1&&rect.bottom>=height-1)||(dRect.top<=1&&dRect.bottom>=height-1));
      digital.style.setProperty('--digital-progress',dp.toFixed(4));
      digital.style.setProperty('--emblem-opacity',String(1-clamp(dp*3)));
      digital.style.setProperty('--phone-opacity',String(clamp((dp-.05)*4)*(1-clamp((dp-.68)*5))));
      digital.style.setProperty('--browser-opacity',String(clamp((dp-.5)*3)));
      digital.style.setProperty('--phone-x',`${paused||reduced?0:(1-clamp(dp*3))*85}px`);
      digital.style.setProperty('--browser-y',`${paused||reduced?0:(1-clamp((dp-.5)*3))*100}px`);
      digital.style.setProperty('--device-turn',`${paused||reduced?0:-13+dp*19}deg`);
    }
    function syncMotion() {
      body.classList.toggle('motion-reduced',reduced);body.classList.toggle('motion-paused',paused||reduced);
      const button=root.querySelector('[data-motion-toggle]');
      button.setAttribute('aria-pressed',String(paused));
      button.setAttribute('aria-label',paused?'Animatsiyani davom ettirish':'Animatsiyani to‘xtatish');
      button.title=paused?'Harakatni davom ettirish':'Harakatni to‘xtatish';
      button.querySelector('[data-motion-toggle-icon]').textContent=paused?'▶':'Ⅱ';
      button.querySelector('[data-motion-toggle-text]').textContent=paused?'Harakatni davom ettirish':'Harakatni to‘xtatish';
      button.hidden=reduced;
      beatIndex=-1;selectBeat(0);planSlide();schedule();
    }
    function scrollToBeat(index) {
      const top=track.getBoundingClientRect().top+window.scrollY;
      const position=reduced?top+beats[index].offsetTop-100:top+((index+.22)/3)*Math.max(0,track.offsetHeight-window.innerHeight);
      window.scrollTo({top:position,behavior:paused||reduced?'instant':'smooth'});
    }
    listen(root,'click',event=>{
      const target=event.target.closest('button');if(!target)return;
      if(target.hasAttribute('data-slide-to'))setSlide(Number(target.dataset.slideTo),true);
      if(target.hasAttribute('data-slide-next'))setSlide(slideIndex+1,true);
      if(target.hasAttribute('data-slide-prev'))setSlide(slideIndex-1,true);
      if(target.hasAttribute('data-slide-pause')){slidePaused=!slidePaused;planSlide();}
      if(target.hasAttribute('data-merch-to'))scrollToBeat(Number(target.dataset.merchTo));
      if(target.hasAttribute('data-motion-toggle')){paused=!paused;try{localStorage.setItem('dasturxona-motion-paused',String(paused));}catch{}syncMotion();}
      if(target.hasAttribute('data-scroll-target')){
        const element=document.getElementById(target.dataset.scrollTarget);
        window.scrollTo({top:target.dataset.scrollTarget==='top'?0:(element?.getBoundingClientRect().top||0)+window.scrollY,behavior:paused||reduced?'instant':'smooth'});
      }
    });
    listen(hero,'pointerenter',event=>{if(event.pointerType!=='touch'){hovered=true;planSlide();}});
    listen(hero,'pointerleave',()=>{hovered=false;planSlide();});
    listen(hero,'focusin',()=>{focused=true;planSlide();});
    listen(hero,'focusout',event=>{if(!hero.contains(event.relatedTarget)){focused=false;planSlide();}});
    listen(hero,'keydown',event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();setSlide(slideIndex+(event.key==='ArrowRight'?1:-1),true);}});
    listen(hero,'pointerdown',event=>{if(event.pointerType==='touch')pointer={x:event.clientX,y:event.clientY};},{passive:true});
    listen(hero,'pointercancel',()=>{pointer=null;},{passive:true});
    listen(hero,'pointerup',event=>{if(pointer){const dx=event.clientX-pointer.x,dy=event.clientY-pointer.y;if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.4)setSlide(slideIndex+(dx<0?1:-1),true);pointer=null;}},{passive:true});
    listen(window,'scroll',schedule,{passive:true});listen(window,'resize',schedule,{passive:true});
    listen(document,'visibilitychange',()=>{body.classList.toggle('motion-document-hidden',document.hidden);planSlide();schedule();});
    if(media?.addEventListener)listen(media,'change',event=>{reduced=event.matches;syncMotion();});
    if('IntersectionObserver' in window){
      const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){entry.target.classList.add('is-revealed');observer.unobserve(entry.target);}},{threshold:.08});
      root.querySelectorAll('[data-motion-reveal]').forEach(el=>{el.classList.add('motion-reveal-ready');observer.observe(el);});
      removers.push(()=>observer.disconnect());
    }
    for(const button of root.querySelectorAll('[data-slide-prev],[data-slide-next]'))button.hidden=slides.length<2;
    syncMotion();paint();
    cleanup=()=>{
      dead=true;stopTimer();cancelAnimationFrame(frame);removers.forEach(fn=>fn());
      body.classList.remove('motion-home','motion-ready','motion-header-visible','motion-paused','motion-reduced','motion-document-hidden','motion-in-scene');
      header.inert=false;header.removeAttribute('aria-hidden');
    };
  }
  window.DasturxonaMotion = {render,init,destroy};
})();
