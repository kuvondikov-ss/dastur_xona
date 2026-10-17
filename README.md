# DasturXona

Talabalar yaratgan merch, suvenirlar, IT loyihalar va Telegram Mini App.

Sayt: https://www.dasturxona.uz · Admin: https://www.dasturxona.uz/admin

## Mahalliy ishga tushirish

Node.js 22 yoki yangiroq versiya bilan:

```sh
npm ci
npm start
```

Sayt `http://localhost:3000`, boshqaruv paneli `/admin` manzilida ochiladi.
Admin ma’lumotlarini `.env.example` asosida muhit o‘zgaruvchilari sifatida belgilang. Server `.env` faylini avtomatik yuklamaydi: shell yoki hosting variables sozlamalaridan foydalaning.

## Kod tuzilishi

- `public/index.html` — umumiy sahifa karkasi.
- `public/assets/store.js` — sahifalar, qidiruv, savat va buyurtma oqimi.
- `public/assets/site.css` — umumiy sahifalar va do‘kon dizayni.
- `public/assets/motion-home.js`, `motion-home.css` — to‘liq ekranli slayder, scroll bilan boshqariladigan merch va IT sahnalari; marshrut almashganda tozalanadigan animatsiya.
- `public/admin.html`, `public/assets/admin.js`, `public/assets/admin.css` — boshqaruv paneli.
- `public/assets/fonts/` — o‘z serverimizdan yuklanadigan Montserrat shriftlari.
- `server.js` — katalog, yangilik, rasm, buyurtma va admin API.

Eski `dasturxona.html`, `design-v2` va 3D sahna resurslari tarixiy prototiplardir; amaldagi sayt ularni yuklamaydi.

## Tekshiruvlar

```sh
npm run check
npm test
```

Testlar vaqtinchalik katalogda ishlaydi; haqiqiy ma’lumotlar bazasini o‘zgartirmaydi. API, savat, o‘lcham tanlash, buyurtma, galereya, yangiliklar va admin amallari tekshiriladi. DOM testlari piksel darajasidagi brauzer tekshiruvining o‘rnini bosmaydi.

## Railway

GitHub `main` tarmog‘i production servisga ulangan. Ishga tushirish buyrug‘i `npm start`.
`ADMIN_USER` va `ADMIN_PASSWORD` Railway variables orqali beriladi.

Doimiy volume `/data` manziliga biriktiriladi. Server `DATA_DIR` yoki `RAILWAY_VOLUME_MOUNT_PATH` ni ishlatadi; bo‘lmasa mahalliy `data/` ishlatiladi. Boshlang‘ich `data/db.json` faqat baza hali mavjud bo‘lmaganda ko‘chiriladi. Mavjud buyurtmalar, kontent va `uploads/` rasmlari deployda qayta yozilmaydi.

Sog‘liq tekshiruvi: `/api/health`.

## Motion bosh sahifa

Birinchi ekran — 15 tagacha slaydli karusel. Admin paneldagi **Bannerlar** tartibi va havolalari ishlatiladi. Banner bo‘lmasa, e’lon qilingan yangiliklar va brend slaydlari ko‘rsatiladi. Slaydlar yetti soniyada almashadi; hover, klaviatura fokusi, yashirin tab va ekrandan chiqishda avtomatik almashish to‘xtaydi. Telefon orqali yon tomonga surish va qo‘lda boshqarish ham ishlaydi.

Menyu slayderdan to‘liq o‘tilgach chiqadi; boshqa sahifalarda doim mavjud. Merch sahnasida hudi, krujka va sumka milliy naqsh orqali ulanadi. Motion sahnalardagi hudi, krujka va sumka uchun katalog fotosuratlaridan tayyorlangan shaffof PNG rasmlar (`public/assets/motion/`) ishlatiladi. PNG har birining asl katalog rasmi bilan bog‘langan: admin boshqa rasm qo‘ysa, eski PNG o‘rniga yangi katalog rasmi ko‘rsatiladi. CSS perspektivasi va scroll harakati saqlanadi.

IT bo‘limidagi telefon maketi foydalanuvchi taqdim etgan real Mini App ekranini (`mini-app-screen.png`), brauzer maketi esa amaldagi bosh sahifa tasvirini (`website-screen.jpg`) ko‘rsatadi. Ikkala tasvir ham `public/assets/motion/` ichida saqlanadi; ekranlar dizayni o‘zgarsa, shu fayllar yangilanadi. Maketlar scroll bilan almashadi va kichik ekranlarda ham tasvir nisbatlarini saqlaydi.

Pastki o‘ngdagi tugma harakatni to‘xtatadi va tanlovni shu brauzerda saqlaydi. Qurilmada `prefers-reduced-motion` yoqilganida sahnalar oddiy ketma-ket bo‘limlar ko‘rinishida ochiladi; avtomatik slaydlar ishlamaydi. Scroll tabiiy qoladi, sahifadan chiqishda vaqtlagichlar va hodisa tinglovchilari tozalanadi.

## Boshqaruv

Mahsulotlar, o‘lchamlar, ranglar, galereya, bannerlar tartibi, yangiliklar va qoralamalar, IT loyihalar, jamoa profillari, aloqa sozlamalari hamda buyurtma holatlari admin panelda boshqariladi. Yangi buyurtma jamoa tomonidan tasdiqlanadi; mavjudlik, to‘lov va yetkazish shartlari xaridor bilan kelishiladi.
