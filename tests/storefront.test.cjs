const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom');
const {normalizeProduct,normalizeProject}=require('../server');
const root=path.join(__dirname,'..');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check){for(let i=0;i<80;i++){if(check())return;await sleep(10);}assert(check(),'UI did not reach expected state');}
async function fixture(){
 const db=JSON.parse(fs.readFileSync(path.join(root,'data/db.json'))),errors=[],requests=[];
 db.products.push({id:'uploaded-souvenir',name:'Yangi suvenir',short:'Sinov',category:'suvenir',physical:true,price:15000,stock:4,sizes:[],image:'/uploads/main.webp',images:['/uploads/detail.webp']});
 const news=[{slug:'new-article',title:'Yangi maqola',excerpt:'Jamoa haqida',body:'To‘liq maqola matni.',category:'jamoa',status:'published',publishedAt:'2026-10-15T10:00:00Z'}];
 let html=fs.readFileSync(path.join(root,'public/index.html'),'utf8').replace('<script src="/assets/store.js" defer></script>',()=>'<script>'+fs.readFileSync(path.join(root,'public/assets/store.js'),'utf8')+'</script>');
 const vc=new VirtualConsole();vc.on('jsdomError',error=>errors.push(error.message));
 const dom=new JSDOM(html,{url:'https://dasturxona.test/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
  w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};w.CSS={escape:value=>String(value).replace(/"/g,'\\"')};
  w.fetch=async(url,options={})=>{requests.push({url:String(url),options});let result;
   if(String(url).startsWith('/api/catalog'))result={api:'dasturxona',products:db.products.map(normalizeProduct),projects:db.projects.map(normalizeProject),team:[],settings:db.settings,banners:[]};
   else if(String(url)==='/api/orders'){const p=JSON.parse(options.body);result={order:{...p,ref:'DX-UI-TEST',token:'test-token',serverSaved:true,status:'new',paymentStatus:'unpaid',shippingFee:0,total:p.items.reduce((sum,i)=>sum+db.products.find(p=>p.id===i.id).price*i.qty,0),items:p.items.map(i=>({...i,productName:db.products.find(p=>p.id===i.id).name,unitPrice:db.products.find(p=>p.id===i.id).price})),delivery:'Kelishilgan joydan olib ketish'}};}
   else if(String(url).startsWith('/api/news/'))result=news[0];
   else if(String(url).startsWith('/api/news')){const u=new URL(String(url),'https://dasturxona.test');const filtered=news.filter(n=>(!u.searchParams.get('q')||n.title.toLowerCase().includes(u.searchParams.get('q').toLowerCase()))&&(!u.searchParams.get('category')||n.category===u.searchParams.get('category')));result={items:filtered,total:filtered.length,page:1,limit:9};}
   else result={};
   return {ok:true,status:200,json:async()=>result};
  };
 }});
 const w=dom.window,d=w.document;
 await until(()=>d.querySelector('.home-hero'));
 const go=async hash=>{const old=d.querySelector('#main').firstElementChild;w.location.hash=hash;await until(()=>d.querySelector('#main').dataset.route===hash&&d.querySelector('#main').firstElementChild!==old);};
 return {w,d,dom,go,errors,requests};
}
test('home has visible navigation, direct shop/bot actions and both product categories',async()=>{
 const f=await fixture();try{assert(!f.d.querySelector('.site-header').hasAttribute('aria-hidden'));assert.equal(f.d.querySelector('.home-hero a[href="#/dokon"]').textContent.trim(),'Do‘konni ko‘rish');assert(f.d.querySelector('.home-hero a[href="https://t.me/dasturxona_bot"]'));assert(f.d.querySelector('.quick-links a[href="#/dokon?tur=souvenir"]'));const ids=[...f.d.querySelectorAll('.product-card')].map(e=>e.dataset.product);assert(ids.includes('merch-mug'));assert(!f.d.querySelector('[data-brand-dock]'));assert.deepEqual(f.errors,[]);}finally{f.dom.window.close();}
});
test('catalog shows categories and requires size selection; buy-now stays on checkout',async()=>{
 const f=await fixture();try{await f.go('#/dokon');assert.equal(f.d.querySelectorAll('[data-action=category]').length,3);f.d.querySelector('[data-category=souvenir]').click();assert.equal(f.w.location.hash,'#/dokon?tur=souvenir');assert.equal(f.d.querySelectorAll('.product-card').length,3);await f.go('#/dokon');assert.equal(f.d.querySelectorAll('.product-card').length,9);
 const choice=f.d.querySelector('[data-product="merch-tshirt-blue"] .product-body a.btn');assert.equal(choice.getAttribute('href'),'#/mahsulot/merch-tshirt-blue');choice.click();await until(()=>f.d.querySelector('#product-form'));assert.equal(f.d.querySelector('[name=size]:checked'),null);
 f.d.querySelector('[name=buy-now]').click();assert.equal(f.d.querySelector('#size-error').hidden,false);assert.equal(f.d.querySelector('#cart-count').textContent,'0');
 f.d.querySelector('[name=size][value=M]').checked=true;f.d.querySelector('[name=buy-now]').click();await until(()=>f.w.location.hash==='#/buyurtma');await sleep(100);assert.equal(f.w.location.hash,'#/buyurtma');assert.equal(f.d.querySelector('#cart-count').textContent,'1');assert(f.d.querySelector('.checkout-steps [aria-current=step]'));assert.deepEqual(f.errors,[]);
 }finally{f.dom.window.close();}
});
test('uploaded gallery works and a souvenir without sizes adds without navigation',async()=>{
 const f=await fixture();try{await f.go('#/mahsulot/uploaded-souvenir');assert.equal(f.d.querySelector('#product-image').getAttribute('src'),'/uploads/main.webp');assert.equal(f.d.querySelectorAll('[name=size]').length,0);f.d.querySelector('[data-image="/uploads/detail.webp"]').click();assert.equal(f.d.querySelector('#product-image').getAttribute('src'),'/uploads/detail.webp');f.d.querySelector('[data-action=zoom-image]').click();assert(f.d.querySelector('#image-dialog').open);f.d.querySelector('#image-dialog [data-action=close-dialog]').click();f.d.querySelector('#product-form button[type=submit]').click();await sleep(90);assert.equal(f.w.location.hash,'#/mahsulot/uploaded-souvenir');assert.equal(f.d.querySelector('#cart-count').textContent,'1');assert.deepEqual(f.errors,[]);}finally{f.dom.window.close();}
});
test('news counter/search and directly opened article resolve correctly',async()=>{
 const f=await fixture();try{await f.go('#/yangiliklar');await until(()=>f.d.querySelector('#news-count').textContent==='1 ta yangilik');f.d.querySelector('#news-search').value='topilmaydi';f.d.querySelector('#news-search-form button').click();await until(()=>f.d.querySelector('#news-count').textContent==='0 ta yangilik');assert(!f.d.querySelector('#main').textContent.includes('undefined'));await f.go('#/yangilik/new-article');await until(()=>f.d.querySelector('.article-body'));assert.match(f.d.querySelector('.article-body').textContent,/To‘liq maqola/);assert.deepEqual(f.errors,[]);}finally{f.dom.window.close();}
});
test('checkout submits once and shows confirmation with server-calculated total',async()=>{
 const f=await fixture();try{await f.go('#/mahsulot/uploaded-souvenir');f.d.querySelector('[name=buy-now]').click();await until(()=>f.d.querySelector('#checkout-form'));
 f.d.querySelector('#customer').value='Sinov xaridor';f.d.querySelector('#phone').value='+998 90 123 45 67';f.d.querySelector('#delivery').value='pickup';f.d.querySelector('#delivery').dispatchEvent(new f.w.Event('change',{bubbles:true}));f.d.querySelector('#consent').checked=true;f.d.querySelector('#checkout-form button[type=submit]').click();await until(()=>f.d.querySelector('.confirm-box'));assert.match(f.d.querySelector('.confirm-box').textContent,/Buyurtma qabul qilindi/);assert.equal(f.requests.filter(r=>r.url==='/api/orders').length,1);assert.equal(f.d.querySelector('#cart-count').textContent,'0');assert(!f.d.querySelector('.confirm-status').textContent.includes('undefined'));assert.deepEqual(f.errors,[]);
 }finally{f.dom.window.close();}
});
test('projects are not duplicated and all informational routes render without script errors',async()=>{
 const f=await fixture();try{await f.go('#/it-proyektlar');assert.equal(f.d.querySelectorAll('.project-card').length,1);assert.equal(f.d.querySelectorAll('.dx-bot-card').length,0);for(const hash of ['#/loyiha/dasturxona-bot','#/biz-haqimizda','#/malumot/yetkazish','#/malumot/tolov','#/malumot/qaytarish','#/malumot/maxfiylik','#/malumot/loyiha','#/missing']){await f.go(hash);assert(f.d.querySelector('#main h1'));}assert.deepEqual(f.errors,[]);}finally{f.dom.window.close();}
});
