# ERP — Korxona boshqaruv tizimi

Loyiha talablari **TZ_ERP_tizimi.md** faylida. Har doim unga amal qil.

## Buzilmas qoidalar

1. **Pul — Decimal.** Pul summalari `DECIMAL(16,2)`, miqdorlar `DECIMAL(12,3)`. Float/double TAQIQLANADI (NFR-7).
2. **Modullararo operatsiyalar — bitta DB tranzaksiyasida** (`prisma.$transaction`). Yarim bajarilgan holat bo'lishi mumkin emas (NFR-8).
3. **Pul harakati faqat `Payment` orqali.** Buyurtma/xarid hujjati qarzni keltirib chiqaradi; `Transaction` faqat to'lov, avans, vedomost yoki qo'lda amaliyotdan tug'iladi (6-bo'lim, 3-tamoyil).
4. **Hech narsa jismonan o'chirilmaydi** — soft-delete / status (NFR-9). Istisno: `draft` buyurtma, `manual` tranzaksiya, to'lov (audit yozuvi bilan).
5. **Hisoblanadigan qiymatlar saqlanmaydi** (qoldiq, balans, qarz) — harakatlardan hisoblanadi. Yagona istisno: `Product.avgCost` (NFR-10, FR-2.12).
6. Qoldiq hech qachon manfiy bo'lmaydi — invariant DB tranzaksiyasi darajasida himoyalanadi (FR-2.7).

## Konvensiyalar

- Interfeys tili — o'zbek (lotin), matnlar `frontend/src/locales/uz.json` da. Kod, identifikatorlar, kommitlar — ingliz tilida.
- REST API prefiksi `/api/v1`. Javob: `{ data, meta? }`; xato: `{ statusCode, message, error }`.
- Har bir endpoint: JWT auth + `@Roles()` guard (2.1-huquqlar matritsasi).
- Muhim amallar audit jurnaliga yoziladi (NFR-5).
- Sana: `DD.MM.YYYY`. Pul: `1 250 000 so'm`. Qarz/manfiy — qizil.

## Ishga tushirish (dev)

```bash
docker compose up -d        # postgres (yoki lokal portable postgres, pastga qarang)
pnpm install
pnpm --filter backend prisma:migrate
pnpm seed                   # demo foydalanuvchilar (parol: Demo1234!)
pnpm dev:backend            # http://localhost:3000/api/v1
pnpm dev:frontend           # http://localhost:5173
```

Docker bo'lmasa: lokal PostgreSQL 16 (`C:\Users\user\erp-tools\pgsql`, data: `C:\Users\user\erp-tools\pgdata`) — `scripts/pg-start.ps1` bilan ishga tushadi.

## Tuzilma

- `backend/` — NestJS + Prisma (modulli monolit; har modul: controller + service + dto)
- `frontend/` — React 18 + Vite + Tailwind + shadcn/ui
- Bosqichlar rejasi: TZ 10-bo'lim. Joriy holat: Bosqich 0 bajarilgan.
