'use strict';
(() => {
  let db={},auth='',tab='products',editing=-1,noticeTimer;
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels={products:'Mahsulotlar',banners:'Bannerlar',news:'Yangiliklar',projects:'IT loyihalar',team:'Jamoa',orders:'Buyurtmalar',settings:'Sozlamalar'};
  const hints={products:'Katalogdagi mahsulotlar, narxlar va mavjudlik.',banners:'Bosh sahifadagi e’lonlar. Tartibni ↑ va ↓ orqali o‘zgartiring.',news:'Maqolalar, e’lonlar va jamoa yangiliklari.',projects:'Jamoamizning raqamli mahsulot va xizmatlari.',team:'Jamoa a’zolari, ko‘nikmalari va hissasi.',orders:'Buyurtma tafsilotlarini oching va holatini yangilang.',settings:'Saytning aloqa va yetkazish ma’lumotlari.'};
  const statuses={new:'Yangi',confirmed:'Tasdiqlangan',processing:'Tayyorlanmoqda',shipped:'Jo‘natilgan',completed:'Yakunlangan',cancelled:'Bekor qilingan'};
  const payments={unpaid:'To‘lov kutilmoqda',paid:'To‘langan',refunded:'Qaytarilgan'};
  const money=n=>Number(n||0).toLocaleString('uz-UZ')+' so‘m';
  const lines=value=>String(value||'').split(/\n/).map(x=>x.trim()).filter(Boolean);
  const commas=value=>String(value||'').split(',').map(x=>x.trim()).filter(Boolean);
  const imageUrl=value=>{const s=String(value||'').trim();if(/^\/(uploads|media|assets)\/[a-zA-Z0-9_./-]+$/.test(s)&&!s.includes('..'))return s;try{const u=new URL(s);if(['https:','http:'].includes(u.protocol)&&!u.username&&!u.password)return u.href;}catch{}return '/assets/brand-mark.svg';};
  function notice(message){clearTimeout(noticeTimer);$('notice').textContent=message;$('notice').hidden=false;noticeTimer=setTimeout(()=>$('notice').hidden=true,5000);}
  async function request(url,options={}){const response=await fetch(url,{...options,headers:{Authorization:auth,...options.headers}});const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error||'So‘rov bajarilmadi ('+response.status+').');return data;}
  const input=(name,label,type='text',value='',extra='')=>`<div class="field ${type==='textarea'?'full':''}"><label for="field-${name}">${label}</label>${type==='textarea'?`<textarea id="field-${name}" name="${name}" ${extra}>${esc(value)}</textarea>`:`<input id="field-${name}" name="${name}" type="${type}" value="${esc(value)}" ${extra}>`}</div>`;
  const select=(name,label,options,value)=>`<div class="field"><label for="field-${name}">${label}</label><select id="field-${name}" name="${name}">${Object.entries(options).map(([key,label])=>`<option value="${esc(key)}" ${key===value?'selected':''}>${label}</option>`).join('')}</select></div>`;
  const upload=(target,label,value)=>`<div class="field full"><label for="upload-${target}">${label}</label><input id="upload-${target}" type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-upload="${target}" ${target==='images'?'multiple':''}><p class="field-help">PNG, JPG, WebP yoki GIF · har biri 5 MB gacha</p><img class="upload-preview" data-preview="${target}" src="${esc(imageUrl(value))}" alt="Rasmni oldindan ko‘rish" ${value?'':'hidden'}></div>`;
  $('loginForm').addEventListener('submit',async event=>{
    event.preventDefault();const button=event.submitter;button.disabled=true;$('loginError').hidden=true;
    auth='Basic '+btoa(unescape(encodeURIComponent($('username').value+':'+$('password').value)));
    try{db=await request('/api/admin/data');for(const key of ['products','banners','news','projects','team','orders'])db[key]||=[];db.settings||={};$('loginPanel').hidden=true;$('dashboard').hidden=false;$('logout').hidden=false;$('password').value='';render();}
    catch(error){auth='';$('loginError').textContent=error.message;$('loginError').hidden=false;}
    finally{button.disabled=false;}
  });
  $('logout').onclick=()=>{auth='';db={};$('editor').close();$('dashboard').hidden=true;$('loginPanel').hidden=false;$('logout').hidden=true;notice('Tizimdan chiqdingiz.');};
  $('tabs').onclick=event=>{const button=event.target.closest('[data-tab]');if(!button)return;tab=button.dataset.tab;editing=-1;$('listSearch').value='';render();};
  $('listSearch').oninput=()=>renderList();
  $('addEntry').onclick=()=>openEditor(-1);
  $('closeEditor').onclick=$('cancelEditor').onclick=()=>$('editor').close();
  function render(){
    document.querySelectorAll('[data-tab]').forEach(button=>{if(button.dataset.tab===tab)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
    $('heading').textContent=labels[tab];$('sectionHint').textContent=hints[tab];$('addEntry').hidden=['orders','settings'].includes(tab);$('listTools').hidden=tab==='settings';
    if(tab==='settings'){renderSettings();return;}renderList();
  }
  function renderList(){
    if(tab==='settings')return;
    const query=$('listSearch').value.trim().toLowerCase(),all=db[tab]||[];
    const filtered=all.map((item,index)=>({item,index})).filter(({item})=>([item.name,item.title,item.ref,item.customer,item.phone].join(' ')).toLowerCase().includes(query));
    $('listCount').textContent=filtered.length+' ta yozuv';
    $('items').innerHTML=filtered.map(({item:x,index:i})=>{
      const img=x.image||x.cover||x.photo;
      const meta=tab==='products'?money(x.price)+' · '+(x.stock==null?'Soni ko‘rsatilmagan':x.stock+' dona')+' · '+(x.categoryName||({merch:'Merch',souvenir:'Suvenir',suvenir:'Suvenir',digital:'Raqamli'})[x.category]||''):
        tab==='orders'?(x.customer||'Xaridor')+' · '+(x.phone||'')+' · '+new Date(x.createdAt).toLocaleDateString('uz-UZ'):
        tab==='team'?x.role||'':x.description||x.excerpt||'';
      return `<article class="admin-item">${img?`<img src="${esc(imageUrl(img))}" alt="" width="76" height="76">`:''}<div class="admin-item-info"><h2>${esc(x.name||x.title||x.ref)}</h2><p>${esc(meta.length>160?meta.slice(0,160)+'…':meta)}</p>${tab==='news'?`<span class="admin-state">${x.status==='draft'?'Qoralama':'E’lon qilingan'}</span>`:tab==='orders'?`<span class="admin-state">${esc(statuses[x.status]||x.status)} · ${esc(payments[x.paymentStatus]||payments.unpaid)}</span>`:''}</div><div class="admin-item-actions">${tab==='banners'?`<button class="btn btn-secondary move-btn" type="button" data-move="${i}" data-delta="-1" aria-label="Yuqoriga ko‘chirish" ${i===0?'disabled':''}>↑</button><button class="btn btn-secondary move-btn" type="button" data-move="${i}" data-delta="1" aria-label="Pastga ko‘chirish" ${i===all.length-1?'disabled':''}>↓</button>`:''}<button class="btn btn-secondary" type="button" data-edit="${i}">${tab==='orders'?'Tafsilotlar':'Tahrirlash'}</button>${tab!=='orders'?`<button class="btn btn-danger" type="button" data-delete="${i}">O‘chirish</button>`:''}</div></article>`;
    }).join('')||`<div class="admin-empty"><h2>${query?'Yozuv topilmadi.':'Hozircha yozuv yo‘q.'}</h2><p>${query?'Boshqa so‘z bilan qidirib ko‘ring.':tab==='orders'?'Yangi buyurtmalar shu yerda ko‘rinadi.':'“Yangi qo‘shish” orqali birinchi yozuvni kiriting.'}</p></div>`;
  }
  function openEditor(index){
    editing=index;const v=index>=0?db[tab][index]:{};$('editorTitle').textContent=tab==='orders'?'Buyurtma '+v.ref:(index>=0?'Tahrirlash: ':'Yangi yozuv: ')+labels[tab];$('formError').hidden=true;
    let html='';
    if(tab==='products')html=input('name','Mahsulot nomi','text',v.name||'','required maxlength="160"')+input('price','Narxi (so‘m)','number',v.price??'','required min="0" step="1"')+input('stock','Mavjud soni','number',v.stock??'','min="0" step="1" placeholder="Cheklanmagan"')+select('category','Kategoriya',{merch:'Merch',souvenir:'Suvenirlar',digital:'Raqamli mahsulotlar'},v.category==='suvenir'?'souvenir':v.category||'merch')+input('short','Qisqa tavsif','text',v.short||'','maxlength="220"')+input('description','Batafsil tavsif','textarea',v.description||'')+`<fieldset class="field full"><legend>O‘lchamlar (faqat kiyimlar uchun)</legend><div class="size-choices">${['S','M','L','XL','XXL','XXXL'].map(size=>`<label class="size-choice"><input type="checkbox" name="sizeOption" value="${size}" ${(v.sizes||[]).includes(size)?'checked':''}>${size}</label>`).join('')}</div></fieldset>`+input('colors','Ranglar (vergul bilan)','text',(v.colors||[]).join(', '))+input('sizeGuide','O‘lcham bo‘yicha ma’lumot','textarea',v.sizeGuide||'')+input('spec','Material va xususiyatlar (har satrda bittadan)','textarea',(v.spec||[]).join('\n'))+input('image','Asosiy rasm manzili','text',v.image||'')+upload('image','Asosiy rasm yuklash',v.image)+input('images','Qo‘shimcha rasm manzillari (har satrda bittadan)','textarea',(v.images||[]).join('\n'))+upload('images','Galereyaga rasmlar yuklash',(v.images||[])[0]);
    if(tab==='banners')html=input('title','Banner sarlavhasi','text',v.title||'','required maxlength="120"')+input('subtitle','Kichik sarlavha','text',v.subtitle||'')+input('description','Matn','textarea',v.description||'')+input('link','Tugma havolasi','text',v.link||'#/dokon')+input('image','Rasm manzili','text',v.image||'')+upload('image','Banner rasmi',v.image);
    if(tab==='news')html=input('title','Yangilik sarlavhasi','text',v.title||'','required maxlength="180"')+input('excerpt','Qisqa matn','textarea',v.excerpt||'')+input('body','To‘liq matn','textarea',v.body||'','required')+select('category','Kategoriya',{jamoa:'Jamoa',mahsulot:'Mahsulot',loyiha:'IT loyiha',tadbir:'Tadbir'},v.category||'jamoa')+select('status','Holati',{draft:'Qoralama',published:'E’lon qilingan'},v.status||'draft')+input('publishedAt','Sana','date',(v.publishedAt||new Date().toISOString()).slice(0,10),'required')+input('cover','Muqova rasm manzili','text',v.cover||'')+upload('cover','Muqova rasmi',v.cover);
    if(tab==='projects')html=input('name','Loyiha nomi','text',v.name||'','required maxlength="160"')+input('url','Loyiha havolasi','url',v.url||'')+input('description','Loyiha tavsifi','textarea',v.description||'','required')+select('kind','Loyiha turi',{bot:'Telegram bot / Mini App',crm:'Web ilova',portfolio:'Shablon'},v.kind||'bot')+select('status','Holati',{active:'Faol',development:'Ishlab chiqilmoqda',completed:'Tayyor',planned:'Rejalashtirilgan'},v.status||'development')+input('tags','Texnologiyalar (vergul bilan)','text',(v.tags||[]).join(', '))+input('features','Imkoniyatlar (har satrda bittadan)','textarea',(v.features||[]).join('\n'));
    if(tab==='team')html=input('name','Ism va familiya','text',v.name||'','required maxlength="120"')+input('role','Yo‘nalishi / vazifasi','text',v.role||'','required')+input('bio','Qisqacha tanishtiruv','textarea',v.bio||'')+input('education','Ta’lim','text',v.education||'')+input('skills','Ko‘nikmalar (vergul bilan)','text',(v.skills||[]).join(', '))+input('contributions','Jamoaga qo‘shgan hissasi (har satrda bittadan)','textarea',(v.contributions||[]).join('\n'))+input('photo','Surat manzili','text',v.photo||'')+upload('photo','Surat yuklash',v.photo);
    if(tab==='orders')html=`<div class="admin-order full"><dl><dt>Xaridor</dt><dd>${esc(v.customer)}</dd><dt>Telefon</dt><dd>${esc(v.phone)}</dd><dt>Email</dt><dd>${esc(v.email||'—')}</dd><dt>Qabul qilish</dt><dd>${esc(v.delivery)}</dd><dt>Manzil</dt><dd>${esc(v.address||'—')}</dd><dt>Mahsulotlar jami</dt><dd>${esc(money(v.total??(v.items||[]).reduce((s,x)=>s+(x.unitPrice||0)*x.qty,0)))}</dd><dt>Yetkazish</dt><dd>${v.shippingFee==null?'Kelishiladi':esc(money(v.shippingFee))}</dd></dl><div class="admin-order-items">${(v.items||[]).map(x=>`<p>${esc(x.productName||db.products.find(p=>p.id===x.id)?.name||x.id)}${x.size?' · '+esc(x.size):''}${x.color?' · '+esc(x.color):''} × ${x.qty} — ${money((x.unitPrice??db.products.find(p=>p.id===x.id)?.price??0)*x.qty)}</p>`).join('')}</div></div>`+select('status','Buyurtma holati',statuses,v.status||'new')+select('paymentStatus','To‘lov holati',payments,v.paymentStatus||'unpaid');
    $('entryFields').innerHTML=html;$('saveEntry').disabled=false;$('editor').showModal();
  }
  function renderSettings(){
    const v=db.settings;$('items').innerHTML=`<form id="settingsForm" class="settings-form"><div class="admin-fields">${input('storeName','Brend nomi','text',v.storeName||'DasturXona','required')+input('phone','Aloqa telefoni','tel',v.phone||'')+input('instagram','Instagram manzili','url',v.instagram||'')+input('shippingFee','Yetkazish narxi (bo‘sh bo‘lsa kelishiladi)','number',v.shippingFee??'','min="0" step="1"')+input('description','Saytning qisqa tavsifi','textarea',v.description||'')}</div><div class="admin-editor-actions"><button class="btn btn-primary" type="submit">Sozlamalarni saqlash</button></div><p class="error" id="settingsError" hidden></p></form>`;
    $('settingsForm').onsubmit=async event=>{event.preventDefault();const raw=Object.fromEntries(new FormData(event.target)),value={...db.settings,...raw,shippingFee:raw.shippingFee===''?null:Number(raw.shippingFee)};const button=event.submitter;button.disabled=true;try{await request('/api/admin/settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});db.settings=value;notice('Sozlamalar saqlandi.');}catch(error){$('settingsError').hidden=false;$('settingsError').textContent=error.message;}finally{button.disabled=false;}};
  }
  $('entryForm').oninput=event=>{const name=event.target.name;if(['image','cover','photo'].includes(name)){const preview=$('entryForm').querySelector(`[data-preview="${name}"]`);if(preview){preview.src=imageUrl(event.target.value);preview.hidden=!event.target.value;}}};
  $('entryForm').onchange=async event=>{
    const target=event.target.dataset.upload;if(!target||!event.target.files.length)return;const button=$('saveEntry');button.disabled=true;$('formError').hidden=true;
    try{const urls=[];for(const file of event.target.files){if(file.size>5*1024*1024)throw Error('Har bir rasm 5 MB dan kichik bo‘lishi kerak.');if(!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type))throw Error('PNG, JPG, WebP yoki GIF rasm tanlang.');const result=await request('/api/admin/upload',{method:'POST',headers:{'Content-Type':file.type},body:file});urls.push(result.url);}const input=$('entryForm').elements[target];input.value=target==='images'?[...lines(input.value),...urls].join('\n'):urls[0];const preview=$('entryForm').querySelector(`[data-preview="${target}"]`);preview.src=urls[0];preview.hidden=false;notice('Rasm yuklandi. Yozuvni saqlang.');}
    catch(error){$('formError').textContent=error.message;$('formError').hidden=false;}
    finally{button.disabled=false;}
  };
  $('entryForm').onsubmit=async event=>{
    event.preventDefault();const button=$('saveEntry');button.disabled=true;$('formError').hidden=true;
    try{
      const raw=Object.fromEntries(new FormData(event.target));for(const key of Object.keys(raw))if(raw[key] instanceof File)delete raw[key];
      if(tab==='orders'){const order=db.orders[editing];await request('/api/admin/orders/'+encodeURIComponent(order.ref),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(raw)});Object.assign(order,raw);$('editor').close();renderList();notice('Buyurtma holati saqlandi.');return;}
      const obj={...(editing>=0?db[tab][editing]:{}),...raw,isSample:false};
      if(tab==='products'){obj.id||='product-'+crypto.randomUUID();obj.price=Number(raw.price);if(raw.stock==='')delete obj.stock;else obj.stock=Number(raw.stock);obj.categoryName=({merch:'Merch',souvenir:'Suvenir',digital:'Raqamli'})[obj.category];obj.physical=obj.category!=='digital';obj.sizes=[...event.target.querySelectorAll('[name=sizeOption]:checked')].map(x=>x.value);if(!obj.sizes.length)delete obj.sizes;delete obj.sizeOption;obj.colors=commas(raw.colors);if(!obj.colors.length)delete obj.colors;obj.spec=lines(raw.spec);obj.images=lines(raw.images);}
      if(tab==='banners')obj.id||='banner-'+crypto.randomUUID();
      if(tab==='news'){obj.slug||='news-'+crypto.randomUUID();obj.publishedAt=new Date(raw.publishedAt+'T12:00:00').toISOString();}
      if(tab==='projects'){obj.id||='project-'+crypto.randomUUID();obj.tags=commas(raw.tags);obj.features=lines(raw.features);}
      if(tab==='team'){obj.id||='member-'+crypto.randomUUID();obj.initials=obj.name.split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase();obj.skills=commas(raw.skills);obj.contributions=lines(raw.contributions);}
      const list=[...db[tab]];if(editing>=0)list[editing]=obj;else list.push(obj);await saveList(list);$('editor').close();
    }catch(error){$('formError').textContent=error.message;$('formError').hidden=false;}
    finally{button.disabled=false;}
  };
  async function saveList(list){const section=tab;await request('/api/admin/'+section,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(list)});db[section]=list;renderList();notice('Muvaffaqiyatli saqlandi.');}
  $('items').onclick=async event=>{
    const edit=event.target.closest('[data-edit]'),del=event.target.closest('[data-delete]'),move=event.target.closest('[data-move]');
    try{if(edit)openEditor(Number(edit.dataset.edit));if(del&&confirm('Ushbu yozuvni o‘chirishni tasdiqlaysizmi?')){const list=[...db[tab]];list.splice(Number(del.dataset.delete),1);await saveList(list);}if(move&&!move.disabled){const list=[...db.banners],i=Number(move.dataset.move),j=i+Number(move.dataset.delta);[list[i],list[j]]=[list[j],list[i]];await saveList(list);}}catch(error){notice(error.message);}
  };
  document.addEventListener('error',event=>{if(event.target instanceof HTMLImageElement&&!event.target.dataset.fallback){event.target.dataset.fallback='true';event.target.src='/assets/brand-mark.svg';}},true);
})();
