# ERP — Korxona boshqaruv tizimi

O'rta biznes uchun CRM + Ombor + Moliya + HR modullarini birlashtirgan veb-ilova.
Texnik topshiriq: [TZ_ERP_tizimi.md](TZ_ERP_tizimi.md).

## Texnologiyalar

| Qatlam | Texnologiya |
|---|---|
| Backend | NestJS + TypeScript + Prisma (modulli monolit) |
| Baza | PostgreSQL 16 |
| Frontend | React 18 + Vite + TailwindCSS + shadcn/ui + TanStack Query + Recharts |
| PDF / Excel | pdfkit / exceljs |
| Test | Vitest + Supertest (e2e) |

## Ishga tushirish (dev)

Talablar: Node.js 20+, pnpm 9+, Docker (yoki lokal PostgreSQL 16).

```bash
# 1. Bazani ko'tarish
docker compose up -d          # postgres:16, port 5432, db: erp

# Docker bo'lmasa (Windows, portable PostgreSQL):
#   powershell -ExecutionPolicy Bypass -File scripts/pg-start.ps1

# 2. Bog'liqliklar
pnpm install

# 3. Muhit sozlamalari
#   backend/.env faylida DATABASE_URL va JWT sirlarini tekshiring
#   (namuna: backend/.env.example)

# 4. Migratsiya va demo ma'lumotlar
pnpm --filter backend prisma:migrate
pnpm seed                     # demo foydalanuvchilar + to'liq demo dataset

# 5. Serverlar
pnpm dev:backend              # http://localhost:3000/api/v1
pnpm dev:frontend             # http://localhost:5173
```

## Foydalanuvchilar

| Email | Parol | Rol |
|---|---|---|
| jamshid@gmail.com | `narco123` | Direktor / Administrator |
| accountant@demo.uz | `Demo1234!` | Buxgalter |
| warehouse@demo.uz | `Demo1234!` | Omborchi |
| sales@demo.uz | `Demo1234!` | Savdo menejeri |
| hr@demo.uz | `Demo1234!` | HR menejeri |

`pnpm seed` idempotent: demo ma'lumotlar bir marta yaratiladi, qayta ishga
tushirishda o'tkazib yuboriladi. Seed tarkibi — TZ Ilova A (15 mahsulot, 6 xarid,
6 buyurtma, qarzdorlik, 12 xodim, vedomost, 6 oylik moliya tarixi va h.k.).

## Testlar

```bash
cd backend
npx vitest run                # unit (qoldiq invarianti) + e2e (39 test)
```

E2e testlar ishlayotgan PostgreSQL va seed qilingan demo foydalanuvchilarni
talab qiladi.

## Tuzilma

```
backend/
├── prisma/            # sxema, migratsiyalar, seed (Ilova A)
└── src/
    ├── common/        # guardlar, audit, PDF, davr utillari
    └── modules/       # auth, users, customers, deals, orders, sales-returns,
                       # warehouses, categories, products, suppliers, purchases,
                       # purchase-returns, stock, imports, finance, payments,
                       # invoices, settings, hr, notifications, dashboard,
                       # reports, search
frontend/
└── src/
    ├── api/           # axios klient + modul API qatlamlari
    ├── components/    # layout (sidebar, header, qidiruv, bildirishnoma), ui
    ├── lib/           # auth, i18n, format, menyu (RBAC)
    ├── locales/       # uz.json — barcha interfeys matnlari
    └── pages/         # sales/, warehouse/, finance/, hr/, system/
```

## Asosiy tamoyillar (TZ 6-bo'lim)

1. Pul — `DECIMAL(16,2)`, miqdor — `DECIMAL(12,3)`; float taqiqlangan.
2. Modullararo operatsiyalar bitta `prisma.$transaction` ichida.
3. Pul harakati faqat `Payment` orqali; buyurtma/xarid qarz keltiradi.
4. Hech narsa jismonan o'chirilmaydi (soft-delete/status), istisnolar auditga yoziladi.
5. Qoldiq, balans, qarz — saqlanmaydi, harakatlardan hisoblanadi (istisno: `Product.avgCost`).
6. Qoldiq manfiy bo'lmaydi — invariant DB tranzaksiyasi darajasida himoyalangan.
