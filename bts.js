'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const TEST_API='https://apitest.bts.uz:28345';
class BtsError extends Error {
  constructor(message,status=502,uncertain=false){super(message);this.status=status;this.uncertain=uncertain;}
}
const code=value=>/^[A-Za-z0-9]{1,30}$/.test(String(value||''));
const digest=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function apiBase(value){
  try{
    const u=new URL(value||TEST_API);
    if(u.protocol==='https:'&&(u.hostname==='bts.uz'||u.hostname.endsWith('.bts.uz'))&&!u.username&&!u.password&&!u.search&&!u.hash&&u.pathname==='/')return u.origin;
  }catch{}
  throw new BtsError('BTS API manzili https:// protokoli va bts.uz domenida bo‘lishi kerak.',400);
}
function createBts({dataDir,fetchImpl=globalThis.fetch,now=()=>Date.now(),timeout=10000}){
  const configFile=path.join(dataDir,'bts-config.json'),keyFile=path.join(dataDir,'bts-signing-key');
  if(!fs.existsSync(keyFile))fs.writeFileSync(keyFile,crypto.randomBytes(32),{mode:0o600,flag:'wx'});
  const signingKey=fs.readFileSync(keyFile),cache=new Map();
  let tokens=null,authPromise=null;
  function config(){
    const saved=fs.existsSync(configFile)?JSON.parse(fs.readFileSync(configFile,'utf8')):{};
    return {enabled:false,baseUrl:process.env.BTS_API_BASE_URL||TEST_API,login:process.env.BTS_API_LOGIN||'',password:process.env.BTS_API_PASSWORD||'',senderName:'',senderPhone:'',senderAddress:'',senderCityCode:'',senderBranchCode:'',pickupType:'courier',defaultWeightKg:null,lengthCm:null,widthCm:null,heightCm:null,packageId:null,postTypeId:null,...saved};
  }
  const isTest=c=>new URL(c.baseUrl).hostname.startsWith('apitest.');
  function missing(c){
    const fields=[];
    for(const [key,label] of [['login','API login'],['password','API parol'],['senderName','jo‘natuvchi nomi'],['senderPhone','jo‘natuvchi telefoni'],['senderAddress','jo‘natuvchi manzili'],['senderCityCode','jo‘natuvchi tuman kodi']])if(!c[key])fields.push(label);
    if(c.pickupType==='branch'&&!c.senderBranchCode)fields.push('jo‘natuvchi filial kodi');
    if(!(c.defaultWeightKg>0))fields.push('standart mahsulot vazni');
    return fields;
  }
  function publicConfig(){const c=config();return {enabled:c.enabled&&!isTest(c)&&missing(c).length===0};}
  function adminConfig(){const c=config();const {password,...visible}=c;return {...visible,hasPassword:Boolean(password),testMode:isTest(c),missing:missing(c),available:publicConfig().enabled};}
  function saveConfig(body){
    const current=config(),c={...current};
    for(const key of ['login','senderName','senderPhone','senderAddress','senderCityCode','senderBranchCode'])if(body[key]!==undefined)c[key]=String(body[key]).trim().slice(0,key==='senderAddress'?240:100);
    if(body.password)c.password=String(body.password).slice(0,1000);
    c.baseUrl=apiBase(body.baseUrl??c.baseUrl);
    if(body.enabled!==undefined)c.enabled=body.enabled===true;
    c.pickupType=body.pickupType??c.pickupType;
    if(!['courier','branch','self'].includes(c.pickupType))throw new BtsError('Jo‘natmani topshirish usulini tekshiring.',400);
    if(c.senderPhone){const digits=c.senderPhone.replace(/\D/g,'');c.senderPhone='+'+digits;if(!/^\+998\d{9}$/.test(c.senderPhone))throw new BtsError('Jo‘natuvchi telefonini +998 formatida kiriting.',400);}
    if(c.senderCityCode&&!code(c.senderCityCode)||c.senderBranchCode&&!code(c.senderBranchCode))throw new BtsError('BTS tuman yoki filial kodi noto‘g‘ri.',400);
    for(const key of ['defaultWeightKg','lengthCm','widthCm','heightCm','packageId','postTypeId'])if(body[key]!==undefined){
      const n=body[key]===''||body[key]===null?null:Number(body[key]);
      if(n!==null&&(!Number.isFinite(n)||n<=0||n>10000||(['packageId','postTypeId'].includes(key)&&!Number.isInteger(n))))throw new BtsError('Vazn, o‘lcham va BTS identifikatorlarini tekshiring.',400);
      c[key]=n;
    }
    const dimensions=[c.lengthCm,c.widthCm,c.heightCm];
    if(dimensions.some(Boolean)&&!dimensions.every(Boolean))throw new BtsError('Qadoqning uchala o‘lchamini ham kiriting.',400);
    if(c.enabled&&missing(c).length)throw new BtsError('BTS uchun kiriting: '+missing(c).join(', ')+'.',400);
    const tmp=configFile+'.tmp';fs.writeFileSync(tmp,JSON.stringify(c,null,2),{mode:0o600});fs.renameSync(tmp,configFile);
    tokens=null;cache.clear();return adminConfig();
  }
  function ready(customer=false){const c=config();c.baseUrl=apiBase(c.baseUrl);if(!c.login||!c.password||customer&&(missing(c).length||!c.enabled||isTest(c)))throw new BtsError('BTS yetkazish hozircha mavjud emas. Boshqa qabul qilish usulini tanlang.',503);return c;}
  async function raw(c,endpoint,{method='GET',body,token}={}){
    let response;
    try{
      response=await fetchImpl(c.baseUrl+endpoint,{method,redirect:'error',signal:AbortSignal.timeout(timeout),headers:{Accept:'application/json','Content-Type':'application/json',language:'uz',...(token?{Authorization:'Bearer '+token}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
    }catch{throw new BtsError('BTS bilan aloqa uzildi. Keyinroq qayta tekshiring.',502,true);}
    let json;try{json=await response.json();}catch{throw new BtsError('BTS javobini o‘qib bo‘lmadi.',502,true);}
    if(!response.ok||json.status===false){
      const status=response.status===401?401:response.status===422?422:502;
      const message=status===401?'BTS login yoki paroli yaroqsiz.':status===422?'BTS yuborilgan ma’lumotlarni qabul qilmadi. Manzil va jo‘natuvchi sozlamalarini tekshiring.':'BTS xizmati so‘rovni bajara olmadi.';
      throw new BtsError(message,status,response.status>=500||response.status===408);
    }
    return json.data;
  }
  async function authenticate(c,force=false){
    const identity=digest([c.baseUrl,c.login,c.password]);
    if(!force&&tokens?.identity===identity&&tokens.expires>now()+60000)return tokens.access;
    if(authPromise?.identity===identity)return authPromise.promise;
    const promise=(async()=>{
      let data;
      if(tokens?.identity===identity&&tokens.refresh)try{data=await raw(c,'/auth/refresh',{method:'POST',token:tokens.access,body:{refresh_token:tokens.refresh}});}catch{}
      if(!data?.access_token)data=await raw(c,'/auth/login',{method:'POST',body:{login:c.login,password:c.password}});
      if(!data?.access_token)throw new BtsError('BTS kirish tokenini qaytarmadi.');
      let exp=now()+23*60*60*1000;
      try{const jwt=JSON.parse(Buffer.from(data.access_token.split('.')[1],'base64url'));if(Number.isFinite(jwt.exp))exp=Math.min(exp,jwt.exp*1000);}catch{}
      tokens={identity,access:data.access_token,refresh:data.refresh_token,expires:exp};return tokens.access;
    })();
    authPromise={identity,promise};
    try{return await promise;}finally{if(authPromise?.promise===promise)authPromise=null;}
  }
  async function request(c,endpoint,options){
    const token=await authenticate(c);
    try{return await raw(c,endpoint,{...options,token});}catch(e){if(e.status!==401)throw e;const fresh=await authenticate(c,true);return raw(c,endpoint,{...options,token:fresh});}
  }
  async function directory(kind,params={},customer=true){
    const c=ready(customer),query=new URLSearchParams();
    if(!['regions','cities','branches'].includes(kind))throw new BtsError('BTS ma’lumot turi noto‘g‘ri.',400);
    for(const key of kind==='cities'?['regionCode']:kind==='branches'?['regionCode','cityCode']:[]){if(!code(params[key]))throw new BtsError('Viloyat va tumanni tanlang.',400);query.set(key,params[key]);}
    const cacheKey=digest([c.baseUrl,c.login,kind,query.toString()]);const cached=cache.get(cacheKey);
    if(cached?.expires>now())return cached.items;
    let items=[];
    for(let page=1;page<=30;page++){
      query.set('page',page);query.set('per-page',100);
      const data=await request(c,'/v1/directory/'+kind+'?'+query);
      if(!Array.isArray(data?.items))throw new BtsError('BTS manzillar ro‘yxatini qaytarmadi.');
      items.push(...data.items.map(x=>({code:String(x.code),name:String(x.name||x.code),...(kind==='branches'?{address:String(x.address||''),regionCode:String(x.regionCode||params.regionCode),cityCode:String(x.cityCode||params.cityCode)}:{})})).filter(x=>code(x.code)));
      if(page>=Number(data._meta?.pageCount||1))break;
      if(page===30)throw new BtsError('BTS manzillar ro‘yxati to‘liq yuklanmadi.');
    }
    if(cache.size>500)cache.clear();cache.set(cacheKey,{expires:now()+30*60*1000,items});return items;
  }
  async function selection(body){
    const dropoffType=body.dropoffType;if(!['courier','branch'].includes(dropoffType))throw new BtsError('BTS qabul qilish usulini tanlang.',400);
    const region=(await directory('regions')).find(x=>x.code===body.regionCode);if(!region)throw new BtsError('BTS viloyatini tanlang.',400);
    const city=(await directory('cities',{regionCode:region.code})).find(x=>x.code===body.cityCode);if(!city)throw new BtsError('BTS tumanini tanlang.',400);
    let branch;if(dropoffType==='branch'){branch=(await directory('branches',{regionCode:region.code,cityCode:city.code})).find(x=>x.code===body.branchCode&&x.regionCode===region.code&&x.cityCode===city.code);if(!branch)throw new BtsError('BTS filialini tanlang.',400);}
    return {dropoffType,regionCode:region.code,regionName:region.name,cityCode:city.code,cityName:city.name,...(branch?{branchCode:branch.code,branchName:branch.name,branchAddress:branch.address}:{})};
  }
  function parcel(items,products,c){
    if(!Array.isArray(items)||!items.length||items.length>50)throw new BtsError('Savatni tekshiring.',400);
    let weight=0;const lines=[],totals=new Map();
    for(const item of items){
      const p=products.find(x=>x.id===item.id);
      if(!p||!Number.isInteger(item.qty)||item.qty<1||item.qty>20)throw new BtsError('Mahsulot miqdorini tekshiring.',400);
      const qty=(totals.get(p.id)||0)+item.qty;totals.set(p.id,qty);
      if(qty>20||Number.isInteger(p.stock)&&qty>p.stock)throw new BtsError('Tanlangan mahsulot miqdori mavjud emas.',409);
      if(!p.physical)continue;
      const unitWeight=Number(p.weightKg||c.defaultWeightKg);if(!(unitWeight>0))throw new BtsError('Mahsulot vazni kiritilmagan.',503);
      weight+=unitWeight*item.qty;lines.push({id:p.id,qty:item.qty,size:String(item.size||''),color:String(item.color||''),price:Number(p.price)||0,weight:unitWeight});
    }
    if(!lines.length||weight<.001||weight>10000)throw new BtsError('BTS uchun jo‘natma vaznini tekshiring.',400);
    return {itemsHash:digest(lines.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))),weight:Math.round(weight*1000)/1000,piece:1,...(c.lengthCm?{volume:{x:c.lengthCm,y:c.widthCm,z:c.heightCm}}:{})};
  }
  const configHash=c=>digest(c);
  const sign=body=>crypto.createHmac('sha256',signingKey).update(body).digest('base64url');
  async function quote(body,products){
    const c=ready(true),destination=await selection(body),cargo=parcel(body.items,products,c);
    const data=await request(c,'/v1/order-calculate/index',{method:'POST',body:{senderCityCode:c.senderCityCode,receiverCityCode:destination.cityCode,pickup_type:c.pickupType,dropoff_type:destination.dropoffType,is_multiple_cost:1,weight:cargo.weight,...(cargo.volume?{volume:cargo.volume}:{})}});
    const tariff=data?.[(c.pickupType==='self'?'branch':c.pickupType)+'_to_'+destination.dropoffType];
    if(!tariff||tariff.available!==true||tariff.price===null||tariff.price===''||!Number.isFinite(Number(tariff.price))||Number(tariff.price)<0)throw new BtsError('Tanlangan manzil uchun BTS yetkazish mavjud emas.',422);
    const price=Number(tariff.price),expires=now()+15*60*1000;
    const encoded=Buffer.from(JSON.stringify({destination,cargo,price,expires,configHash:configHash(c)})).toString('base64url');
    return {quoteId:encoded+'.'+sign(encoded),price,expiresAt:new Date(expires).toISOString(),destination,weight:cargo.weight};
  }
  function verifyQuote(quoteId,items,products){
    const c=ready(true);let q;
    try{
      if(typeof quoteId!=='string'||quoteId.length>8000)throw Error();
      const [body,signature,extra]=quoteId.split('.'),actual=Buffer.from(signature||'','base64url'),expected=Buffer.from(sign(body),'base64url');
      if(extra||actual.length!==expected.length||!crypto.timingSafeEqual(actual,expected))throw Error();
      q=JSON.parse(Buffer.from(body,'base64url'));
      if(q.expires<=now()||q.configHash!==configHash(c)||q.cargo.itemsHash!==parcel(items,products,c).itemsHash)throw Error();
    }catch{throw new BtsError('BTS narxi eskirgan. Yetkazish narxini qayta hisoblang.',409);}
    return {provider:'bts',state:'pending',...q.destination,cargo:q.cargo,quotedFee:q.price,baseUrl:c.baseUrl};
  }
  async function createShipment(order){
    const c=ready(true),s=order.shipping;
    if(s.baseUrl!==c.baseUrl)throw new BtsError('Buyurtma boshqa BTS muhitida hisoblangan.',409);
    const body={clientId:order.ref,pickup_type:c.pickupType,dropoff_type:s.dropoffType,is_sender_location:false,is_receiver_location:false,
      sender:{name:c.senderName,phone:c.senderPhone,address:c.senderAddress,city_code:c.senderCityCode,...(c.pickupType==='branch'?{branch_code:c.senderBranchCode}:{})},
      receiver:{name:order.customer,phone:order.phone,address:order.address,city_code:s.cityCode,...(s.branchCode?{branch_code:s.branchCode}:{})},
      cargo:{weight:s.cargo.weight,piece:s.cargo.piece,...(s.cargo.volume?{volume:s.cargo.volume.x*s.cargo.volume.y*s.cargo.volume.z}:{}),...(c.packageId?{packageId:c.packageId}:{}),...(c.postTypeId?{postTypeId:c.postTypeId}:{}),postTypes:order.items.filter(x=>s.cargo.itemsHash&&x.physical!==false).map(x=>({name:x.productName,code:x.id,count:x.qty,cost:x.unitPrice}))},
      bringBackMoney:0,back_money:0,takePhoto:0,bringBackWaybill:0,ready_to_take:true};
    // Authentication happens before the mutation, so login/network failures cannot mark a shipment as sent.
    try{await authenticate(c);}catch(e){e.uncertain=false;throw e;}
    const data=await request(c,'/v1/order/add',{method:'POST',body});
    if(!data?.orderId||!data.barcode)throw new BtsError('BTS jo‘natma raqamini qaytarmadi. BTS kabinetida buyurtmani tekshiring.',502,true);
    return shipmentResult(data);
  }
  function shipmentResult(data){
    let trackingUrl='';try{const u=new URL(data.tracking);if(u.protocol==='https:'&&(u.hostname==='bts.uz'||u.hostname.endsWith('.bts.uz')))trackingUrl=u.href;}catch{}
    return {state:'created',orderId:String(data.orderId),barcode:String(data.barcode),trackingUrl,status:{code:data.status?.code??null,name:String(data.status?.name||data.status?.info||'BTS tizimida yaratildi')},actualFee:Number.isFinite(Number(data.cost))?Number(data.cost):null,lastCheckedAt:new Date(now()).toISOString()};
  }
  async function track(shipping){
    const c=ready();if(c.baseUrl!==shipping.baseUrl)throw new BtsError('Bu jo‘natma boshqa BTS muhitiga tegishli.',409);
    const data=await request(c,'/v1/order/track?'+new URLSearchParams({orderId:shipping.orderId}));
    if(!data?.status)throw new BtsError('BTS jo‘natma holatini qaytarmadi.');
    return {status:{code:data.status.code??null,name:String(data.status.name||data.status.info||'')},lastCheckedAt:new Date(now()).toISOString()};
  }
  async function testConnection(){const c=ready();await authenticate(c,true);const regions=await directory('regions',{},false);return {ok:true,testMode:isTest(c),regions:regions.length};}
  return {publicConfig,adminConfig,saveConfig,directory,quote,verifyQuote,createShipment,track,testConnection};
}
function publicShipment(s){if(s?.provider!=='bts')return undefined;return {provider:'bts',state:s.state,orderId:s.orderId,barcode:s.barcode,trackingUrl:s.trackingUrl,status:s.status,lastCheckedAt:s.lastCheckedAt};}
module.exports={createBts,BtsError,publicShipment};
