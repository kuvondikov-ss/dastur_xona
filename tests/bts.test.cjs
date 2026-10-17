const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createApp}=require('../server');
const authorization='Basic '+Buffer.from('bts-review:local-test-password').toString('base64');
process.env.ADMIN_USER='bts-review';process.env.ADMIN_PASSWORD='local-test-password';
const settings={enabled:true,baseUrl:'https://mock.bts.uz',login:'test-only-login',password:'test-only-password',senderName:'Sinov jo‘natuvchi',senderPhone:'+998901234567',senderAddress:'Sinov ko‘chasi 1',senderCityCode:'0101',pickupType:'courier',defaultWeightKg:.4};
async function fixture(t){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'dx-bts-'));
 const db=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/db.json')));
 db.products=[{id:'gift',name:'Sinov krujkasi',price:50000,physical:true,weightKg:.5,stock:20,category:'souvenir'},{id:'digital',name:'Raqamli mahsulot',price:10000,physical:false,category:'digital',stock:20}];db.orders=[];
 fs.writeFileSync(path.join(directory,'db.json'),JSON.stringify(db));
 const state={calls:[],addMode:'ok',addCount:0,loginCount:0,refreshCount:0,unavailable:false,denyOnce:false};let clock=Date.now();
 const respond=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>({status:status<400,data})});
 const btsFetch=async(url,options={})=>{
  const u=new URL(url),body=options.body?JSON.parse(options.body):null;state.calls.push({url:u.href,path:u.pathname,body,headers:options.headers});
  assert.equal(u.hostname,'mock.bts.uz','Tests must never contact the real BTS API');
  if(u.pathname==='/auth/login'){state.loginCount++;assert.deepEqual(body,{login:settings.login,password:settings.password});return respond({access_token:'test-access',refresh_token:'test-refresh'});}
  if(u.pathname==='/auth/refresh'){state.refreshCount++;assert.equal(body.refresh_token,'test-refresh');return respond({access_token:'refreshed-access',refresh_token:'refreshed-refresh'});}
  assert.match(options.headers.Authorization,/^Bearer /);assert.equal(options.headers.language,'uz');
  if(state.denyOnce){state.denyOnce=false;return respond({},401);}
  if(u.pathname.endsWith('/regions'))return respond({items:[{code:'01',name:'Toshkent shahri'},{code:'70',name:'Qashqadaryo'}],_meta:{pageCount:1}});
  if(u.pathname.endsWith('/cities'))return respond({items:u.searchParams.get('regionCode')==='01'?[{code:'0101',name:'Sinov tumani'}]:[{code:'7001',name:'Boshqa tuman'}],_meta:{pageCount:1}});
  if(u.pathname.endsWith('/branches'))return respond({items:[{code:u.searchParams.get('page')==='1'?'0104':'0105',name:'Sinov filiali',regionCode:'01',cityCode:'0101',address:'Filial ko‘chasi 24'}],_meta:{pageCount:2}});
  if(u.pathname==='/v1/order-calculate/index')return respond({courier_to_courier:{available:!state.unavailable,price:25000},courier_to_branch:{available:!state.unavailable,price:15000}});
  if(u.pathname==='/v1/order/add'){
   state.addCount++;if(state.onAdd)await state.onAdd();
   if(state.addMode==='network')throw new TypeError('Simulated connection loss');
   if(state.addMode==='validation')return respond({},422);
   return respond({orderId:12345,barcode:'01000012345',tracking:'https://bts.uz/uz/waybill-tracking?term=test',cost:25000,status:{code:100,info:'Jo‘natuvchida'}});
  }
  if(u.pathname==='/v1/order/track')return respond({orderId:12345,status:{code:400,name:'BTS filialida'}});
  throw Error('Unexpected mock request '+u.pathname);
 };
 let server,base;
 const start=async()=>{server=createApp({dataDir:directory,btsFetch,now:()=>clock}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port;};
 await start();t.after(async()=>{await new Promise(r=>server.close(r));fs.rmSync(directory,{recursive:true,force:true});});
 const call=async(url,{body,admin=false,method=body?'POST':'GET',headers={}}={})=>{const r=await fetch(base+url,{method,headers:{...(admin?{Authorization:authorization}:{}),...(body?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};};
 const configure=body=>call('/api/admin/bts/settings',{method:'PUT',admin:true,body:{...settings,...body}});
 const quote=body=>call('/api/shipping/bts/quote',{body:{regionCode:'01',cityCode:'0101',dropoffType:'courier',items:[{id:'gift',qty:2}],...body}});
 const place=async(q,extra={})=>call('/api/orders',{body:{customer:'Sinov xaridor',phone:'+998901234567',address:'Ko‘cha 24, uy 3',consent:true,delivery:q.destination.dropoffType==='branch'?'bts_branch':'bts_courier',items:[{id:'gift',qty:2}],shipping:{quoteId:q.quoteId},...extra}});
 const confirm=ref=>call('/api/admin/orders/'+ref,{method:'PATCH',admin:true,body:{status:'confirmed',paymentStatus:'paid'}});
 const send=ref=>call('/api/admin/orders/'+ref+'/bts',{method:'POST',admin:true,body:{}});
 return {state,call,configure,quote,place,confirm,send,directory,advance:ms=>clock+=ms,restart:async()=>{await new Promise(r=>server.close(r));await start();}};
}
test('BTS credentials stay private, are admin-only and survive a restart',async t=>{
 const f=await fixture(t);assert.equal((await f.call('/api/admin/bts/settings')).status,401);
 assert.equal((await f.call('/api/catalog')).data.shipping.bts.enabled,false);
 const saved=await f.configure();assert.equal(saved.status,200);assert.equal(saved.data.hasPassword,true);assert.equal(saved.data.password,undefined);
 assert.equal(fs.statSync(path.join(f.directory,'bts-config.json')).mode&0o777,0o600);
 const publicData=JSON.stringify((await f.call('/api/catalog')).data);assert(!publicData.includes(settings.password));assert(!publicData.includes(settings.login));
 assert.equal((await f.configure({baseUrl:'https://attacker.invalid'})).status,400);
 await f.configure({password:''});await f.restart();assert.equal((await f.call('/api/catalog')).data.shipping.bts.enabled,true);
 const result=await f.call('/api/admin/bts/test',{admin:true,method:'POST'});assert.equal(result.status,200);assert.equal(result.data.ok,true);
});
test('test API is never advertised as real customer delivery',async t=>{
 const f=await fixture(t);const result=await f.configure({baseUrl:'https://apitest.bts.uz:28345'});assert.equal(result.data.testMode,true);
 assert.equal((await f.call('/api/catalog')).data.shipping.bts.enabled,false);assert.equal((await f.quote()).status,503);assert.equal(f.state.calls.length,0);
});
test('BTS authentication is shared, 401 refreshes once and branch pagination is complete',async t=>{
 const f=await fixture(t);await f.configure();f.state.denyOnce=true;
 await Promise.all([f.call('/api/shipping/bts/regions'),f.call('/api/shipping/bts/cities?regionCode=01')]);
 assert.equal(f.state.loginCount,1);assert.equal(f.state.refreshCount,1);
 const branches=await f.call('/api/shipping/bts/branches?regionCode=01&cityCode=0101');assert.equal(branches.data.items.length,2);
 assert.equal((await f.quote({regionCode:'70',cityCode:'0101'})).status,400);
});
test('signed BTS quote binds destination, quantity, prices and expiration',async t=>{
 const f=await fixture(t);await f.configure();const q=(await f.quote()).data;assert.equal(q.price,25000);
 const calc=f.state.calls.find(c=>c.path==='/v1/order-calculate/index');assert.equal(calc.body.weight,1);assert.equal(calc.body.is_multiple_cost,1);
 assert.equal((await f.place(q,{items:[{id:'gift',qty:1}]})).status,409);
 assert.equal((await f.place({...q,quoteId:q.quoteId+'changed'})).status,409);
 assert.equal((await f.place(q,{delivery:'bts_branch'})).status,400);
 const result=await f.place(q,{shippingFee:1});assert.equal(result.status,201);assert.equal(result.data.order.shippingFee,25000);assert.equal(result.data.order.total,100000);assert.equal(f.state.addCount,0);
 const another=(await f.quote()).data;f.advance(16*60*1000);assert.equal((await f.place(another)).status,409);
});
test('BTS branch order takes its address from the validated branch and includes only physical goods',async t=>{
 const f=await fixture(t);await f.configure();const items=[{id:'gift',qty:2},{id:'digital',qty:1}];
 const q=(await f.quote({dropoffType:'branch',branchCode:'0105',items})).data;
 const placed=await f.place(q,{address:'forged address',email:'buyer@example.test',items});assert.equal(placed.status,201);
 assert.match(placed.data.order.address,/Filial ko‘chasi 24/);assert(!placed.data.order.address.includes('forged'));assert.equal(placed.data.order.shippingFee,15000);
 assert.equal((await f.send(placed.data.order.ref)).status,409);await f.confirm(placed.data.order.ref);
 assert.equal((await f.send(placed.data.order.ref)).status,200);
 const body=f.state.calls.find(c=>c.path==='/v1/order/add').body;assert.equal(body.receiver.branch_code,'0105');assert.equal(body.cargo.postTypes.length,1);assert.equal(body.bringBackMoney,0);assert.equal(body.clientId,placed.data.order.ref);
});
test('BTS create is authorized, duplicate-safe and preserves orders received while awaiting BTS',async t=>{
 const f=await fixture(t);await f.configure();const order=(await f.place((await f.quote()).data)).data.order;await f.confirm(order.ref);
 assert.equal((await f.call('/api/admin/orders/'+order.ref+'/bts',{method:'POST',body:{}})).status,401);
 let release,entered;const started=new Promise(r=>entered=r);f.state.onAdd=()=>{entered();return new Promise(r=>release=r);};
 const first=f.send(order.ref);await started;assert.equal((await f.send(order.ref)).status,409);
 await f.call('/api/orders',{body:{customer:'Boshqa xaridor',phone:'+998901234567',delivery:'pickup',consent:true,items:[{id:'gift',qty:1}]}});
 release();assert.equal((await first).status,200);assert.equal((await f.send(order.ref)).status,200);assert.equal(f.state.addCount,1);
 assert.equal(JSON.parse(fs.readFileSync(path.join(f.directory,'db.json'))).orders.length,2);
 assert.equal((await f.call('/api/orders/'+order.ref)).status,404);
 const publicState=(await f.call('/api/orders/'+order.ref,{headers:{'X-Order-Token':order.token}})).data.shipping;
 assert.equal(publicState.barcode,'01000012345');assert.equal(publicState.baseUrl,undefined);assert.equal(publicState.cargo,undefined);
 const tracked=await f.call('/api/admin/orders/'+order.ref+'/bts/refresh',{admin:true,method:'POST'});assert.equal(tracked.data.shipping.status.code,400);
});
test('uncertain create is persisted and cannot create another shipment, even after restart',async t=>{
 const f=await fixture(t);await f.configure();const order=(await f.place((await f.quote()).data)).data.order;await f.confirm(order.ref);
 f.state.addMode='network';assert.equal((await f.send(order.ref)).status,502);
 const saved=JSON.parse(fs.readFileSync(path.join(f.directory,'db.json'))).orders[0];assert.equal(saved.shipping.state,'uncertain');
 await f.restart();assert.equal((await f.send(order.ref)).status,409);assert.equal(f.state.addCount,1);
});
test('unavailable tariff does not become free delivery and old manual/pickup orders still work',async t=>{
 const f=await fixture(t);await f.configure();f.state.unavailable=true;assert.equal((await f.quote()).status,422);
 for(const delivery of ['ship','pickup'])assert.equal((await f.call('/api/orders',{body:{customer:'Sinov xaridor',phone:'+998901234567',delivery,address:'Sinov ko‘chasi 25',consent:true,items:[{id:'gift',qty:1}]}})).status,201);
 assert.equal(f.state.addCount,0);
});
test('a deployment during an in-flight create keeps the shipment blocked for reconciliation',async t=>{
 const f=await fixture(t);await f.configure();const order=(await f.place((await f.quote()).data)).data.order;await f.confirm(order.ref);
 const file=path.join(f.directory,'db.json'),db=JSON.parse(fs.readFileSync(file));db.orders[0].shipping.state='creating';fs.writeFileSync(file,JSON.stringify(db));
 await f.restart();assert.equal(JSON.parse(fs.readFileSync(file)).orders[0].shipping.state,'uncertain');assert.equal((await f.send(order.ref)).status,409);assert.equal(f.state.addCount,0);
});
