/* Creates private, offline design review copies. It never changes catalog data or publishes. */
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const esbuild = require('esbuild');
const root = path.resolve(__dirname,'..');
const out = path.join(root,'review');
const cache = path.join(out,'cache');
const db = JSON.parse(fs.readFileSync(path.join(root,'data/db.json'),'utf8'));
const read = name => fs.readFileSync(path.join(root,name),'utf8');
const uri = (file,type) => 'data:'+type+';base64,'+fs.readFileSync(file).toString('base64');
const campaigns = ['heritage-stage-v2','bot-campaign-v2','merch-campaign-v2','creative-atelier-v2'];
fs.mkdirSync(cache,{recursive:true});

function assetMap(compact) {
  const result={};
  for (const name of campaigns) {
    let file=path.join(root,'public/assets/'+name+'.webp');
    if(compact) {
      const dest=path.join(cache,name+'-compact.webp');
      execFileSync('convert',[file,'-resize','1200x','-strip','-quality','72',dest]);
      file=dest;
    }
    result['/assets/'+name+'.webp']=uri(file,'image/webp');
  }
  result['/assets/brand-mark.svg']=uri(path.join(root,'public/assets/brand-mark.svg'),'image/svg+xml');
  db.products.forEach((p,i)=>{
    const source=path.join(cache,'product-'+i+'.jpg');
    if(!fs.existsSync(source)) throw new Error('Missing public catalog review image: '+source);
    const dest=path.join(cache,'product-'+i+'-'+(compact?'compact':'review')+'.webp');
    execFileSync('convert',[source,'-resize',compact?'440x440>':'900x900>','-strip','-quality',compact?'67':'78',dest]);
    result[p.image]=uri(dest,'image/webp');
  });
  return result;
}

function appSource(source) {
  source=source.replace(/const ASSETS = [^\n]+/,'const ASSETS = DX_REVIEW_ASSETS;');
  source=source.replace(/function imageSrc\(value\)[^\n]+/,'function imageSrc(value){return DX_REVIEW_ASSETS[value]||DX_REVIEW_ASSETS[String(value||"").replace("asset:","")]||MARK;}');
  source=source.replace("const main=document.getElementById('main');",()=>
    "const main=document.getElementById('main');const dxMarkupDescriptor=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');Object.defineProperty(main,'innerHTML',{get(){return dxMarkupDescriptor.get.call(this)},set(value){let markup=String(value);for(const [key,uri] of Object.entries(DX_REVIEW_ASSETS))if(key.startsWith('/assets/'))markup=markup.replaceAll(key,uri);dxMarkupDescriptor.set.call(this,markup)}});");
  const replaceBetween=(start,end,replacement)=>{
    const a=source.indexOf(start),b=source.indexOf(end,a);
    if(a<0||b<0)throw new Error('Preview boundary changed: '+start);
    source=source.slice(0,a)+replacement+'\n  '+source.slice(b);
  };
  replaceBetween('async function submitCheckout(event){','async function copyOrder()',
    'function submitCheckout(){toast("Bu ko‘rib chiqish nusxasi. Haqiqiy buyurtma yuborilmaydi.");}');
  replaceBetween('async function loadNews(){','async function loadArticle(',
    'function loadNews(){const list=newsItems.filter(n=>(!newsFilter.category||n.category===newsFilter.category)&&fold(n.title+" "+n.excerpt).includes(fold(newsFilter.query)));newsBusy=false;newsError="";newsResult={items:list.slice((newsFilter.page-1)*9,newsFilter.page*9),total:list.length,limit:9};paintNews();}');
  replaceBetween('async function loadArticle(','function syncSettings()',
    'function loadArticle(slug){const n=newsItems.find(n=>n.slug===slug);if(n){newsCache.set(slug,n);route(false,true);}else main.innerHTML=notFound();}');
  replaceBetween('async function refreshOrder(){','async function boot(){',
    'function refreshOrder(){toast("Ko‘rib chiqish nusxasi: buyurtma serveriga ulanmaydi.");}');
  replaceBetween('async function boot(){','updateCartCount();boot();',
    'function boot(){const data=DX_REVIEW_DATA;products=data.products;projects=data.projects;students=data.team;settings=data.settings;banners=data.banners||[];apiMode=false;backendState="offline";cart=cart.filter(validLine);newsItems=data.news;newsCache=new Map(newsItems.map(n=>[n.slug,n]));route(false);}');
  source=source.replaceAll('dasturxona-cart-v2','dasturxona-review-cart-v2')
    .replaceAll('dasturxona-last-order-v2','dasturxona-review-last-order-v2');
  if(/\bfetch\s*\(|XMLHttpRequest|WebSocket/.test(source))throw new Error('Review copy still has a network API.');
  return source;
}

async function create(compact) {
  let html=read('public/index.html');
  const assets=assetMap(compact);
  const catalog={
    products:db.products,
    projects:db.projects.map(p=>({...p,kind:p.kind||'bot',tags:p.tags||[],features:p.features||[],creator:p.creator||null,productId:p.productId||null})),
    team:db.team,settings:db.settings,banners:db.banners||[],
    news:(db.news||[]).filter(n=>n.status!=='draft')
  };
  html=html.replace(/<title>[^<]*<\/title>/,'<title>DasturXona — yangi ko‘rinish</title>')
    .replace(/<link rel="preload" as="image"[^>]*>/,'')
    .replace(/<link rel="stylesheet" href="([^"]+)">/g,(_,p)=>'<style>'+read('public'+p)+'</style>');
  for(const [key,value] of Object.entries(assets)) {
    // Only the persistent image outside the app template is replaced directly.
    if(key.endsWith('brand-mark.svg'))html=html.replace('src="'+key+'"',()=>'src="'+value+'"');
  }
  const scripts=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
  const main=scripts.find(m=>m[1].includes('function home()'));
  if(!main)throw new Error('App script missing.');
  const modified=appSource(main[1]);
  const minified=await esbuild.transform(modified,{loader:'js',minify:true,target:'es2020'});
  html=html.replace(main[0],()=>'<script>'+minified.code+'</script>');
  html=html.replace('</head>',()=>'<script>const DX_REVIEW_ASSETS='+JSON.stringify(assets)
    +';const DX_REVIEW_DATA='+JSON.stringify(catalog).replaceAll('<','\\u003c')+';</script></head>');
  const cssMatches=[...html.matchAll(/<style>([\s\S]*?)<\/style>/g)];
  for(const match of cssMatches) {
    const css=await esbuild.transform(match[1],{loader:'css',minify:true});
    html=html.replace(match[0],()=>'<style>'+css.code+'</style>');
  }
  const controller=await esbuild.transform(read('public/assets/design-v2.js'),{loader:'js',minify:true,target:'es2020'});
  html=html.replace('<script src="/assets/design-v2.js" defer></script>',()=>'<script>'+controller.code+'</script>');
  if(compact) {
    const scene=await esbuild.build({
      entryPoints:[path.join(root,'src/brand-scene.js')],bundle:true,minify:true,format:'esm',
      target:'es2020',loader:{'.svg':'text'},external:['three','three/*'],write:false,legalComments:'inline'
    });
    const importmap='<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/"}}</script>';
    html=html.replace('</head>',()=>importmap+'</head>');
    html=html.replace('<script src="/assets/scene-v2.bundle.js" defer></script>',()=>'<script type="module">'+scene.outputFiles[0].text+'</script>');
  } else {
    html=html.replace('<script src="/assets/scene-v2.bundle.js" defer></script>',
      ()=>'<script>/* Three.js is licensed under MIT. */\n'+read('public/assets/scene-v2.bundle.js')+'</script>');
  }
  const staticMarkup=html.replace(/<script[^>]*>[\s\S]*?<\/script>/g,'');
  const unresolved=[...staticMarkup.matchAll(/(?:src|href)="(\/assets\/[^"\s]+)/g)].map(m=>m[1]);
  if(unresolved.length)throw new Error('Unresolved offline assets: '+unresolved.join(', '));
  return html;
}

(async()=>{
  const desktop=await create(false);
  fs.writeFileSync(path.join(out,'design-v2-preview.html'),desktop);
  const escapeAttr=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  const mobile='<!DOCTYPE html>\n<html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DasturXona — telefon ko‘rinishi</title><style>body{margin:0;background:#e9e1d5;display:grid;place-items:center;min-height:100vh;font-family:Arial,sans-serif}.phone{width:min(390px,100vw);height:min(844px,100vh);background:#153254;box-shadow:0 24px 80px #15325425;overflow:hidden}iframe{width:100%;height:100%;display:block;border:0}</style></head><body><div class="phone"><iframe title="DasturXona mobil sayt ko‘rinishi" srcdoc="'+escapeAttr(desktop)+'"></iframe></div></body></html>';
  fs.writeFileSync(path.join(out,'mobile-v2-preview.html'),mobile);
  const compact=await create(true);
  fs.writeFileSync(path.join(out,'inline-v2-document.html'),compact);
  const fragment='<div id="dasturxona-immersive-review">\n<iframe title="DasturXona yangi sayt ko‘rinishi" srcdoc="'+escapeAttr(compact)+'"></iframe>\n</div>\n<style>#dasturxona-immersive-review{width:100%;background:transparent}#dasturxona-immersive-review>iframe{display:block;border:0;width:100%;height:800px;background:#153254}</style>\n<script>{const root=document.getElementById("dasturxona-immersive-review");if(root)root.querySelector("iframe").setAttribute("aria-label","DasturXona: to‘liq ekranli slayder va sahifa bo‘ylab animatsiyalar");}</script>\n';
  if(Buffer.byteLength(fragment)>1000000)throw new Error('Inline preview exceeds 1 MB: '+Buffer.byteLength(fragment));
  fs.writeFileSync('/workspace/dasturxona-immersive-preview.html',fragment);
  console.log('Desktop review:',Buffer.byteLength(desktop),'bytes; mobile review:',Buffer.byteLength(mobile),'bytes; inline preview:',Buffer.byteLength(fragment),'bytes.');
})().catch(error=>{console.error(error);process.exitCode=1});
