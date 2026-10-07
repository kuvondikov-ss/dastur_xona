# Dasturxona Platform

## Ishga tushirish
1. Node.js 20+ o'rnating.
2. `.env.example` nusxasini `.env` qiling va admin parolini almashtiring.
3. `npm install`
4. `npm start`
5. Sayt: `http://localhost:3000`, admin: `http://localhost:3000/admin`

## Railway
GitHub repoga push qiling, Railway'da **Deploy from GitHub Repo** ni tanlang. Variables bo'limiga `ADMIN_USER` va `ADMIN_PASSWORD` kiriting. Start command `npm start`.

## Muhim
`data/db.json` faylli baza demo/ilk versiya uchun. Railway persistent production uchun PostgreSQL ulash tavsiya etiladi. Admin panel hozir JSON muharriri shaklida — barcha bo'limlarni server orqali saqlaydi.
