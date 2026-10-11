const fs=require('node:fs');
const assert=require('node:assert/strict');
const {JSDOM,VirtualConsole}=require('jsdom');
async function check(name) {
  const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
  let calls=0;
  const dom=new JSDOM(fs.readFileSync('review/'+name,'utf8'),{
    url:'file:///review/'+name,runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,
    beforeParse(w){
      w.fetch=()=>{calls++;throw Error('Review must not request APIs')};
      w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
      w.HTMLCanvasElement.prototype.getContext=()=>null;
      w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
    }
  });
  const w=dom.window,d=w.document,tick=()=>new Promise(r=>setTimeout(r,80));
  try {
    await tick();assert(d.querySelector('#dx-immersive-home'));
    assert.equal(d.querySelectorAll('.dx-cinema-slide').length,3);
    assert([...d.querySelectorAll('#main img')].every(im=>im.getAttribute('src').startsWith('data:image/')));
    d.querySelector('[data-dx-next]').click();await tick();assert.equal(d.body.dataset.dxSlide,'1');
    w.location.hash='#/dokon';await tick();assert.equal(d.querySelectorAll('.product-card').length,8);
    assert([...d.querySelectorAll('.product-media img')].every(im=>im.getAttribute('src').startsWith('data:image/')));
    w.location.hash='#/it-proyektlar';await tick();assert(d.querySelector('.dx-bot-poster').src.startsWith('data:image/'));
    w.location.hash='#/biz-haqimizda';await tick();assert(d.querySelector('.dx-about-atelier img').src.startsWith('data:image/'));
    assert.equal(calls,0);assert.deepEqual(errors,[]);
    console.log('PASS:',name,'offline slider/catalog, embedded artwork on all pages, no API calls or script errors.');
  } finally {dom.window.close();}
}
(async()=>{
  await check('design-v2-preview.html');await check('inline-v2-document.html');
  const fragment=fs.readFileSync('/workspace/dasturxona-immersive-preview.html','utf8');
  assert(Buffer.byteLength(fragment)<1000000);
  const dom=new JSDOM(fragment);
  assert(dom.window.document.querySelector('#dasturxona-immersive-review>iframe').getAttribute('srcdoc').includes('DX_REVIEW_DATA'));
  const mobile=new JSDOM(fs.readFileSync('review/mobile-v2-preview.html','utf8'));
  assert.equal(mobile.window.document.querySelector('iframe').getAttribute('srcdoc'),fs.readFileSync('review/design-v2-preview.html','utf8'));
  console.log('PASS: inline fragment read back under 1 MB; mobile frame contains the exact desktop application.');
  dom.window.close();mobile.window.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
