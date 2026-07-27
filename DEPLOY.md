# Deploy (bepul: Neon + Render + Vercel)

Uch bepul xizmat: **Neon** (Postgres baza), **Render** (backend, NestJS), **Vercel** (frontend, statik build). Kod tayyor — quyidagi qadamlarni bajarish kifoya.

## 0. GitHub'ga joylashtirish

Render va Vercel ikkalasi ham GitHub repozitoriyidan deploy qiladi.

1. [github.com/new](https://github.com/new) da yangi **private** repo yarating (masalan `erp`).
2. Menga repo URL'ini bering — men shu yerdan push qilib beraman. Yoki o'zingiz:
   ```bash
   git remote add origin https://github.com/<username>/erp.git
   git push -u origin main
   ```

## 1. Neon — bepul Postgres

1. [neon.tech](https://neon.tech) da ro'yxatdan o'ting (kredit karta shart emas).
2. "New Project" → nom bering (masalan `erp`).
3. Loyiha yaratilgach, **Connection string** (`postgresql://...`) ni nusxalab oling — bu `DATABASE_URL` bo'ladi.

## 2. Render — backend

1. [render.com](https://render.com) da ro'yxatdan o'ting, GitHub hisobingizni ulang.
2. "New" → **"Blueprint"** → repozitoriyingizni tanlang. Repoda `render.yaml` bor, Render uni avtomatik o'qib, `erp-backend` xizmatini taklif qiladi.
3. Deploy boshlanishidan oldin quyidagi muhit o'zgaruvchilarini kiritish so'raladi:
   - `DATABASE_URL` — Neon'dan olingan connection string (oxiriga `?sslmode=require` qo'shilganiga ishonch hosil qiling, Neon odatda o'zi qo'shadi)
   - `CORS_ORIGIN` — hozircha bo'sh qoldiring, 4-qadamda Vercel domenini bilib olgach qaytib to'ldirasiz
   - `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — Render o'zi tasodifiy qiymat generatsiya qiladi (`generateValue: true`), qo'l bilan kiritish shart emas
4. Deploy tugagach, Render sizga backend manzilini beradi: `https://erp-backend-xxxx.onrender.com`.
5. **Eslatma**: bepul tarif 15 daqiqa faolsiz qolsa "uxlaydi" — keyingi so'rov ~30-60 soniya kutadi. Bu bepul tarifning odatiy xarajati.

## 3. Vercel — frontend

1. [vercel.com](https://vercel.com) da ro'yxatdan o'ting, GitHub hisobingizni ulang.
2. "Add New" → "Project" → repozitoriyingizni tanlang.
3. **Root Directory** — "Edit" tugmasi orqali `frontend` ni tanlang.
4. **Environment Variables** bo'limiga qo'shing:
   - `VITE_API_URL` = `https://erp-backend-xxxx.onrender.com/api/v1` (2-qadamdagi Render manzili + `/api/v1`)
5. "Deploy" tugmasini bosing. Tugagach, Vercel domeningizni beradi: `https://erp-xxxx.vercel.app`.

## 4. Render'ga qaytib CORS'ni to'ldirish

1. Render dashboard → `erp-backend` → **Environment** → `CORS_ORIGIN` qiymatini Vercel domeningizga o'zgartiring: `https://erp-xxxx.vercel.app`
2. Saqlang — Render xizmatni avtomatik qayta ishga tushiradi.

## 5. Ma'lumotlar bazasini to'ldirish (admin foydalanuvchi)

Bazada hali hech kim yo'q — demo ma'lumotlar bilan yoki faqat admin bilan boshlashingiz mumkin. O'zingizning kompyuteringizdan, Neon bazasiga ulanib:

```bash
# backend papkasida, vaqtincha .env'dagi DATABASE_URL'ni Neon'nikiga almashtiring (yoki inline bering):
cd backend
DATABASE_URL="<Neon connection string>" pnpm prisma migrate deploy
DATABASE_URL="<Neon connection string>" pnpm seed   # demo ma'lumotlar + admin (jamshid@gmail.com / narco123)
```

Agar demo ma'lumotlarsiz, faqat admin kerak bo'lsa — ayting, buning uchun alohida qisqa skript tayyorlab beraman.

## 6. Tekshirish

`https://erp-xxxx.vercel.app/login` ga kirib, `jamshid@gmail.com` / `narco123` bilan login qiling. Birinchi so'rov Render "uyg'onishi" tufayli sekinroq bo'lishi mumkin (~30-60s) — bu normal.

## Bilib qo'yish kerak bo'lgan cheklovlar (bepul tarif)

- Render backend 15 daqiqa faolsizlikdan keyin uxlaydi.
- Render'ning fayl tizimi vaqtinchalik — yuklangan logotip fayli qayta deploy/restart'da yo'qoladi (agar logo funksiyasidan foydalansangiz, buni doimiy saqlash uchun alohida yechim kerak bo'ladi — masalan Cloudinary bepul tarifi).
- Neon bepul tarifda baza uzoq vaqt ishlatilmasa "uxlaydi", birinchi so'rovda biroz kechikish bo'lishi mumkin.
