const express=require('express');const fs=require('fs');const path=require('path');const crypto=require('crypto');
const app=express(),ROOT=__dirname,SEED=path.join(ROOT,'data','db.json');
// Persistent storage: DATA_DIR env, or the Railway Volume mount path, else ./data
const DATA_DIR=process.env.DATA_DIR||process.env.RAILWAY_VOLUME_MOUNT_PATH||path.join(ROOT,'data'),DB=path.join(DATA_DIR,'db.json');
fs.mkdirSync(DATA_DIR,{recursive:true});if(!fs.existsSync(DB))fs.copyFileSync(SEED,DB);
app.use(express.json({limit:'1mb'}));app.use(express.static(path.join(ROOT,'public')));
function read(){return JSON.parse(fs.readFileSync(DB,'utf8'))}function write(db){const tmp=DB+'.tmp';fs.writeFileSync(tmp,JSON.stringify(db,null,2));fs.renameSync(tmp,DB)}
function auth(req,res,next){const h=req.headers.authorization||'';if(!h.startsWith('Basic '))return res.status(401).set('WWW-Authenticate','Basic').json({error:'Admin login required'});const [u,p]=Buffer.from(h.slice(6),'base64').toString().split(':');if(u!==(process.env.ADMIN_USER||'admin')||p!==(process.env.ADMIN_PASSWORD||'change-this-password'))return res.status(403).json({error:'Forbidden'});next()}
// The storefront expects complete project cards; admin-created projects may only have a name and URL.
function normalizeProject(p){
  const obj=p&&typeof p==='object'?p:{};
  return {
    ...obj,
    id:String(obj.id||obj.slug||'project'),
    name:String(obj.name||'IT loyiha'),
    description:String(obj.description||''),
    status:String(obj.status||'Ishlab chiqilmoqda'),
    kind:['crm','portfolio','bot'].includes(obj.kind)?obj.kind:'bot',
    tags:Array.isArray(obj.tags)?obj.tags:[],
    features:Array.isArray(obj.features)?obj.features:[],
    creator:obj.creator||null,
    productId:obj.productId||null
  };
}
app.get('/api/catalog',(req,res)=>{const d=read();res.json({api:'dasturxona',products:d.products,projects:(Array.isArray(d.projects)?d.projects:[]).map(normalizeProject),team:d.team,settings:d.settings})});
app.get('/api/news',(req,res)=>{const d=read();res.json({items:d.news.filter(x=>x.status!=='draft').slice(0,Number(req.query.limit)||50)})});
app.post('/api/orders',(req,res)=>{const d=read();const ref='DX-'+Date.now().toString(36).toUpperCase(),token=crypto.randomBytes(18).toString('hex');const order={...req.body,ref,token,status:'new',createdAt:new Date().toISOString()};d.orders.unshift(order);write(d);res.status(201).json({ref,token,status:order.status,createdAt:order.createdAt})});
app.get('/api/orders/:ref',(req,res)=>{const o=read().orders.find(x=>x.ref===req.params.ref&&x.token===req.header('X-Order-Token'));if(!o)return res.status(404).json({error:'Not found'});res.json({ref:o.ref,status:o.status,createdAt:o.createdAt})});
app.get('/api/admin/data',auth,(req,res)=>res.json(read()));
app.put('/api/admin/:section',auth,(req,res)=>{const allowed=['products','projects','news','team','settings','orders'];if(!allowed.includes(req.params.section))return res.status(400).json({error:'Invalid section'});const d=read();d[req.params.section]=req.body;write(d);res.json({ok:true})});
app.get('/admin',(req,res)=>res.sendFile(path.join(ROOT,'public','admin.html')));
app.use((req,res)=>res.sendFile(path.join(ROOT,'public','index.html')));
const port=process.env.PORT||3000;app.listen(port,()=>console.log('Dasturxona running on '+port+', data: '+DB));
