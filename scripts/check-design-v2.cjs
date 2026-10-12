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
    w.HTMLElement.prototype.getBoundingClientRect=function(){
      const points={hero:[0,900],world:[980,800],merch:[1780,1400],digital:[3180,1050],purpose:[4230,1800],makers:[6030,1200],questions:[7230,800],finale:[8030,850]};
      let top=0,height=350,width=800;
      if(this.id==='dx-immersive-home'){height=9000+layoutShift;width=1440}
      else if(this.dataset.scene&&points[this.dataset.scene]) [top,height]=points[this.dataset.scene];
      else if(this.hasAttribute('data-value-step')){top=4400+[...this.parentElement.children].indexOf(this)*400;height=350}
      if(this.dataset.scene&&this.dataset.scene!=='hero')top+=layoutShift;
      return {top:top-scroll,bottom:top-scroll+height,left:0,right:width,width,height,x:0,y:top-scroll,toJSON(){return this}};
    };
  }
});
const w=dom.window,d=w.document;
const auto=new Map();let nextId=900000;
const nativeTimeout=w.setTimeout.bind(w),nativeClear=w.clearTimeout.bind(w);
w.setTimeout=(fn,delay,...args)=>{if(delay===8000){const id=nextId++;auto.set(id,fn);return id}return nativeTimeout(fn,delay,...args)};
w.clearTimeout=id=>{if(!auto.delete(id))nativeClear(id)};
const tick=()=>new Promise(r=>setTimeout(r,80));
async function waitForReady(test){for(let i=0;i<20;i++){if(test())return;await tick()}assert(test(),'the rendered route and motion controller became ready')}
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
  await scrollTo(4900);assert.equal(w.dxSceneState.scene,'purpose');
  assert(Number(d.querySelector('#dx-immersive-home').style.getPropertyValue('--dx-progress'))>0);
  assert.equal(d.querySelectorAll('[data-value-step].is-current').length,1);
  d.querySelector('[data-dx-motion]').click();await tick();
  assert.equal(auto.size,0);assert(d.body.classList.contains('dx-motion-paused'));assert(w.dxSceneState.paused);
  assert.equal(d.querySelector('#dx-webgl').style.getPropertyValue('--dx-scene-opacity'),'0');
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
  assert.equal(w.dxSceneState.home,true);
  d.querySelector('[data-dx-motion]').click();await tick();assert.equal(auto.size,1);
  w.innerWidth=390;w.innerHeight=844;w.dispatchEvent(new w.Event('resize'));await tick();assert(w.dxSceneState.mobile);
  function pose(){const el=d.querySelector('#dx-webgl');return ['x','y','size','opacity'].map(key=>parseFloat(el.style.getPropertyValue('--dx-scene-'+key)))}
  await scrollTo(574);await new Promise(r=>setTimeout(r,400));const beforeBoundary=pose();
  await scrollTo(575);const afterBoundary=pose();
  assert(afterBoundary.slice(0,3).every((v,i)=>Math.abs(v-beforeBoundary[i])<4),'mobile chapter boundaries do not teleport or resize the emblem');
  await scrollTo(4100);await new Promise(r=>setTimeout(r,400));
  const beforeResize=Number(d.querySelector('#dx-immersive-home').style.getPropertyValue('--dx-progress'));
  layoutShift=1600;resizeObservers.filter(o=>o.active).forEach(o=>o.fn());await tick();
  assert(Number(d.querySelector('#dx-immersive-home').style.getPropertyValue('--dx-progress'))<beforeResize,'late image/font layout updates the scroll path without a new scroll event');
  layoutShift=0;resizeObservers.filter(o=>o.active).forEach(o=>o.fn());await tick();
  for(const y of [0,575,2500,4500,6900,8100]){
    await scrollTo(y);const [x,yPos,size]=pose();
    assert(x-size/2>=11.9&&x+size/2<=w.innerWidth-11.9,'the emblem stays within narrow viewport edges');
    assert(yPos-size/2>=0&&yPos+size/2<=w.innerHeight,'the emblem stays within vertical viewport edges');
    assert.equal(w.dxSceneState.shape,'logo');
  }
  w.dispatchEvent(new w.Event('pagehide'));await tick();assert(d.body.classList.contains('dx-document-hidden'));assert.equal(auto.size,0);
  w.dispatchEvent(new w.Event('pageshow'));await tick();assert(!d.body.classList.contains('dx-document-hidden'));
  reduce=true;mediaListeners.forEach(fn=>fn());await tick();
  assert.equal(auto.size,0);assert(d.querySelector('[data-dx-motion]').disabled);assert(w.dxSceneState.paused);
  const css=fs.readFileSync(path.join(root,'public/assets/design-v2.css'),'utf8');
  const style=d.createElement('style');style.textContent=css;d.head.append(style);
  assert(style.sheet.cssRules.length>100);
  assert.match(css,/height:100svh/);
  assert.deepEqual(errors,[]);
  console.log('PASS: delayed catalog, slider/header/navigation, continuous mobile path and viewport bounds, late layout updates, page lifecycle, pause/reduced motion, catalog/cart/checkout, posters and stylesheet parsing.');
  console.log('Visual viewport/GPU rendering and live checkout were not exercised by jsdom.');
  dom.window.close();
})().catch(error=>{console.error(error);dom.window.close();process.exitCode=1});
