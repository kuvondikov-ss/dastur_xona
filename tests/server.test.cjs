const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createApp}=require('../server');
let directory,server,base;
const authorization='Basic '+Buffer.from('review-user:review-password').toString('base64');
async function call(url,options={}){const response=await fetch(base+url,options);return {response,data:await response.json()};}
before(async()=>{
 directory=fs.mkdtempSync(path.join(os.tmpdir(),'dx-api-'));
 const db=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/db.json')));
 db.products.push({id:'souvenir-empty-size',name:'Sinov suveniri',price:10000,category:'suvenir',physical:true,sizes:[],stock:2,image:'/uploads/example.webp'});
 db.news=Array.from({length:12},(_,i)=>({slug:'article-'+i,title:i===0?'O‘rganish yangiliklari':'Yangilik '+i,body:'Maqola matni',excerpt:'Jamoamizdan xabar',category:i%2?'loyiha':'jamoa',status:i===11?'draft':'published',publishedAt:new Date(2026,8,i+1).toISOString()}));
 db.orders=[{ref:'PRESERVED',status:'new',token:'existing-token',items:[]}];
 fs.writeFileSync(path.join(directory,'db.json'),JSON.stringify(db));
 process.env.ADMIN_USER='review-user';process.env.ADMIN_PASSWORD='review-password';
 server=createApp({dataDir:directory}).listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));base='http://127.0.0.1:'+server.address().port;
});
after(async()=>{await new Promise(resolve=>server.close(resolve));fs.rmSync(directory,{recursive:true,force:true});});
test('catalog normalizes legacy categories and empty sizes without rewriting stored records',async()=>{
 const {data}=await call('/api/catalog');const p=data.products.find(x=>x.id==='souvenir-empty-size');assert.equal(p.category,'souvenir');assert.equal(p.sizes,undefined);assert.equal(p.image,'/uploads/example.webp');assert(fs.readFileSync(path.join(directory,'db.json'),'utf8').includes('PRESERVED'));
});
test('news count, pagination, accent-insensitive search, categories and article reload',async()=>{
 const {data}=await call('/api/news?limit=3&page=2');assert.equal(data.total,11);assert.equal(data.items.length,3);assert.equal(data.page,2);
 const result=await call('/api/news?q=organish&category=jamoa');assert.equal(result.data.total,1);assert.equal(result.data.items[0].slug,'article-0');
 assert.equal((await call('/api/news/article-0')).response.status,200);assert.equal((await call('/api/news/article-11')).response.status,404);assert.equal((await call('/api/unknown')).response.status,404);
});
test('uploads are authenticated, persisted and served as images',async()=>{
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8hoAAAAASUVORK5CYII=','base64');
 assert.equal((await call('/api/admin/upload',{method:'POST',headers:{'Content-Type':'image/png'},body:png})).response.status,401);
 const {data,response}=await call('/api/admin/upload',{method:'POST',headers:{Authorization:authorization,'Content-Type':'image/png'},body:png});assert.equal(response.status,200);const image=await fetch(base+data.url);assert.equal(image.status,200);assert.match(image.headers.get('content-type'),/^image\/png/);
});
test('order requires explicit size, uses catalog price and deduplicates retry',async()=>{
 const payload={customer:'Sinov xaridor',phone:'+998901234567',email:'',address:'',delivery:'pickup',consent:true,items:[{id:'merch-tshirt-blue',qty:1,unitPrice:1}]};
 const send=body=>call('/api/orders',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':'regression-order-1'},body:JSON.stringify(body)});
 assert.equal((await send(payload)).response.status,400);
 payload.items[0].size='M';const first=await send(payload),retry=await send(payload);assert.equal(first.response.status,201);assert.equal(retry.data.order.ref,first.data.order.ref);assert.equal(first.data.order.total,179000);assert.equal(first.data.order.paymentStatus,'unpaid');
 const db=JSON.parse(fs.readFileSync(path.join(directory,'db.json')));assert.equal(db.orders.length,2);assert(db.orders.some(x=>x.ref==='PRESERVED'));
 const state=await call('/api/orders/'+first.data.order.ref,{headers:{'X-Order-Token':first.data.order.token}});assert.equal(state.data.status,'new');assert.equal((await call('/api/orders/'+first.data.order.ref)).response.status,404);
 const update=await call('/api/admin/orders/'+first.data.order.ref,{method:'PATCH',headers:{Authorization:authorization,'Content-Type':'application/json'},body:JSON.stringify({status:'confirmed',paymentStatus:'paid'})});assert.equal(update.response.status,200);
 const updated=await call('/api/orders/'+first.data.order.ref,{headers:{'X-Order-Token':first.data.order.token}});assert.equal(updated.data.paymentStatus,'paid');
});
test('souvenir without sizes can be ordered, unavailable quantity is rejected',async()=>{
 const payload={customer:'Sinov xaridor',phone:'+998901234567',delivery:'pickup',consent:true,items:[{id:'souvenir-empty-size',qty:1}]};
 const options=body=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await call('/api/orders',options(payload))).response.status,201);payload.items[0].qty=3;assert.equal((await call('/api/orders',options(payload))).response.status,409);
});
test('admin validates prices and normalizes product category on save',async()=>{
 const {data}=await call('/api/admin/data',{headers:{Authorization:authorization}});const products=data.products.map(p=>({...p}));products[0].price=-1;
 const put=list=>call('/api/admin/products',{method:'PUT',headers:{Authorization:authorization,'Content-Type':'application/json'},body:JSON.stringify(list)});
 assert.equal((await put(products)).response.status,400);products[0].price=179000;assert.equal((await put(products)).response.status,200);const product=JSON.parse(fs.readFileSync(path.join(directory,'db.json'))).products.find(p=>p.id==='souvenir-empty-size');assert.equal(product.category,'souvenir');assert.equal(product.sizes,undefined);
});
