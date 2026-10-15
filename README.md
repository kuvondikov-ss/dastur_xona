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
- `public/assets/site.css` — yagona dizayn va mobil qoidalar.
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

## Boshqaruv

Mahsulotlar, o‘lchamlar, ranglar, galereya, bannerlar tartibi, yangiliklar va qoralamalar, IT loyihalar, jamoa profillari, aloqa sozlamalari hamda buyurtma holatlari admin panelda boshqariladi. Yangi buyurtma jamoa tomonidan tasdiqlanadi; mavjudlik, to‘lov va yetkazish shartlari xaridor bilan kelishiladi.
