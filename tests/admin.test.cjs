const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom');
const root=path.join(__dirname,'..');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check){for(let i=0;i<80;i++){if(check())return;await sleep(10);}assert(check(),'Admin UI did not reach expected state');}
async function fixture(){
 const db=JSON.parse(fs.readFileSync(path.join(root,'data/db.json'))),writes=[],errors=[];
 db.banners=[{id:'one',title:'Birinchi',image:'/uploads/banner.webp'},{id:'two',title:'Ikkinchi'}];
 db.orders=[{ref:'DX-ADMIN-TEST',customer:'Sinov xaridor',phone:'+998901234567',status:'new',paymentStatus:'unpaid',total:179000,createdAt:'2026-10-15T10:00:00Z',delivery:'Olib ketish',items:[{id:'merch-tshirt-blue',qty:1,size:'M',unitPrice:179000,productName:'Ko‘k futbolka'}]}];
 let html=fs.readFileSync(path.join(root,'public/admin.html'),'utf8').replace('<script src="/assets/admin.js" defer></script>','').replace('</body>',()=>'<script>'+fs.readFileSync(path.join(root,'public/assets/admin.js'),'utf8')+'</script></body>');
 const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(html,{url:'https://dasturxona.test/admin',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
  w.confirm=()=>true;w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
  w.fetch=async(url,options={})=>{let result;if(url==='/api/admin/data')result=db;else if(url==='/api/admin/upload')result={url:'/uploads/new-image.webp'};else{const body=JSON.parse(options.body);writes.push({url,body});if(options.method==='PUT')db[url.split('/').at(-1)]=body;result={ok:true};}return {ok:true,status:200,json:async()=>result};};
 }});
 const d=dom.window.document,w=dom.window;d.querySelector('#username').value='review-user';d.querySelector('#password').value='review-password';d.querySelector('#loginForm button').click();await until(()=>!d.querySelector('#dashboard').hidden);
 return {d,w,dom,db,writes,errors};
}
test('admin opens a separate editor and saves a souvenir without accidental size requirements',async()=>{
 const f=await fixture();try{assert.equal(f.d.querySelector('#editor').open,false);f.d.querySelector('#addEntry').click();f.d.querySelector('[name=name]').value='Yangi krujka';f.d.querySelector('[name=price]').value='25000';f.d.querySelector('[name=stock]').value='4';f.d.querySelector('[name=category]').value='souvenir';f.d.querySelector('[name=image]').value='/uploads/new-image.webp';f.d.querySelector('[name=image]').dispatchEvent(new f.w.Event('input',{bubbles:true}));assert.equal(f.d.querySelector('[data-preview=image]').hidden,false);f.d.querySelector('#saveEntry').click();await until(()=>f.writes.length===1);const product=f.writes[0].body.at(-1);assert.equal(product.category,'souvenir');assert.equal(product.categoryName,'Suvenir');assert.equal(product.sizes,undefined);assert.equal(product.image,'/uploads/new-image.webp');await until(()=>!f.d.querySelector('#editor').open);assert.match(f.d.querySelector('#items').textContent,/Yangi krujka/);assert.deepEqual(f.errors,[]);}finally{await new Promise(setImmediate);f.dom.window.close();}
});
test('banner ordering persists and does not touch another section',async()=>{
 const f=await fixture();try{f.d.querySelector('[data-tab=banners]').click();f.d.querySelector('[data-move="1"][data-delta="-1"]').click();await until(()=>f.writes.length===1);assert.equal(f.writes[0].url,'/api/admin/banners');assert.equal(f.writes[0].body[0].id,'two');assert.deepEqual(f.errors,[]);}finally{await new Promise(setImmediate);f.dom.window.close();}
});
test('news starts as a draft and team members can be maintained',async()=>{
 const f=await fixture();try{f.d.querySelector('[data-tab=news]').click();f.d.querySelector('#addEntry').click();assert.equal(f.d.querySelector('[name=status]').value,'draft');f.d.querySelector('[name=title]').value='Yangi yangilik';f.d.querySelector('[name=body]').value='To‘liq maqola matni.';f.d.querySelector('#saveEntry').click();await until(()=>f.writes.length===1);assert.equal(f.writes[0].body[0].status,'draft');await until(()=>!f.d.querySelector('#editor').open);
 f.d.querySelector('[data-tab=team]').click();f.d.querySelector('#addEntry').click();f.d.querySelector('[name=name]').value='Sinov Ishtirokchi';f.d.querySelector('[name=role]').value='Dizayner';f.d.querySelector('[name=skills]').value='Dizayn, CSS';f.d.querySelector('#saveEntry').click();await until(()=>f.writes.length===2);assert.deepEqual(Array.from(f.writes[1].body[0].skills),['Dizayn','CSS']);assert.equal(f.writes[1].body[0].initials,'SI');assert.deepEqual(f.errors,[]);}finally{await new Promise(setImmediate);f.dom.window.close();}
});
test('order details show selected size and update only order status fields',async()=>{
 const f=await fixture();try{f.d.querySelector('[data-tab=orders]').click();assert.equal(f.d.querySelector('#addEntry').hidden,true);f.d.querySelector('[data-edit="0"]').click();assert.match(f.d.querySelector('.admin-order-items').textContent,/M × 1/);f.d.querySelector('[name=status]').value='confirmed';f.d.querySelector('[name=paymentStatus]').value='paid';f.d.querySelector('#saveEntry').click();await until(()=>f.writes.length===1);assert.equal(f.writes[0].url,'/api/admin/orders/DX-ADMIN-TEST');assert.deepEqual(f.writes[0].body,{status:'confirmed',paymentStatus:'paid'});assert.deepEqual(f.errors,[]);}finally{await new Promise(setImmediate);f.dom.window.close();}
});
