const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {createBts,BtsError,publicShipment}=require('./bts');
const ROOT = __dirname;
const ORDER_STATUSES = ['new', 'confirmed', 'processing', 'shipped', 'completed', 'cancelled'];
const fold = value => String(value || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f’‘ʻʼ'`]/g, '').trim();
function normalizeProduct(product) {
  const p = {...product};
  p.category = ({suvenir:'souvenir',souvenir:'souvenir',digital:'digital',merch:'merch'})[p.category] || 'merch';
  p.categoryName = ({merch:'Merch',souvenir:'Suvenir',digital:'Raqamli'})[p.category];
  for (const key of ['sizes','colors']) {
    if (Array.isArray(p[key])) p[key] = p[key].filter(Boolean);
    if (!p[key]?.length) delete p[key];
  }
  return p;
}
function normalizeProject(project) {
  const p = project && typeof project === 'object' ? project : {};
  return {...p,id:String(p.id||p.slug||'project'),name:String(p.name||'IT loyiha'),description:String(p.description||''),status:String(p.status||'development'),kind:['crm','portfolio','bot'].includes(p.kind)?p.kind:'bot',tags:Array.isArray(p.tags)?p.tags:[],features:Array.isArray(p.features)?p.features:[],creator:p.creator||null,productId:p.productId||null};
}
function createApp(options = {}) {
  const app = express();
  const dataDir = options.dataDir || process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(ROOT,'data');
  const dbFile = path.join(dataDir,'db.json'), uploadDir = path.join(dataDir,'uploads');
  fs.mkdirSync(uploadDir,{recursive:true});
  const bts=createBts({dataDir,fetchImpl:options.btsFetch,now:options.now,timeout:options.btsTimeout});
  if (!fs.existsSync(dbFile)) fs.copyFileSync(path.join(ROOT,'data/db.json'),dbFile);
  const read = () => JSON.parse(fs.readFileSync(dbFile,'utf8'));
  const write = db => {const tmp=dbFile+'.tmp';fs.writeFileSync(tmp,JSON.stringify(db,null,2));fs.renameSync(tmp,dbFile);};
  const initialDb=read();let interruptedShipment=false;
  for(const order of initialDb.orders||[])if(order.shipping?.provider==='bts'&&order.shipping.state==='creating'){
    order.shipping.state='uncertain';order.shipping.error='Server qayta ishga tushgan. BTS kabinetida buyurtma raqamini tekshiring.';interruptedShipment=true;
  }
  if(interruptedShipment)write(initialDb);
  function auth(req,res,next) {
    const header=req.headers.authorization||'';
    if(!header.startsWith('Basic ')) return res.status(401).json({error:'Admin panelga kiring.'});
    const decoded=Buffer.from(header.slice(6),'base64').toString(), separator=decoded.indexOf(':');
    if(separator<0||decoded.slice(0,separator)!==(process.env.ADMIN_USER||'admin')||decoded.slice(separator+1)!==(process.env.ADMIN_PASSWORD||'change-this-password')) return res.status(403).json({error:'Login yoki parol noto‘g‘ri.'});
    next();
  }
  app.disable('x-powered-by');
  app.use(express.json({limit:'1mb'}));
  app.use('/api',(req,res,next)=>{res.set('Cache-Control','no-store');next();});
  app.get('/api/health',(req,res)=>res.json({ok:true,service:'dasturxona'}));
  app.get('/api/catalog',(req,res)=>{const db=read();res.json({api:'dasturxona',products:(db.products||[]).map(normalizeProduct),projects:(db.projects||[]).map(normalizeProject),team:db.team||[],settings:db.settings||{},banners:db.banners||[],shipping:{bts:bts.publicConfig()}});});
  app.get('/api/shipping/bts/:directory',async(req,res)=>res.json({items:await bts.directory(req.params.directory,req.query)}));
  app.post('/api/shipping/bts/quote',async(req,res)=>res.json(await bts.quote(req.body||{},(read().products||[]).map(normalizeProduct))));
  app.get('/api/admin/bts/settings',auth,(req,res)=>res.json(bts.adminConfig()));
  app.put('/api/admin/bts/settings',auth,(req,res)=>res.json(bts.saveConfig(req.body||{})));
  app.post('/api/admin/bts/test',auth,async(req,res)=>res.json(await bts.testConnection()));
  app.get('/api/news',(req,res)=>{
    const query=fold(req.query.q),selected=req.query.category;
    const limit=Math.max(1,Math.min(50,Math.trunc(Number(req.query.limit)||9)));
    const list=(read().news||[]).filter(n=>n.status!=='draft'&&(!selected||n.category===selected)&&(!query||fold(n.title+' '+(n.excerpt||'')+' '+(n.body||'')).includes(query))).sort((a,b)=>(Date.parse(b.publishedAt)||0)-(Date.parse(a.publishedAt)||0));
    const page=Math.min(Math.max(1,Math.ceil(list.length/limit)),Math.max(1,Math.trunc(Number(req.query.page)||1)));
    res.json({items:list.slice((page-1)*limit,page*limit),total:list.length,page,limit});
  });
  app.get('/api/news/:slug',(req,res)=>{const article=(read().news||[]).find(n=>n.slug===req.params.slug&&n.status!=='draft');if(!article)return res.status(404).json({error:'Yangilik topilmadi.'});res.json(article);});
  app.post('/api/orders',(req,res)=>{
    const db=read(),body=req.body||{},key=String(req.header('Idempotency-Key')||'').slice(0,100);
    const previous=key&&(db.orders||[]).find(o=>o.idempotencyKey===key);
    if(previous)return res.json({order:previous});
    const customer=String(body.customer||'').trim(),phone=String(body.phone||'').replace(/[^\d+]/g,'');
    if(customer.length<2||customer.length>80||!/^\+?998\d{9}$/.test(phone)||body.consent!==true||!Array.isArray(body.items)||!body.items.length||body.items.length>50)return res.status(400).json({error:'Aloqa ma’lumotlari va mahsulotlarni tekshiring.'});
    const products=(db.products||[]).map(normalizeProduct),quantities=new Map(),items=[];
    for(const item of body.items){
      const product=products.find(p=>p.id===item.id);
      if(!product||!Number.isInteger(item.qty)||item.qty<1||item.qty>20||(product.sizes&&!product.sizes.includes(item.size))||(product.colors&&!product.colors.includes(item.color)))return res.status(400).json({error:'Mahsulot, o‘lcham, rang yoki miqdorni qayta tanlang.'});
      const qty=(quantities.get(product.id)||0)+item.qty;
      if(qty>20||(Number.isInteger(product.stock)&&qty>product.stock))return res.status(409).json({error:product.name+': tanlangan miqdor mavjud emas.'});
      quantities.set(product.id,qty);
      items.push({id:product.id,qty:item.qty,size:product.sizes?item.size:'',color:product.colors?item.color:'',productName:product.name,unitPrice:Number(product.price)||0,physical:Boolean(product.physical)});
    }
    const physical=items.some(i=>products.find(p=>p.id===i.id).physical),digital=items.some(i=>!products.find(p=>p.id===i.id).physical);
    const email=String(body.email||'').trim().slice(0,150);
    if((digital||email)&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:'To‘g‘ri elektron pochta kiriting.'});
    const delivery=physical?body.delivery:'digital';let address=['ship','bts_courier'].includes(delivery)?String(body.address||'').trim().slice(0,240):'',shipping;
    if(physical&&(!['ship','pickup','bts_courier','bts_branch'].includes(delivery)||(['ship','bts_courier'].includes(delivery)&&address.length<8)))return res.status(400).json({error:'Qabul qilish usuli va manzilni tekshiring.'});
    if(delivery==='bts_courier'||delivery==='bts_branch'){
      shipping=bts.verifyQuote(body.shipping?.quoteId,body.items,products);
      if(shipping.dropoffType!==delivery.slice(4))return res.status(400).json({error:'BTS yetkazish usuli o‘zgargan. Narxni qayta hisoblang.'});
      address=delivery==='bts_branch'?[shipping.regionName,shipping.cityName,shipping.branchName,shipping.branchAddress].filter(Boolean).join(', '):[shipping.regionName,shipping.cityName,address].join(', ');
    }
    const createdAt=new Date().toISOString(),shippingFee=shipping?shipping.quotedFee:physical&&delivery==='ship'?db.settings?.shippingFee??null:0;
    const order={ref:'DX-'+crypto.randomBytes(6).toString('hex').toUpperCase(),token:crypto.randomBytes(18).toString('hex'),idempotencyKey:key,status:'new',paymentStatus:'unpaid',serverSaved:true,createdAt,date:createdAt,customer,phone,email,address,consent:true,deliveryMethod:delivery,delivery:shipping?(shipping.dropoffType==='branch'?'BTS filialidan olish':'BTS kuryeri — manzilga yetkazish'):delivery==='pickup'?'Kelishilgan joydan olib ketish':delivery==='digital'?'Raqamli mahsulot':'Manzilga yetkazish',shippingFee,items,total:items.reduce((sum,i)=>sum+i.unitPrice*i.qty,0),...(shipping?{shipping}:{})};
    db.orders||=[];db.orders.unshift(order);write(db);res.status(201).json({order});
  });
  app.get('/api/orders/:ref',async(req,res)=>{
    let o=(read().orders||[]).find(o=>o.ref===req.params.ref&&o.token===req.header('X-Order-Token'));
    if(!o)return res.status(404).json({error:'Buyurtma topilmadi.'});
    let shippingRefreshError=false;
    if(req.query.refreshShipping==='1'&&o.shipping?.orderId&&Date.now()-Date.parse(o.shipping.lastCheckedAt||0)>60000){
      try{const result=await bts.track(o.shipping),db=read();o=db.orders.find(x=>x.ref===o.ref);o.shipping={...o.shipping,...result};write(db);}catch{shippingRefreshError=true;}
    }
    res.json({ref:o.ref,status:o.status,paymentStatus:o.paymentStatus||'unpaid',createdAt:o.createdAt,shipping:publicShipment(o.shipping),...(shippingRefreshError?{shippingRefreshError:true}:{})});
  });
  const shippingInFlight=new Set();
  app.post('/api/admin/orders/:ref/bts',auth,async(req,res)=>{
    const db=read(),order=(db.orders||[]).find(o=>o.ref===req.params.ref);
    if(!order?.shipping||order.shipping.provider!=='bts')return res.status(400).json({error:'Buyurtmada BTS yetkazish tanlanmagan.'});
    if(order.shipping.orderId)return res.json({shipping:order.shipping});
    if(shippingInFlight.has(order.ref)||['creating','uncertain'].includes(order.shipping.state))return res.status(409).json({error:'BTS so‘rovi avval yuborilgan. Takrorlamasdan BTS kabinetida '+order.ref+' buyurtmasini tekshiring.'});
    if(!['confirmed','processing'].includes(order.status))return res.status(409).json({error:'Avval buyurtmani tasdiqlang va holatini saqlang.'});
    shippingInFlight.add(order.ref);order.shipping={...order.shipping,state:'creating',attemptedAt:new Date().toISOString()};write(db);
    let result;
    try{result=await bts.createShipment(order);}catch(e){
      const latest=read(),saved=latest.orders.find(o=>o.ref===order.ref);
      saved.shipping={...saved.shipping,state:e.uncertain?'uncertain':'error',error:e instanceof BtsError?e.message:'BTS jo‘natmasi yaratilmadi.'};write(latest);
      shippingInFlight.delete(order.ref);throw e;
    }
    // Re-read after the network request to preserve other orders and admin edits.
    try{const latest=read(),saved=latest.orders.find(o=>o.ref===order.ref);saved.shipping={...saved.shipping,...result,error:''};write(latest);res.json({shipping:saved.shipping});}finally{shippingInFlight.delete(order.ref);}
  });
  app.post('/api/admin/orders/:ref/bts/refresh',auth,async(req,res)=>{
    const order=(read().orders||[]).find(o=>o.ref===req.params.ref);
    if(!order?.shipping?.orderId)return res.status(400).json({error:'BTS jo‘natmasi hali yaratilmagan.'});
    const result=await bts.track(order.shipping),latest=read(),saved=latest.orders.find(o=>o.ref===order.ref);
    saved.shipping={...saved.shipping,...result};write(latest);res.json({shipping:saved.shipping});
  });
  app.post('/api/admin/upload',auth,express.raw({type:['image/jpeg','image/png','image/webp','image/gif'],limit:'5mb'}),(req,res)=>{
    const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'}[req.headers['content-type']];
    if(!ext||!Buffer.isBuffer(req.body)||!req.body.length)return res.status(400).json({error:'JPEG, PNG, WebP yoki GIF rasm yuboring.'});
    const filename=crypto.randomBytes(16).toString('hex')+'.'+ext;fs.writeFileSync(path.join(uploadDir,filename),req.body);res.json({url:'/uploads/'+filename});
  });
  app.get('/api/admin/data',auth,(req,res)=>res.json(read()));
  app.put('/api/admin/:section',auth,(req,res)=>{
    const section=req.params.section,db=read();
    if(!['products','projects','news','team','settings','banners'].includes(section))return res.status(400).json({error:'Bo‘lim topilmadi.'});
    if((section==='settings'&&(!req.body||typeof req.body!=='object'||Array.isArray(req.body)))||(section!=='settings'&&!Array.isArray(req.body)))return res.status(400).json({error:'Ma’lumot shakli noto‘g‘ri.'});
    let value=req.body;
    if(section==='products'){
      if(value.some(p=>!p.id||!String(p.name||'').trim()||!Number.isFinite(p.price)||p.price<0||(p.stock!=null&&(!Number.isInteger(p.stock)||p.stock<0))||(p.weightKg!=null&&(!Number.isFinite(p.weightKg)||p.weightKg<.001||p.weightKg>10000))))return res.status(400).json({error:'Mahsulot nomi, narxi, vazni va mavjud sonini tekshiring.'});
      value=value.map(normalizeProduct);
    }
    if(section==='news'&&value.some(n=>!n.slug||!String(n.title||'').trim()||!String(n.body||'').trim()||!['jamoa','mahsulot','loyiha','tadbir'].includes(n.category)))return res.status(400).json({error:'Yangilik sarlavhasi, matni va kategoriyasini tekshiring.'});
    if(section==='banners'&&(value.length>15||value.some(b=>!b||typeof b!=='object'||!String(b.title||'').trim())))return res.status(400).json({error:'Slayderga sarlavhali 15 tagacha banner qo‘shish mumkin.'});
    if(section==='projects')value=value.map(normalizeProject);
    db[section]=value;write(db);res.json({ok:true});
  });
  app.patch('/api/admin/orders/:ref',auth,(req,res)=>{
    const db=read(),order=(db.orders||[]).find(o=>o.ref===req.params.ref);
    if(!order)return res.status(404).json({error:'Buyurtma topilmadi.'});
    if(order.shipping?.state==='creating')return res.status(409).json({error:'BTS jo‘natmasi yaratilmoqda. Holatni yangilashdan oldin javobni kuting.'});
    if(!ORDER_STATUSES.includes(req.body.status)||!['unpaid','paid','refunded'].includes(req.body.paymentStatus))return res.status(400).json({error:'Buyurtma holati noto‘g‘ri.'});
    order.status=req.body.status;order.paymentStatus=req.body.paymentStatus;write(db);res.json({ok:true});
  });
  app.use('/api',(req,res)=>res.status(404).json({error:'Manzil topilmadi.'}));
  app.use('/uploads',express.static(uploadDir,{fallthrough:false}));
  app.use(express.static(path.join(ROOT,'public'),{setHeaders(res,file){if(/\.(html|css|js)$/.test(file))res.set('Cache-Control','no-cache');}}));
  app.get('/admin',(req,res)=>res.sendFile(path.join(ROOT,'public/admin.html')));
  app.use((req,res)=>res.sendFile(path.join(ROOT,'public/index.html')));
  app.use((err,req,res,next)=>{
    const shippingUnavailable=err instanceof BtsError&&req.path.startsWith('/api/shipping/')&&(err.status===401||err.status>=500);
    res.status(shippingUnavailable?503:err.status||500).json({error:shippingUnavailable?'BTS yetkazish xizmatiga hozir ulanish imkoni bo‘lmadi. Boshqa qabul qilish usulini tanlang yoki keyinroq urinib ko‘ring.':err instanceof BtsError?err.message:err.status===413?'Fayl hajmi ruxsat etilgan chegaradan oshdi.':'So‘rov bajarilmadi.'});
  });
  return app;
}
if(require.main===module)createApp().listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('DasturXona started'));
module.exports={createApp,normalizeProduct,normalizeProject};
