# Dasturxona Platform

## Ishga tushirish
1. Node.js 20+ o'rnating.
2. `.env.example` nusxasini `.env` qiling va admin parolini almashtiring.
3. `npm install`
4. `npm start`
5. Sayt: `http://localhost:3000`, admin: `http://localhost:3000/admin`

## Railway
GitHub repoga push qiling, Railway'da **Deploy from GitHub Repo** ni tanlang. Variables bo'limiga `ADMIN_USER` va `ADMIN_PASSWORD` kiriting. Start command `npm start`.

## Doimiy saqlash (Railway Volume)
Railway'da fayl tizimi har deploy'da tozalanadi, shuning uchun ma'lumot Volume'da saqlanadi:
1. Railway'da servisni oching → **Settings → Volumes → Add Volume** (yoki `Ctrl+K` → *Volume*).
2. **Mount path**: `/data`.
3. Redeploy qiling. Server `RAILWAY_VOLUME_MOUNT_PATH` ni avtomatik taniydi (kerak bo'lsa `DATA_DIR=/data` Variables'ga yozing).
4. Birinchi ishga tushishda `data/db.json` dagi boshlang'ich ma'lumot Volume'ga ko'chiriladi; keyingi deploy'larda o'zgarishlar saqlanib qoladi.

## Muhim
Baza — JSON fayl (kichik/o'rta loyiha uchun yetarli). Yuk oshsa PostgreSQL'ga o'tish tavsiya etiladi. Admin panel hozir JSON muharriri shaklida.
