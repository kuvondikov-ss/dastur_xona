const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const {JSDOM, VirtualConsole} = require('jsdom');
const root = path.resolve(__dirname, '..');
const db = JSON.parse(fs.readFileSync(path.join(root,'data/db.json')));
const catalog = {
  api:'dasturxona', products:db.products,
  projects:db.projects.map(p=>({...p,kind:p.kind||'bot',tags:p.tags||[],features:p.features||[],creator:p.creator||null,productId:p.productId||null})),
  team:db.team,settings:db.settings,banners:db.banners||[]
};
const errors=[];
const bridge=new VirtualConsole();bridge.on('jsdomError',e=>errors.push(e.message));
let reduce=false;
const mediaListeners=[];
const resizeObservers=[];
let layoutShift=0;
let collisionElement=null,collisionDock=null;
let releaseCatalog;
const catalogReady=new Promise(resolve=>{releaseCatalog=resolve});
const dom=new JSDOM(fs.readFileSync(path.join(root,'public/index.html'),'utf8'),{
  url:'https://dasturxona-design.test/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:bridge,
  beforeParse(w){
    w.addEventListener('error',event=>errors.push(event.error?.message||event.message));
    let scroll=0;
    Object.defineProperty(w,'scrollY',{get:()=>scroll});
    Object.defineProperty(w,'innerWidth',{value:1440,writable:true});
    Object.defineProperty(w,'innerHeight',{value:900,writable:true});
    w.matchMedia=query=>({get matches(){return query.includes('reduced')?reduce:query.includes('pointer: fine')},addEventListener(type,fn){if(query.includes('reduced'))mediaListeners.push(fn)},removeEventListener(){}});
    w.ResizeObserver=class{constructor(fn){this.fn=fn;resizeObservers.push(this)}observe(){this.active=true}disconnect(){this.active=false}};
    w.scrollTo=(a,b)=>{scroll=typeof a==='object'?a.top:(b||0)};
    w.HTMLElement.prototype.scrollIntoView=()=>{};
    w.HTMLCanvasElement.prototype.getContext=()=>null;
    w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')};
    w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};
    w.fetch=async url=>({ok:true,status:200,json:async()=>String(url).startsWith('/api/catalog')?catalogReady.then(()=>catalog):String(url)==='/api/orders'?{ref:'DX-LOCAL-TEST',token:'local-test-only',status:'new',createdAt:'2026-10-11T00:00:00.000Z'}:String(url).startsWith('/api/orders/')?{ref:'DX-LOCAL-TEST',status:'confirmed',createdAt:'2026-10-11T00:00:00.000Z'}:{items:db.news.filter(n=>n.status!=='draft'),total:db.news.length,limit:9}});
    // jsdom has no layout engine. These geometry fixtures exercise scroll logic, not visual layout.
    w.getComputedStyle=element=>({display:element.hidden?'none':element.style.display||'block',visibility:element.style.visibility||'visible'});
    w.HTMLElement.prototype.getBoundingClientRect=function(){
      const points={hero:[0,900],world:[980,800],merch:[1780,1400],digital:[3180,1050],purpose:[4230,1800],makers:[6030,1050],news:[7080,850],questions:[7930,1000],finale:[8930,850],footer:[9850,700]};
      const mobile=w.innerWidth<=680;
      const chapter=this.closest('[data-scene]');
      const point=points[chapter?.dataset.scene]||[0,0];
      let top=point[0]+(chapter?.dataset.scene!=='hero'?layoutShift:0),left=40,height=0,width=0;
      if(this===collisionElement&&collisionDock)return collisionDock.getBoundingClientRect();
      if(this.id==='dx-immersive-home'){top=0;height=9850+layoutShift;width=w.innerWidth;left=0}
      else if(this.classList.contains('site-header')){top=scroll;height=86;width=w.innerWidth;left=0}
      else if(this.matches('[data-brand-dock]')){
        width=mobile?235:310;height=width;
        left=mobile?(w.innerWidth-width)/2:w.innerWidth-430;
        top+=chapter?.dataset.scene==='purpose'?750:mobile?380:300;
        if(chapter?.dataset.scene==='hero')top=mobile?530:300;
      }
      else if(this.id==='dx-webgl'||this.id==='dx-journey-layer')return this.closest('[data-brand-dock]')?.getBoundingClientRect()||{top:0,bottom:0,left:0,right:0,width:0,height:0};
      else if(this.matches('[data-scene]')){height=point[1];width=w.innerWidth;left=0}
      else if(this.classList.contains('dx-purpose-sticky')){height=790;width=mobile?w.innerWidth-40:600}
      else if(this.hasAttribute('data-value-step')){top=4400+[...this.parentElement.children].indexOf(this)*400+layoutShift;height=350;width=500;left=w.innerWidth*.55}
      else if(this.matches('h1,h2,h3,h4,p,a,button,summary,label,small,span,b,strong')){
        top+=chapter?.dataset.scene==='hero'?150:60;
        height=mobile?260:180;width=mobile?w.innerWidth-40:Math.min(800,w.innerWidth-550);left=mobile?20:40;
        if(this.closest('.dx-purpose-steps')&&!mobile){left=w.innerWidth*.55;width=w.innerWidth*.4}
      }
      return {top:top-scroll,bottom:top-scroll+height,left,right:left+width,width,height,x:left,y:top-scroll,toJSON(){return this}};
    };
    w.HTMLElement.prototype.getClientRects=function(){const box=this.getBoundingClientRect();return box.width&&box.height?[box]:[]};
  }
});
const w=dom.window,d=w.document;
const auto=new Map();let nextId=900000;
const nativeTimeout=w.setTimeout.bind(w),nativeClear=w.clearTimeout.bind(w);
w.setTimeout=(fn,delay,...args)=>{if(delay===8000){const id=nextId++;auto.set(id,fn);return id}return nativeTimeout(fn,delay,...args)};
w.clearTimeout=id=>{if(!auto.delete(id))nativeClear(id)};
const tick=()=>new Promise(r=>setTimeout(r,80));
async function waitForReady(test,message='the rendered route and motion controller became ready'){for(let i=0;i<20;i++){if(test())return;await tick()}assert(test(),message)}
async function goto(hash){
  const previous=d.querySelector('#main').firstElementChild;w.location.hash=hash;
  await waitForReady(()=>{
    const home=Boolean(d.querySelector('#dx-immersive-home'));
    return d.querySelector('#main').firstElementChild!==previous&&w.dxSceneState?.home===home&&d.documentElement.classList.contains('dx-enter-home')===home;
  });
}
async function scrollTo(y){w.scrollTo(0,y);w.dispatchEvent(new w.Event('scroll'));await tick()}

(async()=>{
  await tick();
  assert.equal(d.querySelector('#dx-immersive-home'),null,'the catalog has not arrived when deferred controllers start');
  w.eval(fs.readFileSync(path.join(root,'public/assets/design-v2.js'),'utf8'));
  w.eval(fs.readFileSync(path.join(root,'public/assets/scene-v2.bundle.js'),'utf8'));
  assert.equal(d.querySelector('.site-header').getAttribute('aria-hidden'),'true','pending home data does not flash the header');
  releaseCatalog();
  await waitForReady(()=>d.querySelector('[data-dx-motion]')?.getAttribute('aria-label')==='Harakatni to‘xtatish');
  assert.equal(d.querySelectorAll('.dx-cinema-slide').length,3+catalog.banners.length);
  assert.equal(d.querySelectorAll('.dx-cinema-slide.is-active').length,1);
  assert.equal(d.querySelector('.site-header').getAttribute('aria-hidden'),'true');
  assert.equal(d.querySelector('[data-dx-motion]').getAttribute('aria-label'),'Harakatni to‘xtatish','async catalog rendering initializes the home controller');
  assert.equal(d.querySelectorAll('.dx-creative-card').length,4);
  assert.equal(d.querySelectorAll('[data-brand-dock]').length,12+catalog.banners.length,'every home chapter, slide and footer reserves its own graphics cell');
  const persistentHost=d.querySelector('#dx-webgl');
  function checkDock(){
    const layer=d.querySelector('#dx-journey-layer'),dock=layer.parentElement;
    assert(dock.hasAttribute('data-brand-dock'),'the renderer only attaches to a reserved cell');
    assert.equal(persistentHost.dataset.dock,dock.dataset.brandId);
    if(w.dxSceneState.visible){
      assert(!layer.hidden);assert(!dock.classList.contains('dx-dock-blocked'));
      assert.equal(persistentHost.dataset.collision,'false');
      assert.equal(persistentHost.style.getPropertyValue('--dx-logo-color'),dock.dataset.brandTone==='light'?'#153254':'#fbf7ef');
      const clip=dock.style.clipPath.match(/inset\(([\d.]+)px 0 ([\d.]+)px 0\)/);
      assert(clip,'the entire reserved cell, including its static placeholder, is clipped');
      const rect=dock.getBoundingClientRect(),guard=d.querySelector('.site-header').getAttribute('aria-hidden')==='true'?0:98;
      assert(rect.top+Number(clip[1])>=guard-.01,'graphics cannot enter the fixed header');
      assert(rect.bottom-Number(clip[2])<=w.innerHeight+.01,'graphics are clipped to the bottom of the viewport');
    }
    assert.equal(d.querySelectorAll('#dx-webgl').length,1,'route and section transfers preserve one renderer');
  }
  await waitForReady(()=>w.dxSceneState?.visible);checkDock();
  for(const group of d.querySelectorAll('.dx-circuit-signal-left,.dx-circuit-signal-right')){
    assert(group.querySelector('path')&&group.querySelector('circle'),'both original side traces and nodes share one motion group');
  }
  assert.equal(d.querySelectorAll('[data-value-step]').length,4);
  assert.equal(d.querySelectorAll('.product-card').length,4);
  assert.equal(d.querySelector('.dx-bot-showcase img').getAttribute('src'),'/assets/bot-campaign-v2.webp');
  assert.equal(auto.size,1);
  const first=auto.entries().next().value;auto.delete(first[0]);first[1]();await tick();
  assert.equal(d.body.dataset.dxSlide,'1','autoplay advances the full-screen slider');
  d.querySelector('[data-dx-next]').click();await tick();assert.equal(d.body.dataset.dxSlide,'2');
  d.querySelector('[data-dx-next]').click();await tick();assert.equal(d.body.dataset.dxSlide,'0');
  d.querySelector('[data-dx-prev]').click();await tick();assert.equal(d.body.dataset.dxSlide,String(2+catalog.banners.length));
  d.querySelector('[data-dx-slide="0"]').click();await tick();
  assert.equal(d.querySelectorAll('.dx-cinema-slide[aria-hidden="false"]').length,1);
  assert.equal(d.querySelectorAll('.dx-cinema-slide:not([inert])').length,1);
  const hero=d.querySelector('.dx-cinema');
  hero.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));await tick();
  assert.equal(d.body.dataset.dxSlide,'1','keyboard advances the current slide');
  hero.dispatchEvent(new w.FocusEvent('focusin',{bubbles:true}));assert.equal(auto.size,0,'focus pauses carousel autoplay');
  hero.dispatchEvent(new w.FocusEvent('focusout',{relatedTarget:d.body,bubbles:true}));assert.equal(auto.size,1);
  function swipe(type,x){const event=new w.Event(type,{bubbles:true});Object.assign(event,{pointerType:'touch',clientX:x,clientY:100});hero.dispatchEvent(event);}
  swipe('pointerdown',220);swipe('pointerup',110);await tick();assert.equal(d.body.dataset.dxSlide,'2','horizontal touch gesture advances the slide');
  d.querySelector('[data-dx-slide="0"]').click();await tick();
  d.querySelector('[data-dx-scroll]').click();await tick();assert.equal(w.scrollY,898,'explore positions the next section below the revealed header');
  assert(d.querySelector('#dx-immersive-home'));
  await scrollTo(160);assert.equal(d.querySelector('.site-header').getAttribute('aria-hidden'),'false');
  await scrollTo(0);assert.equal(d.querySelector('.site-header').getAttribute('aria-hidden'),'true','header returns to its hidden state at the top');
  await scrollTo(4900);await waitForReady(()=>w.dxSceneState.scene==='purpose'&&w.dxSceneState.visible);checkDock();
  assert(Number(d.querySelector('#dx-immersive-home').style.getPropertyValue('--dx-progress'))>0);
  assert.equal(d.querySelectorAll('[data-value-step].is-current').length,1);
  d.querySelector('[data-dx-motion]').click();await tick();
  assert.equal(auto.size,0);assert(d.body.classList.contains('dx-motion-paused'));assert(w.dxSceneState.paused);
  checkDock();
  await goto('#/dokon');assert(!d.documentElement.classList.contains('dx-enter-home'));
  assert.equal(w.dxSceneState.home,false,'route changes republish the scene state');
  assert.equal(auto.size,0,'route changes dispose the old carousel');
  assert.equal(d.querySelectorAll('.product-card').length,8);
  assert(d.querySelector('.dx-page-scene img'));
  const search=d.querySelector('#catalog-search');search.value='Hudi';search.dispatchEvent(new w.Event('input',{bubbles:true}));
  assert.equal(d.querySelectorAll('.product-card').length,2);
  d.querySelector('[data-action="reset-filters"]').click();assert.equal(d.querySelectorAll('.product-card').length,8);
  await goto('#/mahsulot/'+db.products[0].id);
  assert.equal(d.querySelector('h1').textContent,db.products[0].name);
  d.querySelector('input[name=size]').click();
  d.querySelector('#product-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();
  assert.equal(w.location.hash,'#/savat');assert(d.querySelector('#main').textContent.includes(db.products[0].name));
  await goto('#/buyurtma');
  d.querySelector('#customer').value='Lokal sinov';d.querySelector('#phone').value='+998 90 123 45 67';
  const delivery=d.querySelector('#delivery');delivery.value='pickup';delivery.dispatchEvent(new w.Event('change',{bubbles:true}));
  d.querySelector('#consent').checked=true;
  d.querySelector('#checkout-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();
  assert.equal(w.location.hash,'#/tasdiq/DX-LOCAL-TEST','checkout accepts the existing server receipt shape');
  assert(d.querySelector('h1').textContent.includes('Buyurtma qabul qilindi'));
  assert(d.querySelector('.confirm-items').textContent.includes(db.products[0].name));
  d.querySelector('[data-action="refresh-order"]').click();await tick();
  assert(d.querySelector('.confirm-status').textContent.includes('Tasdiqlangan'));
  assert(d.querySelector('.confirm-items').textContent.includes(db.products[0].name),'status refresh preserves the full receipt');
  await goto('#/it-proyektlar');assert(d.querySelector('.dx-bot-poster'));assert.equal(d.querySelectorAll('.project-card').length,1);
  await goto('#/loyiha/dasturxona-bot');assert.equal(d.querySelector('#open-dasturxona-bot').getAttribute('href'),'https://t.me/dasturxona_bot');
  await goto('#/biz-haqimizda');assert(d.querySelector('.dx-about-atelier img'));assert.equal(d.querySelectorAll('.value-card').length,4);
  await goto('#/yangiliklar');assert(d.querySelector('h1'));
  await goto('#/');assert(d.body.classList.contains('dx-motion-paused'));
  assert.strictEqual(d.querySelector('#dx-webgl'),persistentHost,'routing reuses the persistent graphics host');
  assert.equal(w.dxSceneState.home,true);
  d.querySelector('[data-dx-motion]').click();await tick();assert.equal(auto.size,1);
  w.innerWidth=390;w.innerHeight=844;w.dispatchEvent(new w.Event('resize'));await tick();assert(w.dxSceneState.mobile);
  await scrollTo(180);await waitForReady(()=>w.dxSceneState.visible);checkDock();
  const beforeSplit=w.dxSceneState.split;
  await scrollTo(530);await new Promise(r=>setTimeout(r,400));checkDock();
  assert(w.dxSceneState.split>beforeSplit+.1,'scroll separates pieces as their reserved cell leaves the viewing center');
  await scrollTo(4100);await new Promise(r=>setTimeout(r,400));
  const beforeResize=Number(d.querySelector('#dx-immersive-home').style.getPropertyValue('--dx-progress'));
  layoutShift=1600;resizeObservers.filter(o=>o.active).forEach(o=>o.fn());await tick();
  assert(Number(d.querySelector('#dx-immersive-home').style.getPropertyValue('--dx-progress'))<beforeResize,'late image/font layout updates the scroll path without a new scroll event');
  layoutShift=0;resizeObservers.filter(o=>o.active).forEach(o=>o.fn());await tick();
  for(const width of [320,390,680,1024,1440]){
    w.innerWidth=width;w.dispatchEvent(new w.Event('resize'));await tick();
    for(const id of ['hero-0','world','merch','digital','purpose','makers','news','questions','finale','footer']){
      const dock=d.querySelector(`[data-brand-id="${id}"]`);assert(dock,`reserved ${id} cell exists`);
      const rect=dock.getBoundingClientRect();
      await scrollTo(w.scrollY+rect.top+rect.height/2-w.innerHeight*.52);
      await waitForReady(()=>persistentHost.dataset.dock===id&&w.dxSceneState.visible,`${width}px ${id} station: ${JSON.stringify(w.dxSceneState)}`);
      checkDock();
      const active=dock.getBoundingClientRect();
      assert(active.left>=20&&active.right<=w.innerWidth-20,'the reserved cell fits the screen width');
      assert.equal(w.dxSceneState.shape,'logo');
    }
  }
  const purposeDock=d.querySelector('[data-brand-id="purpose"]');
  const rect=purposeDock.getBoundingClientRect();await scrollTo(w.scrollY+rect.top-300);
  await waitForReady(()=>persistentHost.dataset.dock==='purpose'&&w.dxSceneState.visible);
  collisionElement=d.querySelector('.dx-purpose-sticky>p');collisionDock=purposeDock;
  w.dispatchEvent(new w.Event('resize'));await tick();
  assert(purposeDock.classList.contains('dx-dock-blocked'),'enlarged text disables all graphics in a colliding cell');
  assert(d.querySelector('#dx-journey-layer').hidden,'collision fails closed before a section transfer can paint over the copy');
  assert.equal(w.dxSceneState.visible,false);
  collisionElement=null;collisionDock=null;w.dispatchEvent(new w.Event('resize'));
  await waitForReady(()=>w.dxSceneState.visible);checkDock();
  w.dispatchEvent(new w.Event('pagehide'));await tick();assert(d.body.classList.contains('dx-document-hidden'));assert.equal(auto.size,0);
  w.dispatchEvent(new w.Event('pageshow'));await tick();assert(!d.body.classList.contains('dx-document-hidden'));
  reduce=true;mediaListeners.forEach(fn=>fn());await tick();
  assert.equal(auto.size,0);assert(d.querySelector('[data-dx-motion]').disabled);assert(w.dxSceneState.paused);
  const css=fs.readFileSync(path.join(root,'public/assets/design-v2.css'),'utf8');
  const style=d.createElement('style');style.textContent=css;d.head.append(style);
  assert(style.sheet.cssRules.length>100);
  assert.match(css,/height:100svh/);
  assert.match(css,/contain:layout paint/,'CSS confines every effect to its reserved cell');
  assert.match(css,/transition:fill 1\.25s ease/,'the SVG fallback changes its palette smoothly');
  assert.match(css,/dx-dock-blocked>\*/,'the collision guard hides static graphics too');
  assert.match(css,/dx-journey-layer\[hidden\]\{display:none!important\}/,'the master host respects the hidden attribute inside a cell');
  assert.deepEqual(errors,[]);
  console.log('PASS: delayed catalog, slider/header/routes, persistent renderer in every reserved section at 5 screen widths, palette/scroll split, text-collision fail-closed guard, late layout, lifecycle/motion controls, mocked cart/checkout and CSS parsing.');
  console.log('Visual viewport/GPU rendering and live checkout were not exercised by jsdom.');
  dom.window.close();
})().catch(error=>{console.error(error);dom.window.close();process.exitCode=1});
