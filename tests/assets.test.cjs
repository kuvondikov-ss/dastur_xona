const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const publicDir=path.join(__dirname,'../public');
test('deployed HTML and CSS reference existing local scripts, images and fonts',()=>{
 const assets=new Set();
 for(const file of ['index.html','admin.html']){
  const html=fs.readFileSync(path.join(publicDir,file),'utf8');
  for(const match of html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g))assets.add(match[1]);
  assert(!html.includes('/assets/design-v2'));assert(!html.includes('/assets/scene-v2.bundle'));
 }
 for(const name of ['site.css','admin.css','fonts.css']){
  const css=fs.readFileSync(path.join(publicDir,'assets',name),'utf8');
  for(const match of css.matchAll(/url\(["']?(\/assets\/[^)"']+)/g))assets.add(match[1]);
 }
 for(const asset of assets)assert(fs.statSync(path.join(publicDir,asset)).size>0,asset);
 const fonts=fs.readFileSync(path.join(publicDir,'assets/fonts.css'),'utf8');assert.equal((fonts.match(/@font-face/g)||[]).length,3);
 assert(fs.statSync(path.join(publicDir,'index.html')).size<15000);
});
