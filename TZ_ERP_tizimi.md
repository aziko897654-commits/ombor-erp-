# Texnik topshiriq (TZ)
# ERP — Korxona boshqaruv tizimi

| Maydon | Qiymat |
|---|---|
| Loyiha nomi | ERP — Korxona boshqaruv tizimi (o'rta biznes uchun) |
| Versiya | **1.2** (boyitilgan MVP) — o'zgarishlar: Ilova B |
| Sana | 2026-07-09 |
| Hujjat maqsadi | Claude Code yordamida ishlab chiqish uchun to'liq texnik topshiriq |
| Til | Interfeys — o'zbek tili; kod, identifikatorlar, kommitlar — ingliz tili |

---

## 1. Umumiy ma'lumot

### 1.1. Loyiha tavsifi
CRM + HR + Ombor + Moliya modullarini bitta tizimda birlashtiradigan veb-ilova. Direktorat kompaniyaning barcha bo'limlarini real vaqtda bitta paneldan kuzatadi. Barcha modullar yagona ma'lumotlar bazasi ustida ishlaydi ("single source of truth").

### 1.2. Muammo
O'rta biznesda bo'limlar ma'lumotlari tarqoq: savdo — Excelda, buxgalteriya — alohida dasturda, ombor — daftar/jadvallarda. Natijada raqamlar bir-biriga mos kelmaydi, rahbariyat real holatni ko'ra olmaydi. SAP, Oracle kabi tizimlar juda qimmat va murakkab; 1C interfeysi eskirgan va sozlash uchun alohida mutaxassis talab qiladi.

### 1.3. Maqsad
20–200 xodimli o'rta biznes uchun sodda, zamonaviy va hamyonbop ERP tizimining kengaytirilgan MVP versiyasini yaratish.

### 1.4. Maqsadli foydalanuvchilar
- Kompaniya rahbari (direktor) — umumiy ko'rsatkichlar va qarzdorlikni kuzatadi
- Buxgalter — moliya, to'lovlar va qarzdorlik bilan ishlaydi
- Omborchi — omborlar, xaridlar va yetkazib beruvchilar bilan ishlaydi
- Savdo menejeri — CRM va buyurtmalar bilan ishlaydi
- HR menejeri — xodimlar, davomat va ish haqi bilan ishlaydi

### 1.5. Asosiy qabul qilish mezoni (loyiha kartasidan)
> Kompaniya rahbari tizimni bir hafta sinab ko'radi — har bo'limdan ma'lumot ko'ra oladi.

Bu mezon quyidagini anglatadi: har bir modul minimal, lekin **real ishlaydigan** funksiyaga ega bo'lishi shart. Chuqurlik emas, qamrov muhim. Rahbar sinovni o'z kompaniyasining real ma'lumotlari bilan o'tkazishi uchun **Excel import** funksiyasi majburiy.

### 1.6. Chegaralar (scope)
**Kiradi:** autentifikatsiya va RBAC; 5 ta asosiy modul (Savdo/CRM, Ombor, Moliya, HR, Direktor paneli); yetkazib beruvchilar va xarid hujjatlari; **to'lovlar va qarzdorlik (debitor/kreditor)**, shu jumladan qisman to'lovlar; **bir nechta ombor** va omborlararo ko'chirish; **sotuv va xarid qaytarishlari**; **inventarizatsiya**; hisoblar orasida pul o'tkazish (kassa↔bank); **o'rtacha tannarx (AVCO) va yalpi foyda hisobi**; mahsulotlar/mijozlarni **Excel'dan import**; hisob-faktura va yuk xatini **PDF chop etish**; chegirmalar; ish haqida avans/bonus/jarima; tizim ichidagi bildirishnomalar; global qidiruv; sozlamalar (kompaniya rekvizitlari); audit jurnali sahifasi; hisobotlar va eksport; seed (demo) ma'lumotlar.

**Kirmaydi (keyingi versiyalarga):** ko'p-kompaniyalilik (multi-tenant), ko'p valyuta (faqat UZS), soliq hisobotlari integratsiyasi, ishlab chiqarish (production) moduli, mobil ilova, Telegram-bot integratsiyasi, real-time (WebSocket) bildirishnomalar — bildirishnomalar polling orqali, rus tili tarjimasi (i18n strukturasi tayyorlanadi, lekin faqat o'zbek tili to'ldiriladi).

---

## 2. Foydalanuvchi rollari va huquqlar (RBAC)

Tizimda 5 ta rol mavjud. Rol foydalanuvchiga admin tomonidan biriktiriladi.

| Rol (kod) | Nomi | Tavsif |
|---|---|---|
| `admin` | Direktor / Administrator | Barcha modullarga to'liq kirish + foydalanuvchilar va sozlamalar |
| `accountant` | Buxgalter | Moliya, to'lovlar, qarzdorlik (to'liq) |
| `warehouse` | Omborchi | Omborlar, mahsulotlar, xaridlar, yetkazib beruvchilar (to'liq) |
| `sales` | Savdo menejeri | Savdo/CRM (to'liq), qoldiq va mijoz balansini o'qish |
| `hr` | HR menejeri | Xodimlar moduli (to'liq) |

### 2.1. Huquqlar matritsasi

| Modul | admin | accountant | warehouse | sales | hr |
|---|---|---|---|---|---|
| Direktor paneli | CRUD | — | — | — | — |
| Moliya (hisoblar, tranzaksiyalar, hisob-faktura) | CRUD | CRUD | — | — | — |
| To'lovlar va qarzdorlik | CRUD | CRUD | — | R (mijoz balansi) | — |
| Ombor (mahsulot, qoldiq, ko'chirish, inventarizatsiya) | CRUD | — | CRUD | R (qoldiq) | — |
| Yetkazib beruvchilar va xaridlar | CRUD | R | CRUD | — | — |
| Savdo (CRM) | CRUD | — | — | CRUD | — |
| Qaytarishlar (sotuv / xarid) | CRUD | R | xarid qayt. | sotuv qayt. | — |
| Xodimlar (HR) | CRUD | R (ish haqi) | — | — | CRUD |
| Hisobotlar | Barchasi | Moliya, qarzdorlik | Ombor | Savdo | HR |
| Import (Excel) | Barchasi | — | Mahsulotlar | Mijozlar | — |
| Foydalanuvchilar, sozlamalar, audit | CRUD | — | — | — | — |
| Bildirishnomalar | O'ziniki | O'ziniki | O'ziniki | O'ziniki | O'ziniki |

R — faqat o'qish (read), CRUD — to'liq boshqaruv. "—" — modul menyuda ko'rinmaydi va API 403 qaytaradi.

### 2.2. RBAC texnik talablari
- Huquq tekshiruvi **ikki qatlamda**: backend (guard/middleware, har bir endpoint) va frontend (menyu/sahifalarni yashirish).
- Frontend yashirishi xavfsizlik hisoblanmaydi — asosiy himoya backendda.
- Rol o'zgartirilganda foydalanuvchi keyingi so'rovdan boshlab yangi huquqlar bilan ishlaydi.

---

## 3. Funksional talablar

### 3.0. Autentifikatsiya va foydalanuvchilar boshqaruvi
- **FR-0.1.** Login: email + parol. Muvaffaqiyatli kirishda JWT access token (15 daq.) + refresh token (7 kun, httpOnly cookie).
- **FR-0.2.** Parollar bazada faqat bcrypt hash ko'rinishida saqlanadi (saltRounds = 10).
- **FR-0.3.** Admin foydalanuvchilarni yaratadi/tahrirlaydi/faolsizlantiradi (o'chirmaydi — `is_active=false`). Maydonlar: ism, familiya, email, rol, parol.
- **FR-0.4.** Foydalanuvchi o'z parolini o'zgartira oladi (eski parolni kiritish shart).
- **FR-0.5.** Login sahifasiga rate limit: 1 daqiqada 5 urinish (IP bo'yicha).

### 3.1. Savdo (CRM) moduli
- **FR-1.1. Mijozlar:** CRUD. Maydonlar: nomi (tashkilot/jismoniy shaxs), telefon, email, manzil, izoh. Qidiruv (nomi/telefon) va pagination.
- **FR-1.2. Mijoz kartasi:** ma'lumotlar + **balans bloki** (jami xaridlar, jami to'lovlar, joriy qarz — FR-3.7 formulasi) + buyurtmalar tarixi + to'lovlar tarixi.
- **FR-1.3. Bitimlar (deals):** kanban-voronka. Bosqichlar: `new` → `negotiation` → `won` / `lost`. Maydonlar: nomi, mijoz, summa (UZS), bosqich, mas'ul menejer, izoh. Drag-and-drop bilan bosqich o'zgartirish.
- **FR-1.4. Buyurtmalar (orders):** bitim `won` bo'lganda yoki mustaqil yaratiladi. Maydonlar: mijoz, **ombor (qaysi ombordan yuk ketadi)**, pozitsiyalar (mahsulot, miqdor, narx), **chegirma** (summa yoki foiz, buyurtma darajasida), jami = pozitsiyalar − chegirma. Statuslar: `draft` → `confirmed` → `shipped` → `cancelled`.
- **FR-1.5. Tasdiqlash integratsiyasi (muhim!):** buyurtma `confirmed` bo'lganda **bitta DB tranzaksiyasi ichida**:
  1) har bir pozitsiya bo'yicha tanlangan ombordan chiqim harakati (`stock_movement`, type=`sale`) yaratiladi;
  2) shu ombordagi qoldiq yetarli bo'lmasa — butun operatsiya bekor qilinadi va aniq xato qaytariladi ("Mahsulot X: Asosiy omborda qoldiq 5 dona, so'ralgan 8 dona");
  3) buyurtma summasi mijozning **debitor qarziga** kiradi (alohida yozuv shart emas — qarz hisoblanadigan qiymat, FR-3.7);
  4) har bir pozitsiyaga joriy o'rtacha tannarx muhrlanadi (`OrderItem.cost`, FR-2.12) — foyda hisoboti uchun.
  Diqqat: **kirim tranzaksiyasi bu bosqichda YARATILMAYDI** — pul faqat to'lov (FR-3.6) kiritilganda keladi. Bu real hayotdagi "nasiya savdo"ni to'g'ri aks ettiradi.
- **FR-1.6. Bekor qilish:** faqat `confirmed` holatidan. Buyurtma bo'yicha to'lovlar mavjud bo'lsa — bekor qilish taqiqlanadi (avval to'lovlar o'chirilishi kerak, xabar ko'rsatiladi). Bekor qilishda ombor qaytim harakatlari (+) yaratiladi.
- **FR-1.7.** `confirmed` buyurtma pozitsiyalari va chegirmasi tahrirlanmaydi.
- **FR-1.8. Sotuv qaytarishi (sales return):** faqat `confirmed`/`shipped` buyurtma asosida, raqam `SRT-YYYY-0001`. Pozitsiyalar buyurtma pozitsiyalaridan tanlanadi; qaytariladigan miqdor ≤ (sotilgan − avval qaytarilgan). Saqlanganda **bitta DB tranzaksiyasida**: buyurtma omboriga kirim harakatlari (type=`sale_return`, +) yaratiladi va qaytarish summasi (pozitsiya narxlari bo'yicha) mijoz qarzini kamaytiradi (FR-3.7). Qaytarishdan so'ng mijoz ortiqcha to'lagan bo'lib qolsa — farq unga pul qaytarish (`Payment`, out+mijoz) orqali rasmiylashtiriladi.
- **FR-1.9. Yuk xati (PDF):** `confirmed`/`shipped` buyurtma uchun A4 hujjat: kompaniya rekvizitlari, mijoz, ombor, pozitsiyalar (chegirma va jami bilan), topshirdi/qabul qildi imzo joylari.

### 3.2. Ombor moduli
- **FR-2.0. Omborlar:** CRUD. Maydonlar: nomi (unikal), manzil, faollik. Seed'da kamida bitta "Asosiy ombor". Barcha harakatlarda ombor ko'rsatiladi.
- **FR-2.1. Mahsulotlar:** CRUD. Maydonlar: nomi, SKU (unikal), **shtrix-kod (barcode, unikal, ixtiyoriy)**, kategoriya, o'lchov birligi (dona/kg/litr/metr), tannarx, sotuv narxi, minimal zaxira (`min_stock`), izoh. Ro'yxatda qidiruv nomi/SKU/shtrix-kod bo'yicha ishlaydi (skaner shtrix-kodni oddiy matn sifatida kiritadi).
- **FR-2.2. Kategoriyalar:** oddiy ro'yxat (CRUD, ichma-ich emas).
- **FR-2.3. Yetkazib beruvchilar:** CRUD. Maydonlar: nomi, telefon, email, manzil, izoh. Kartasida: xaridlar tarixi, to'lovlar tarixi, joriy kreditor qarz.
- **FR-2.4. Xarid (kirim) hujjati:** maydonlar: yetkazib beruvchi, **ombor**, sana, pozitsiyalar (mahsulot, miqdor, tannarx), jami. Raqamlash: `PUR-YYYY-0001`. Saqlanganda **bitta DB tranzaksiyasida**: har bir pozitsiya `stock_movement` (type=`purchase`, +) sifatida yoziladi va hujjat summasi yetkazib beruvchiga **kreditor qarz** sifatida hisobga kiradi (FR-3.7). Chiqim tranzaksiyasi YARATILMAYDI — to'lov alohida (FR-3.6). Pozitsiyadagi tannarx mahsulot kartasidagi `costPrice`ni yangilaydi (oxirgi xarid narxi).
- **FR-2.5. Qo'lda chiqim (write-off):** ombor + sabab (brak, yo'qolish) ko'rsatilib rasmiylashtiriladi. `stock_movement` type=`writeoff`, quantity manfiy.
- **FR-2.6. Omborlararo ko'chirish (transfer):** hujjat: qayerdan, qayerga, sana, pozitsiyalar. **Bitta DB tranzaksiyasida** har bir pozitsiya uchun ikkita harakat: (−, from, type=`transfer`) va (+, to, type=`transfer`), ikkalasi ham `refType='transfer', refId=<hujjat id>`. From-ombordagi qoldiq tekshiriladi.
- **FR-2.7. Qoldiq:** mahsulot qoldig'i **har bir ombor kesimida** = shu mahsulot+ombor bo'yicha `stock_movement.quantity` yig'indisi; umumiy qoldiq = omborlar yig'indisi. Qoldiq hech qachon manfiy bo'lmaydi — invariant DB tranzaksiyasi darajasida himoyalanadi. Mahsulotlar ro'yxatida umumiy qoldiq ustuni + ombor bo'yicha filtr.
- **FR-2.8. Kam zaxira ogohlantirishi:** umumiy qoldiq ≤ `min_stock` bo'lgan mahsulotlar ro'yxati alohida ko'rinadi, direktor panelida soni chiqadi, bildirishnoma yaratiladi (FR-7.2).
- **FR-2.9. Harakatlar tarixi:** har bir mahsulot sahifasida barcha kirim-chiqimlar jurnali (sana, ombor, tur, miqdor, kim, bog'langan hujjat havolasi).
- **FR-2.10. Xarid qaytarishi (purchase return):** xarid hujjati asosida, raqam `PRT-YYYY-0001`; miqdor cheklovi xariddagidek (≤ olingan − avval qaytarilgan). Saqlanganda **bitta DB tranzaksiyasida**: xarid omboridan chiqim harakatlari (type=`purchase_return`, −; qoldiq tekshiriladi) va summa yetkazib beruvchi qarzini kamaytiradi (FR-3.7).
- **FR-2.11. Inventarizatsiya:** ombor tanlanadi → tizim joriy (tizimdagi) qoldiqlar ro'yxatini hujjatga muhrlaydi → omborchi haqiqiy sanoq miqdorlarini kiritadi → farqlar ustuni ko'rsatiladi → tasdiqlangach har bir farq uchun `adjustment` harakati (+/−) yaratiladi va qoldiq haqiqiyga tenglashadi. Raqam `INVT-YYYY-0001`, holati: `draft` → `completed` (`draft`ni keyin davom ettirish mumkin, `completed` o'zgarmaydi).
- **FR-2.12. O'rtacha tannarx (AVCO):** mahsulotning `avgCost` qiymati har bir xarid kirimida shu tranzaksiya ichida qayta hisoblanadi: `avgCost = (umumiy qoldiq × eski avgCost + kirim miqdori × kirim narxi) / yangi umumiy qoldiq` (qoldiq 0 bo'lsa avgCost = kirim narxi). Buyurtma tasdiqlanganda pozitsiyaga o'sha paytdagi `avgCost` muhrlanadi (`OrderItem.cost`). Ombor qiymati va foyda hisoboti aynan shu qiymatlarga tayanadi.

### 3.3. Moliya moduli
- **FR-3.1. Hisoblar (accounts):** kassa va bank hisoblari. Maydonlar: nomi, turi (`cash`/`bank`), boshlang'ich qoldiq. Valyuta — faqat UZS.
- **FR-3.2. Tranzaksiyalar:** kirim (`income`) va chiqim (`expense`). Maydonlar: sana, hisob, summa, kategoriya, izoh, manba (`manual`, `payment`, `salary`, `advance`). Qo'lda faqat `manual` yaratiladi (ijara, kommunal va h.k.). Avtomatik tranzaksiyalar tahrirlanmaydi/o'chirilmaydi — faqat manba hujjat orqali.
- **FR-3.3. Kategoriyalar:** kirim/chiqim kategoriyalari (CRUD). Seed: Savdo tushumi, Mahsulot xaridi, Ish haqi, Ish haqi avansi, Ijara, Kommunal, Boshqa.
- **FR-3.4. Balans:** har bir hisob bo'yicha joriy qoldiq (boshlang'ich + kirim − chiqim), davr bo'yicha pul oqimi (kirim/chiqim/farq).
- **FR-3.5. Hisob-faktura (invoice):** buyurtma asosida yaratiladi, raqam `INV-YYYY-0001`. Statuslar: `draft` → `sent` → `paid`. Buyurtma bo'yicha to'lovlar yig'indisi ≥ buyurtma jamisiga yetganda status avtomatik `paid` bo'ladi. **Chop etish (PDF):** A4 format, sozlamalardagi kompaniya rekvizitlari (nomi, manzil, STIR, bank rekvizitlari, logotip) + mijoz + pozitsiyalar + chegirma + jami + pastki matn.
- **FR-3.6. To'lovlar (payments) — modul yadrosi:**
  - Yo'nalishi va kontragent kombinatsiyalari: `in`+mijoz (buyurtma to'lovi), `out`+mijoz (mijozga pul qaytarish — masalan, sotuv qaytarishidan keyin), `out`+yetkazib beruvchi (xarid to'lovi), `in`+yetkazib beruvchi (undan qaytarim puli).
  - Maydonlar: sana, hisob, summa, kontragent (mijoz yoki yetkazib beruvchi), bog'langan hujjat (buyurtma yoki xarid — ixtiyoriy; ko'rsatilmasa umumiy balansga), izoh.
  - To'lov saqlanganda avtomatik `Transaction` (income/expense, source=`payment`) yaratiladi — bitta DB tranzaksiyasida.
  - **Qisman to'lov qo'llab-quvvatlanadi:** bitta buyurtma bir necha to'lov bilan yopilishi mumkin; ortiqcha to'lov (buyurtma jamisidan ko'p) taqiqlanadi (bog'langan hujjat ko'rsatilganda).
  - To'lovni o'chirish → bog'liq tranzaksiya ham o'chadi, qarz va invoice statusi qayta hisoblanadi. O'chirish audit jurnaliga yoziladi.
- **FR-3.7. Qarzdorlik (debitor/kreditor):**
  - Mijoz qarzi = SUM(`confirmed`+`shipped` buyurtmalar jamisi) − SUM(sotuv qaytarishlari) − SUM(`in`+mijoz to'lovlari) + SUM(`out`+mijoz pul qaytarishlari). Musbat — mijoz bizga qarzdor.
  - Yetkazib beruvchi qarzi = SUM(xarid hujjatlari jamisi) − SUM(xarid qaytarishlari) − SUM(`out`+yetkazib beruvchi to'lovlari) + SUM(`in`+yetkazib beruvchi qaytarimlari). Musbat — biz qarzdormiz.
  - Alohida sahifa: ikkita jadval — qarzdor mijozlar (summa bo'yicha kamayish tartibida) va kreditorlar. Har bir qatordan kontragent kartasiga o'tiladi.
- **FR-3.8.** 7 kundan ortiq to'lanmagan (`sent` holatidagi) hisob-fakturalar bo'yicha bildirishnoma yaratiladi (FR-7.2).
- **FR-3.9. Hisoblar orasida o'tkazish:** kassa↔bank pul o'tkazmasi: sana, qayerdan, qayerga, summa, izoh. **Bitta DB tranzaksiyasida** ikkita `Transaction` yaratiladi: expense (chiquvchi hisobda) va income (kiruvchi hisobda), ikkalasi ham source=`transfer`, umumiy `refId` (MoneyTransfer.id). MUHIM: source=`transfer` yozuvlari tushum/xarajat KPI'lari va moliyaviy hisobotga KIRMAYDI — faqat hisob balanslariga ta'sir qiladi. Chiquvchi hisobda mablag' yetarliligi tekshiriladi.

### 3.4. Xodimlar (HR) moduli
- **FR-4.1. Xodimlar:** CRUD. Maydonlar: F.I.Sh., telefon, email, bo'lim, lavozim, oylik maosh (UZS), ishga kirgan sana, holat (`active`/`fired`). Kartasida: davomat xulosasi, ish haqi to'lovlari tarixi.
- **FR-4.2. Bo'limlar va lavozimlar:** oddiy ro'yxatlar (CRUD).
- **FR-4.3. Davomat:** kunlik jurnal — holatlar: `present`, `absent`, `vacation`, `sick`. Oy bo'yicha jadval (qatorlar — xodimlar, ustunlar — kunlar), katak bosilganda holat almashadi.
- **FR-4.4. Avans:** oy davomida xodimga avans beriladi: xodim, sana, summa, hisob. Saqlanganda chiqim tranzaksiyasi (source=`advance`, kategoriya "Ish haqi avansi") yaratiladi va joriy oy vedomostida avtomatik ayiriladi.
- **FR-4.5. Ish haqi vedomosti:** oy tanlanadi → tizim faol xodimlar ro'yxatini chiqaradi. Har bir qatorda: bazaviy maosh + **bonus** − **jarima** (ikkalasi qo'lda, izoh bilan) − **avanslar** (avtomatik) = qo'lga tegishi (net). HR tasdiqlaydi → vedomost yaratiladi va moliyada bitta chiqim tranzaksiyasi (source=`salary`, kategoriya "Ish haqi", summa = jami net) hosil bo'ladi. Bir oy uchun ikkinchi vedomost yaratib bo'lmaydi.
- **FR-4.6.** Ishdan bo'shatish — `fired` statusi + sana (ma'lumot o'chirilmaydi). `fired` xodim keyingi vedomostlarga kirmaydi.

### 3.5. Direktor paneli (dashboard)
Faqat `admin` roli uchun.
- **FR-5.1. Davr tanlagich:** bugun / shu hafta / shu oy / chorak / yil / ixtiyoriy oraliq. Barcha KPI va grafiklar tanlangan davrga bo'ysunadi.
- **FR-5.2. KPI kartalar (solishtirish bilan):** tushum, xarajat, foyda (tushum − xarajat), pul qoldig'i (kassa+bank). Har bir kartada o'tgan xuddi shunday davrga nisbatan o'zgarish foizi (▲ yashil / ▼ qizil).
- **FR-5.3. Qo'shimcha kartalar:** mijozlar qarzi (debitor jami), yetkazib beruvchilarga qarz (kreditor jami), **yalpi foyda** (davr sotuvlari: Σ(narx − `OrderItem.cost`) × miqdor, qaytarishlar ayirilgan), ombor qiymati (qoldiq × `avgCost`), ochiq bitimlar soni va summasi, faol xodimlar soni, kam zaxiradagi mahsulotlar soni.
- **FR-5.4. Grafiklar:** oxirgi 12 oy tushum/xarajat (ustunli), bitimlar voronkasi, top-5 sotilgan mahsulot (tanlangan davr).
- **FR-5.5.** Barcha raqamlar bosilganda tegishli modul sahifasiga (filtrlangan holda) o'tadi.

### 3.6. Hisobotlar moduli
- **FR-6.1.** Har bir hisobotda davr filtri (dan/gacha) va **Excel (.xlsx)** hamda **PDF** eksport tugmalari.
- **FR-6.2. Hisobotlar ro'yxati:**
  1) Moliyaviy hisobot — kirim/chiqim kategoriyalar kesimida;
  2) Sotuvlar hisoboti — buyurtmalar, mijozlar va mahsulotlar kesimida (chegirmalar bilan);
  3) Ombor hisoboti — omborlar kesimida joriy qoldiqlar va davr harakatlari;
  4) **Qarzdorlik hisoboti** — sana holatiga debitor/kreditor ro'yxati;
  5) **To'lovlar hisoboti** — davr bo'yicha kirim/chiqim to'lovlar, kontragentlar kesimida;
  6) Davomat hisoboti — oy bo'yicha xodimlar davomati;
  7) **Foyda hisoboti** — davr sotuvlari bo'yicha yalpi foyda, mahsulot va mijoz kesimida (`OrderItem.cost` asosida, sotuv qaytarishlari ayirilgan).
- **FR-6.3.** Hisobot faqat foydalanuvchi roliga ochiq modullar bo'yicha ko'rinadi (2.1-matritsa).

### 3.7. Bildirishnomalar
- **FR-7.1.** Headerda qo'ng'iroqcha belgisi + o'qilmaganlar soni. Ro'yxat ochilganda: sarlavha, matn, vaqt, havola (bosilganda tegishli sahifaga o'tadi). "O'qildi" belgilash (bittalab va barchasini). Yangilanish — polling, har 60 soniyada.
- **FR-7.2. Hodisalar va qabul qiluvchilar:**
  | Hodisa | Kimga |
  |---|---|
  | Mahsulot qoldig'i `min_stock`dan tushdi | admin, warehouse |
  | Hisob-faktura 7 kundan beri to'lanmagan | admin, accountant |
  | Buyurtma tasdiqlandi | admin |
  | Oylik vedomost yaratildi | admin |
- **FR-7.3.** Bir xil hodisa bo'yicha bildirishnoma takrorlanmaydi (masalan, ayni mahsulot bo'yicha kam zaxira — holat tiklanmaguncha bitta marta).

### 3.8. Excel import
- **FR-8.1.** Ikki obyekt uchun: **mahsulotlar** (warehouse, admin) va **mijozlar** (sales, admin).
- **FR-8.2.** Jarayon: 1) shablon (.xlsx) yuklab olinadi (ustun sarlavhalari bilan); 2) to'ldirilgan fayl yuklanadi; 3) tizim satrma-satr validatsiya qiladi va **oldindan ko'rish** jadvalini chiqaradi: nechta yangi, nechta xato (satr raqami + sabab), nechta dublikat (SKU/telefon bo'yicha — o'tkazib yuboriladi); 4) foydalanuvchi tasdiqlagach faqat to'g'ri satrlar import qilinadi.
- **FR-8.3.** Import natijasi audit jurnaliga yoziladi (nechta yozuv, kim, qachon).
- **FR-8.4.** Mahsulot importi ustunlari: nomi*, SKU*, shtrix-kod, kategoriya* (yo'q bo'lsa avtomatik yaratiladi), birlik*, tannarx*, sotuv narxi*, min_stock. Mijoz importi: nomi*, telefon, email, manzil, izoh.

### 3.9. Sozlamalar (faqat admin)
- **FR-9.1.** Kompaniya rekvizitlari: nomi, manzil, telefon, STIR (INN), bank rekvizitlari (matn), hisob-faktura pastki matni.
- **FR-9.2.** Logotip yuklash (PNG/JPG, ≤ 1 MB, lokal `uploads/` papkasiga) — hisob-faktura PDFda ishlatiladi.
- **FR-9.3.** Sozlamalar — yagona yozuv (singleton), faqat tahrirlanadi.

### 3.10. Global qidiruv va audit jurnali
- **FR-10.1. Global qidiruv:** headerdagi qidiruv maydoni yoki `Ctrl+K`. Qidiradi: mijozlar (nomi/telefon), mahsulotlar (nomi/SKU/shtrix-kod), buyurtmalar (raqam), yetkazib beruvchilar (nomi). Natijalar guruhlangan ro'yxatda, tanlanganda sahifaga o'tadi. Har bir guruh foydalanuvchi roliga qarab filtrlangan.
- **FR-10.2. Audit jurnali sahifasi (admin):** barcha muhim amallar ro'yxati: kim, qachon, amal (`order.confirm`, `payment.delete`, `payroll.create`, `import.products` ...), obyekt. Filtrlar: foydalanuvchi, sana oralig'i, amal turi.

---

## 4. Nofunksional talablar

### 4.1. Xavfsizlik
- **NFR-1.** Parollar — faqat bcrypt hash. Tokenlar — JWT (access qisqa muddatli, refresh httpOnly cookie).
- **NFR-2.** Har bir API endpoint autentifikatsiya + rol guard'i bilan himoyalangan.
- **NFR-3.** Barcha kiruvchi ma'lumotlar validatsiya qilinadi (backend: class-validator / zod; frontend: zod).
- **NFR-4.** SQL-injection — ORM (Prisma) orqali parametrlangan so'rovlar; xom SQL ishlatilmaydi (aggregatsiya uchun `prisma.$queryRaw` faqat parametrlangan holda ruxsat).
- **NFR-5.** Muhim amallar audit logi: kim, qachon, qaysi obyekt ustida nima qildi (buyurtma tasdiqlash/bekor qilish, to'lov yaratish/o'chirish, xarid hujjati, ko'chirish, vedomost, foydalanuvchi yaratish, import, sozlamalar o'zgarishi).
- **NFR-6.** Fayl yuklash (logotip): faqat PNG/JPG, ≤ 1 MB, MIME tekshiruvi, fayl nomi qayta generatsiya qilinadi (path traversal himoyasi).

### 4.2. Ma'lumotlar yaxlitligi (data integrity)
- **NFR-7.** Pul summalari — `DECIMAL(16,2)`, miqdorlar — `DECIMAL(12,3)`. Floating point (float/double) ishlatish TAQIQLANADI.
- **NFR-8.** Bir nechta jadvalni o'zgartiruvchi operatsiyalar (buyurtma tasdiqlash/bekor qilish, xarid hujjati, ko'chirish, qaytarishlar, inventarizatsiya, to'lov, hisoblararo o'tkazish, avans, vedomost) — faqat DB tranzaksiyasi (`prisma.$transaction`) ichida. Yarim bajarilgan holat bo'lishi mumkin emas.
- **NFR-9.** Hech narsa jismonan o'chirilmaydi; muhim obyektlar uchun soft-delete / status ishlatiladi (foydalanuvchi, xodim, mahsulot, ombor). Istisno: `draft` buyurtma, `manual` tranzaksiya va to'lov — o'chirilishi mumkin (audit yozuvi bilan).
- **NFR-10.** Hisoblanadigan qiymatlar (qoldiq, hisob balansi, mijoz/yetkazib beruvchi qarzi) bazada saqlanmaydi — harakatlar/tranzaksiyalar/to'lovlardan hisoblanadi. Sekinlashsa keyin keshlanadi (MVPda shart emas). Yagona istisno — `Product.avgCost`: xarid tranzaksiyasi ichida yangilanadigan kesh (FR-2.12).

### 4.3. Ishlash (performance)
- **NFR-11.** Barcha ro'yxatlar server-side pagination bilan (default 20 qator).
- **NFR-12.** Dashboard, qarzdorlik va hisobot so'rovlari aggregatsiya bilan (SQL `SUM/COUNT/GROUP BY`); frontendda hisoblash taqiqlanadi.
- **NFR-13.** Sahifa birinchi ochilishi lokal muhitda < 2 soniya. Global qidiruv javobi < 500 ms (kerakli indekslar: `Product.sku`, `Product.barcode`, `Customer.name`, `Order.number`).

### 4.4. Interfeys
- **NFR-14.** Desktop-first, lekin 768px gacha moslashuvchan (responsive).
- **NFR-15.** Interfeys tili — o'zbek (lotin). Matnlar `uz.json` lug'at faylida saqlanadi.
- **NFR-16.** Yagona dizayn tizimi: bitta rang palitrasi, bitta jadval komponenti, bitta forma uslubi. Sana: `DD.MM.YYYY`. Pul: `1 250 000 so'm`. Manfiy/qarz summalari qizil rangda.

---

## 5. Texnologiyalar steki

| Qatlam | Texnologiya | Izoh |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite | SPA |
| UI | TailwindCSS + shadcn/ui | Tayyor, sifatli komponentlar |
| Routing | React Router v6 | Rolga qarab himoyalangan routelar |
| Server state | TanStack Query (React Query) | Kesh + refetch (bildirishnoma pollingi ham shu orqali) |
| Formalar | React Hook Form + Zod | Validatsiya sxemalari backend bilan bir xil mantiqda |
| Grafiklar | Recharts | Dashboard uchun |
| Backend | NestJS + TypeScript | Modulli monolit |
| ORM | Prisma | Migratsiyalar + type-safe so'rovlar |
| Baza | PostgreSQL 16 | Docker Compose orqali |
| Auth | @nestjs/jwt + passport-jwt | Access + refresh |
| Fayl yuklash | multer | Logotip (`uploads/`) |
| Excel | exceljs | Eksport ham, import (o'qish) ham |
| PDF | pdfkit | Hisobotlar va hisob-faktura chop etish |
| Test | Vitest (unit), Supertest (API e2e) | Kritik biznes-logika uchun majburiy |

**Repozitoriy tuzilmasi (monorepo):**

```
erp/
├── CLAUDE.md              # Claude Code uchun qisqa yo'riqnoma (ushbu TZga havola)
├── TZ_ERP_tizimi.md       # ushbu hujjat
├── docker-compose.yml     # postgres
├── backend/
│   ├── prisma/schema.prisma
│   ├── uploads/           # logotip
│   └── src/
│       ├── common/        # guards, decorators, filters, audit
│       └── modules/
│           ├── auth/  users/  customers/  deals/  orders/
│           ├── suppliers/  warehouses/  products/  stock/
│           ├── finance/  payments/  hr/
│           ├── dashboard/  reports/  notifications/
│           ├── imports/  settings/  search/
└── frontend/
    └── src/
        ├── api/  components/  lib/  locales/uz.json
        └── pages/ (modul bo'yicha papkalar)
```

---

## 6. Arxitektura tamoyillari

1. **Modulli monolit.** Bitta NestJS ilova, bitta PostgreSQL baza. Har bir modul o'z papkasida: controller + service + dto. Mikroservislar ISHLATILMAYDI.
2. **Modullararo bog'lanish faqat service qatlamida** va faqat bitta `$transaction` ichida. Masalan `OrdersService.confirm()` ichida `StockService.createMovements(tx, ...)` chaqiriladi.
3. **Pul harakati faqat `Payment` orqali.** Buyurtma/xarid hujjati qarzni keltirib chiqaradi; `Transaction` (income/expense) esa faqat to'lov, avans, vedomost yoki qo'lda amaliyotdan tug'iladi. Bu tamoyil buzilmasligi kerak — aks holda kassa va qarzdorlik raqamlari ikki marta hisoblanadi.
4. **REST API**, prefiks `/api/v1`. Javob formati: `{ data, meta? }`; xatolar: `{ statusCode, message, error }`.
5. **Hisoblanadigan qiymatlar saqlanmaydi** (qoldiq, balans, qarz) — NFR-10.

---

## 7. Ma'lumotlar bazasi sxemasi (Prisma)

Quyidagi sxema asos hisoblanadi; Claude Code aynan shu modellardan boshlaydi (maydonlarni qisqartirmasdan).

```prisma
enum Role { admin accountant warehouse sales hr }
enum DealStage { new negotiation won lost }
enum OrderStatus { draft confirmed shipped cancelled }
enum MovementType { purchase sale sale_return purchase_return writeoff transfer adjustment }
enum TxType { income expense }
enum TxSource { manual payment salary advance transfer }
enum PayDirection { in out }
enum AccountType { cash bank }
enum InvoiceStatus { draft sent paid }
enum CountStatus { draft completed }
enum AttendanceStatus { present absent vacation sick }
enum EmployeeStatus { active fired }

model User {
  id           Int      @id @default(autoincrement())
  email        String   @unique
  passwordHash String
  firstName    String
  lastName     String
  role         Role
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  deals        Deal[]
  auditLogs    AuditLog[]
  notifications Notification[]
}

model Customer {
  id        Int      @id @default(autoincrement())
  name      String
  phone     String?
  email     String?
  address   String?
  note      String?
  createdAt DateTime @default(now())
  deals     Deal[]
  orders    Order[]
  payments  Payment[]
}

model Supplier {
  id        Int        @id @default(autoincrement())
  name      String
  phone     String?
  email     String?
  address   String?
  note      String?
  createdAt DateTime   @default(now())
  purchases Purchase[]
  payments  Payment[]
}

model Deal {
  id         Int       @id @default(autoincrement())
  title      String
  customerId Int
  customer   Customer  @relation(fields: [customerId], references: [id])
  amount     Decimal   @db.Decimal(16, 2)
  stage      DealStage @default(new)
  managerId  Int
  manager    User      @relation(fields: [managerId], references: [id])
  note       String?
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
}

model Warehouse {
  id        Int             @id @default(autoincrement())
  name      String          @unique
  address   String?
  isActive  Boolean         @default(true)
  movements StockMovement[]
  orders    Order[]
  purchases Purchase[]
  stockCounts     StockCount[]
  salesReturns    SalesReturn[]
  purchaseReturns PurchaseReturn[]
}

model Order {
  id          Int         @id @default(autoincrement())
  number      String      @unique              // ORD-2026-0001
  customerId  Int
  customer    Customer    @relation(fields: [customerId], references: [id])
  warehouseId Int
  warehouse   Warehouse   @relation(fields: [warehouseId], references: [id])
  status      OrderStatus @default(draft)
  subtotal    Decimal     @db.Decimal(16, 2)   // pozitsiyalar yig'indisi
  discount    Decimal     @db.Decimal(16, 2) @default(0)
  total       Decimal     @db.Decimal(16, 2)   // subtotal - discount
  createdAt   DateTime    @default(now())
  items       OrderItem[]
  invoice     Invoice?
  payments    Payment[]
  returns     SalesReturn[]
}

model OrderItem {
  id        Int     @id @default(autoincrement())
  orderId   Int
  order     Order   @relation(fields: [orderId], references: [id])
  productId Int
  product   Product @relation(fields: [productId], references: [id])
  quantity  Decimal @db.Decimal(12, 3)
  price     Decimal @db.Decimal(16, 2)         // sotuv paytidagi narx (fiksatsiya)
  cost      Decimal @db.Decimal(16, 2) @default(0) // tasdiqlashdagi avgCost (FR-2.12)
}

model Purchase {
  id          Int            @id @default(autoincrement())
  number      String         @unique            // PUR-2026-0001
  supplierId  Int
  supplier    Supplier       @relation(fields: [supplierId], references: [id])
  warehouseId Int
  warehouse   Warehouse      @relation(fields: [warehouseId], references: [id])
  date        DateTime       @default(now())
  total       Decimal        @db.Decimal(16, 2)
  note        String?
  userId      Int
  createdAt   DateTime       @default(now())
  items       PurchaseItem[]
  payments    Payment[]
  returns     PurchaseReturn[]
}

model PurchaseItem {
  id         Int      @id @default(autoincrement())
  purchaseId Int
  purchase   Purchase @relation(fields: [purchaseId], references: [id])
  productId  Int
  product    Product  @relation(fields: [productId], references: [id])
  quantity   Decimal  @db.Decimal(12, 3)
  costPrice  Decimal  @db.Decimal(16, 2)
}

model Category {
  id       Int       @id @default(autoincrement())
  name     String    @unique
  products Product[]
}

model Product {
  id         Int      @id @default(autoincrement())
  name       String
  sku        String   @unique
  barcode    String?  @unique
  categoryId Int
  category   Category @relation(fields: [categoryId], references: [id])
  unit       String                      // dona, kg, litr, metr
  costPrice  Decimal  @db.Decimal(16, 2)              // oxirgi xarid narxi
  avgCost    Decimal  @db.Decimal(16, 2) @default(0)  // AVCO (FR-2.12)
  salePrice  Decimal  @db.Decimal(16, 2)
  minStock   Decimal  @db.Decimal(12, 3) @default(0)
  isActive   Boolean  @default(true)
  movements  StockMovement[]
  orderItems OrderItem[]
  purchaseItems PurchaseItem[]
  salesReturnItems SalesReturnItem[]
  purchaseReturnItems PurchaseReturnItem[]
  stockCountItems StockCountItem[]
}

model StockMovement {
  id          Int          @id @default(autoincrement())
  productId   Int
  product     Product      @relation(fields: [productId], references: [id])
  warehouseId Int
  warehouse   Warehouse    @relation(fields: [warehouseId], references: [id])
  type        MovementType
  quantity    Decimal      @db.Decimal(12, 3) // kirim: +, chiqim: −
  reason      String?                          // writeoff/adjustment uchun
  refType     String?                          // "order" | "purchase" | "transfer"
  refId       Int?
  userId      Int
  createdAt   DateTime     @default(now())
  @@index([productId, warehouseId])
}

model StockTransfer {
  id              Int      @id @default(autoincrement())
  number          String   @unique              // TRF-2026-0001
  fromWarehouseId Int
  toWarehouseId   Int
  date            DateTime @default(now())
  note            String?
  userId          Int
}

model SalesReturn {
  id          Int       @id @default(autoincrement())
  number      String    @unique                 // SRT-2026-0001
  orderId     Int
  order       Order     @relation(fields: [orderId], references: [id])
  warehouseId Int
  warehouse   Warehouse @relation(fields: [warehouseId], references: [id])
  date        DateTime  @default(now())
  total       Decimal   @db.Decimal(16, 2)
  note        String?
  userId      Int
  createdAt   DateTime  @default(now())
  items       SalesReturnItem[]
}

model SalesReturnItem {
  id          Int         @id @default(autoincrement())
  returnId    Int
  salesReturn SalesReturn @relation(fields: [returnId], references: [id])
  productId   Int
  product     Product     @relation(fields: [productId], references: [id])
  quantity    Decimal     @db.Decimal(12, 3)
  price       Decimal     @db.Decimal(16, 2)    // buyurtmadagi narx
}

model PurchaseReturn {
  id          Int       @id @default(autoincrement())
  number      String    @unique                 // PRT-2026-0001
  purchaseId  Int
  purchase    Purchase  @relation(fields: [purchaseId], references: [id])
  warehouseId Int
  warehouse   Warehouse @relation(fields: [warehouseId], references: [id])
  date        DateTime  @default(now())
  total       Decimal   @db.Decimal(16, 2)
  note        String?
  userId      Int
  createdAt   DateTime  @default(now())
  items       PurchaseReturnItem[]
}

model PurchaseReturnItem {
  id             Int            @id @default(autoincrement())
  returnId       Int
  purchaseReturn PurchaseReturn @relation(fields: [returnId], references: [id])
  productId      Int
  product        Product        @relation(fields: [productId], references: [id])
  quantity       Decimal        @db.Decimal(12, 3)
  costPrice      Decimal        @db.Decimal(16, 2) // xariddagi narx
}

model StockCount {
  id          Int         @id @default(autoincrement())
  number      String      @unique                // INVT-2026-0001
  warehouseId Int
  warehouse   Warehouse   @relation(fields: [warehouseId], references: [id])
  date        DateTime    @default(now())
  status      CountStatus @default(draft)
  note        String?
  userId      Int
  createdAt   DateTime    @default(now())
  items       StockCountItem[]
}

model StockCountItem {
  id        Int        @id @default(autoincrement())
  countId   Int
  count     StockCount @relation(fields: [countId], references: [id])
  productId Int
  product   Product    @relation(fields: [productId], references: [id])
  systemQty Decimal    @db.Decimal(12, 3)        // hujjat yaratilgandagi tizim qoldig'i
  actualQty Decimal    @db.Decimal(12, 3)        // sanoq natijasi
  diff      Decimal    @db.Decimal(12, 3)        // actual - system
}

model MoneyTransfer {
  id            Int      @id @default(autoincrement())
  date          DateTime @default(now())
  fromAccountId Int
  fromAccount   Account  @relation("TransferFrom", fields: [fromAccountId], references: [id])
  toAccountId   Int
  toAccount     Account  @relation("TransferTo", fields: [toAccountId], references: [id])
  amount        Decimal  @db.Decimal(16, 2)
  note          String?
  userId        Int
  createdAt     DateTime @default(now())
}

model Account {
  id             Int         @id @default(autoincrement())
  name           String
  type           AccountType
  openingBalance Decimal     @db.Decimal(16, 2) @default(0)
  transactions   Transaction[]
  payments       Payment[]
  transfersFrom  MoneyTransfer[] @relation("TransferFrom")
  transfersTo    MoneyTransfer[] @relation("TransferTo")
}

model TxCategory {
  id           Int           @id @default(autoincrement())
  name         String
  type         TxType
  transactions Transaction[]
}

model Transaction {
  id         Int        @id @default(autoincrement())
  date       DateTime   @default(now())
  accountId  Int
  account    Account    @relation(fields: [accountId], references: [id])
  type       TxType
  amount     Decimal    @db.Decimal(16, 2)
  categoryId Int
  category   TxCategory @relation(fields: [categoryId], references: [id])
  source     TxSource   @default(manual)
  refId      Int?                        // manba: payment.id / payroll.id / advance.id
  note       String?
  userId     Int
}

model Payment {
  id         Int          @id @default(autoincrement())
  date       DateTime     @default(now())
  direction  PayDirection               // FR-3.6: in/out — kontragent bilan birga o'qiladi
  accountId  Int
  account    Account      @relation(fields: [accountId], references: [id])
  amount     Decimal      @db.Decimal(16, 2)
  customerId Int?
  customer   Customer?    @relation(fields: [customerId], references: [id])
  supplierId Int?
  supplier   Supplier?    @relation(fields: [supplierId], references: [id])
  orderId    Int?
  order      Order?       @relation(fields: [orderId], references: [id])
  purchaseId Int?
  purchase   Purchase?    @relation(fields: [purchaseId], references: [id])
  note       String?
  userId     Int
  createdAt  DateTime     @default(now())
}

model Invoice {
  id       Int           @id @default(autoincrement())
  number   String        @unique        // INV-2026-0001
  orderId  Int           @unique
  order    Order         @relation(fields: [orderId], references: [id])
  status   InvoiceStatus @default(draft)
  issuedAt DateTime      @default(now())
  paidAt   DateTime?
}

model Department { id Int @id @default(autoincrement()) name String @unique  employees Employee[] }
model Position   { id Int @id @default(autoincrement()) name String @unique  employees Employee[] }

model Employee {
  id           Int            @id @default(autoincrement())
  fullName     String
  phone        String?
  email        String?
  departmentId Int
  department   Department     @relation(fields: [departmentId], references: [id])
  positionId   Int
  position     Position       @relation(fields: [positionId], references: [id])
  salary       Decimal        @db.Decimal(16, 2)
  hiredAt      DateTime
  firedAt      DateTime?
  status       EmployeeStatus @default(active)
  attendance   Attendance[]
  payrollItems PayrollItem[]
  advances     Advance[]
}

model Attendance {
  id         Int              @id @default(autoincrement())
  employeeId Int
  employee   Employee         @relation(fields: [employeeId], references: [id])
  date       DateTime         @db.Date
  status     AttendanceStatus
  @@unique([employeeId, date])
}

model Advance {
  id         Int      @id @default(autoincrement())
  employeeId Int
  employee   Employee @relation(fields: [employeeId], references: [id])
  date       DateTime @default(now())
  amount     Decimal  @db.Decimal(16, 2)
  accountId  Int
  note       String?
  userId     Int
}

model Payroll {
  id        Int           @id @default(autoincrement())
  month     String        @unique          // "2026-07"
  total     Decimal       @db.Decimal(16, 2)   // net yig'indisi
  createdAt DateTime      @default(now())
  items     PayrollItem[]
}

model PayrollItem {
  id         Int      @id @default(autoincrement())
  payrollId  Int
  payroll    Payroll  @relation(fields: [payrollId], references: [id])
  employeeId Int
  employee   Employee @relation(fields: [employeeId], references: [id])
  baseSalary Decimal  @db.Decimal(16, 2)
  bonus      Decimal  @db.Decimal(16, 2) @default(0)
  penalty    Decimal  @db.Decimal(16, 2) @default(0)
  advance    Decimal  @db.Decimal(16, 2) @default(0)  // oy avanslari yig'indisi
  amount     Decimal  @db.Decimal(16, 2)              // net = base + bonus - penalty - advance
}

model AppSetting {
  id            Int     @id @default(1)   // singleton
  companyName   String
  address       String?
  phone         String?
  inn           String?
  bankDetails   String?
  invoiceFooter String?
  logoPath      String?
}

model Notification {
  id        Int      @id @default(autoincrement())
  userId    Int
  user      User     @relation(fields: [userId], references: [id])
  title     String
  message   String
  link      String?
  isRead    Boolean  @default(false)
  dedupeKey String?                        // FR-7.3 uchun (masalan "low-stock:productId")
  createdAt DateTime @default(now())
}

model AuditLog {
  id        Int      @id @default(autoincrement())
  userId    Int
  user      User     @relation(fields: [userId], references: [id])
  action    String                         // "order.confirm", "payment.delete" ...
  entity    String
  entityId  Int?
  details   Json?
  createdAt DateTime @default(now())
}
```

**Muhim invariantlar:**
1. Mahsulot qoldig'i (ombor kesimida) = `SUM(StockMovement.quantity WHERE productId, warehouseId)`. Chiqimdan oldin qoldiq tranzaksiya ichida tekshiriladi (Prisma interactive transaction, kerak bo'lsa `SELECT ... FOR UPDATE`).
2. Hisob balansi = `openingBalance + SUM(income) − SUM(expense)` shu hisob bo'yicha.
3. Mijoz qarzi = `SUM(Order.total, confirmed/shipped)` − `SUM(SalesReturn.total)` − `SUM(Payment: in+customer)` + `SUM(Payment: out+customer)`.
4. Yetkazib beruvchi qarzi = `SUM(Purchase.total)` − `SUM(PurchaseReturn.total)` − `SUM(Payment: out+supplier)` + `SUM(Payment: in+supplier)`.
5. `Order.total = subtotal − discount`; pozitsiya o'zgarsa qayta hisoblanadi; `confirmed` buyurtma pozitsiyalari va chegirmasi tahrirlanmaydi.
6. Bog'langan to'lovlar yig'indisi hujjat jamisidan oshmaydi (order/purchase ko'rsatilganda).
7. Qaytarish miqdori manba hujjatdagi (sotilgan/olingan − avval qaytarilgan) miqdordan oshmaydi.
8. `Product.avgCost` faqat xarid kirimida qayta hisoblanadi; foyda hisobi tasdiqlashda muhrlangan `OrderItem.cost`ga tayanadi (FR-2.12).
9. `source=transfer` tranzaksiyalari tushum/xarajat va moliyaviy hisobot aggregatsiyalariga kirmaydi (FR-3.9).

---

## 8. API endpointlar (asosiy ro'yxat)

Barcha endpointlar `/api/v1` prefiksi bilan, JWT talab qiladi (login'dan tashqari). Qavsda — ruxsat etilgan rollar.

```
POST   /auth/login                     (hamma)
POST   /auth/refresh                   (hamma)
GET    /auth/me                        (hamma)
PATCH  /auth/password                  (hamma)

GET|POST         /users                (admin)
PATCH            /users/:id            (admin)

GET|POST         /customers            (admin, sales)
GET|PATCH|DELETE /customers/:id        (admin, sales)
GET              /customers/:id/balance (admin, sales, accountant)

GET|POST         /suppliers            (admin, warehouse; GET: accountant)
GET|PATCH        /suppliers/:id        (admin, warehouse)

GET|POST         /deals                (admin, sales)
PATCH            /deals/:id            (admin, sales)   // shu jumladan stage
GET              /deals/board          (admin, sales)

GET|POST         /orders               (admin, sales)
GET              /orders/:id           (admin, sales)
POST             /orders/:id/confirm   (admin, sales)   // FR-1.5
POST             /orders/:id/cancel    (admin, sales)   // FR-1.6
GET              /orders/:id/delivery-note (admin, sales) // FR-1.9 (PDF)
GET|POST         /sales-returns        (admin, sales)   // FR-1.8
GET              /sales-returns/:id    (admin, sales, accountant)

GET|POST         /warehouses           (admin, warehouse)
PATCH            /warehouses/:id       (admin, warehouse)
GET|POST         /categories           (admin, warehouse)
GET|POST         /products             (admin, warehouse; GET: sales)
GET|PATCH        /products/:id         (admin, warehouse)
GET              /products/low-stock   (admin, warehouse)
GET              /products/:id/movements (admin, warehouse)
GET|POST         /purchases            (admin, warehouse)
GET              /purchases/:id        (admin, warehouse, accountant)
POST             /stock/writeoff       (admin, warehouse)
GET|POST         /stock/transfers      (admin, warehouse) // FR-2.6
GET|POST         /purchase-returns     (admin, warehouse) // FR-2.10
GET|POST         /stock/counts         (admin, warehouse) // FR-2.11
POST             /stock/counts/:id/complete (admin, warehouse)

GET|POST         /accounts             (admin, accountant)
GET|POST         /tx-categories        (admin, accountant)
GET|POST         /transactions         (admin, accountant) // POST faqat manual
DELETE           /transactions/:id     (admin, accountant; faqat source=manual)
GET              /finance/balance      (admin, accountant)
GET              /finance/debts        (admin, accountant) // FR-3.7 ikkala ro'yxat
GET|POST         /payments             (admin, accountant)
DELETE           /payments/:id         (admin, accountant)
GET|POST         /finance/transfers    (admin, accountant) // FR-3.9
GET|POST         /invoices             (admin, accountant)
PATCH            /invoices/:id/status  (admin, accountant) // draft->sent
GET              /invoices/:id/pdf     (admin, accountant) // FR-3.5

GET|POST         /departments          (admin, hr)
GET|POST         /positions            (admin, hr)
GET|POST         /employees            (admin, hr)
PATCH            /employees/:id        (admin, hr)
GET|POST         /attendance           (admin, hr)      // ?month=2026-07
GET|POST         /advances             (admin, hr)      // FR-4.4
GET|POST         /payroll              (admin, hr)      // POST = vedomost (FR-4.5)
GET              /payroll/:id          (admin, hr, accountant)

GET              /dashboard/summary    (admin)          // ?from&to (FR-5.1)
GET              /dashboard/charts     (admin)

GET              /reports/finance      (admin, accountant)   // + ?format=xlsx|pdf
GET              /reports/sales        (admin, sales)
GET              /reports/stock        (admin, warehouse)
GET              /reports/debts        (admin, accountant)
GET              /reports/payments     (admin, accountant)
GET              /reports/attendance   (admin, hr)
GET              /reports/profit       (admin, accountant)

GET              /notifications        (hamma — o'ziniki)
PATCH            /notifications/read   (hamma — o'ziniki; body: ids yoki all)

GET              /imports/template     (admin, warehouse, sales) // ?type=products|customers
POST             /imports/preview      (admin, warehouse, sales) // FR-8.2 validatsiya
POST             /imports/commit       (admin, warehouse, sales)

GET              /search               (hamma; rolga qarab filtrlanadi) // ?q=

GET|PATCH        /settings             (GET: admin, accountant — PDF uchun; PATCH: admin)
POST             /settings/logo        (admin)
```

---

## 9. UI sahifalari va layout

**Umumiy layout:** chapda vertikal sidebar (rolga qarab menyu punktlari), yuqorida header: global qidiruv (`Ctrl+K`), bildirishnomalar qo'ng'irog'i, foydalanuvchi ismi/roli, chiqish. Asosiy kontent — o'ngda.

| # | Sahifa (route) | Rollar | Tavsif |
|---|---|---|---|
| 1 | `/login` | hamma | Login formasi |
| 2 | `/` (dashboard) | admin | Davr tanlagich + KPI (solishtirish bilan) + grafiklar |
| 3 | `/customers`, `/customers/:id` | admin, sales | Jadval + karta (balans, buyurtmalar, to'lovlar) |
| 4 | `/deals` | admin, sales | Kanban doska |
| 5 | `/orders`, `/orders/:id` | admin, sales | Jadval + buyurtma sahifasi (pozitsiyalar, chegirma, confirm/cancel, to'lov holati) |
| 6 | `/products`, `/products/:id` | admin, warehouse (+sales R) | Jadval (qoldiq, ombor filtri) + mahsulot kartasi (harakatlar tarixi) |
| 7 | `/warehouses` | admin, warehouse | Omborlar ro'yxati |
| 8 | `/suppliers`, `/suppliers/:id` | admin, warehouse | Jadval + karta (xaridlar, to'lovlar, qarz) |
| 9 | `/purchases`, `/purchases/:id` | admin, warehouse | Xarid hujjatlari + yaratish formasi |
| 10 | `/stock/transfers` | admin, warehouse | Ko'chirish hujjatlari + yaratish |
| 11 | `/finance/transactions` | admin, accountant | Tranzaksiyalar jurnali + manual qo'shish |
| 12 | `/finance/payments` | admin, accountant | To'lovlar ro'yxati + yaratish (in/out) |
| 13 | `/finance/debts` | admin, accountant | Debitor va kreditor jadvallari |
| 14 | `/finance/accounts` | admin, accountant | Hisoblar va balanslar |
| 15 | `/finance/invoices` | admin, accountant | Hisob-fakturalar + PDF chop etish |
| 16 | `/employees`, `/employees/:id` | admin, hr | Xodimlar jadvali + karta |
| 17 | `/attendance` | admin, hr | Oylik davomat jadvali |
| 18 | `/advances` | admin, hr | Avanslar ro'yxati + berish |
| 19 | `/payroll`, `/payroll/:id` | admin, hr | Vedomostlar + yaratish (bonus/jarima kiritish) |
| 20 | `/reports` | rolga qarab | 7 ta hisobot + eksport |
| 21 | `/imports` | admin, warehouse, sales | Shablon yuklab olish → fayl yuklash → preview → tasdiqlash |
| 22 | `/users` | admin | Foydalanuvchilar boshqaruvi |
| 23 | `/settings` | admin | Kompaniya rekvizitlari + logotip |
| 24 | `/audit` | admin | Audit jurnali (filtrlar bilan) |
| 25 | `/returns/sales`, `/returns/sales/:id` | admin, sales | Sotuv qaytarishlari + yaratish |
| 26 | `/returns/purchases` | admin, warehouse | Xarid qaytarishlari + yaratish |
| 27 | `/stock/counts`, `/stock/counts/:id` | admin, warehouse | Inventarizatsiya (sanoq kiritish, farqlar, yakunlash) |
| 28 | `/finance/transfers` | admin, accountant | Hisoblar orasida o'tkazmalar |

Jadval komponenti standarti: qidiruv, pagination, saralash (kamida sana bo'yicha), bo'sh holat matni ("Hozircha ma'lumot yo'q").

---

## 10. Ishlab chiqish bosqichlari (Claude Code uchun reja)

Har bir bosqich mustaqil yakunlanadi va o'zining "Tayyor" mezoni (DoD) bilan tekshiriladi. Keyingi bosqichga faqat DoD bajarilgach o'tiladi. Prisma sxemasi (7-bo'lim) **to'liq holda** 0-bosqichda yaratiladi — keyin migratsiya o'zgarmaydi.

### Bosqich 0 — Skelet va autentifikatsiya
Monorepo tuzilmasi, `docker-compose.yml` (postgres), Prisma sxemasi (7-bo'lim to'liq) + migratsiya, NestJS ilova, JWT auth (login/refresh/me), RBAC guard + `@Roles()` dekorator, audit-log servisi (common), React ilova (Vite + Tailwind + shadcn/ui), login sahifasi, himoyalangan layout (sidebar + header skeleti), rolga qarab menyu.
**DoD:** `docker compose up` + backend + frontend ishga tushadi; admin login qiladi; sales roli `/finance/*` ga kirsa 403 oladi; `GET /auth/me` to'g'ri ishlaydi.

### Bosqich 1 — Ombor konturi
Omborlar, kategoriyalar, mahsulotlar (shtrix-kod bilan) CRUD, yetkazib beruvchilar CRUD, xarid hujjati (PUR raqamlash, movements, AVCO yangilash — FR-2.12), xarid qaytarishi (FR-2.10), write-off, omborlararo ko'chirish, inventarizatsiya (FR-2.11), ombor kesimida qoldiq, kam zaxira ro'yxati, mahsulot kartasida harakatlar tarixi, **mahsulotlar Excel importi** (shablon/preview/commit).
**DoD:** xarid orqali tanlangan omborda qoldiq oshadi; ko'chirishda bir omborda kamayib ikkinchisida oshadi; from-omborda qoldiq yetmasa xato; low-stock ro'yxati to'g'ri; import preview xato satrlarni ko'rsatadi; ikki xil narxdagi ikki xariddan keyin `avgCost` to'g'ri o'rtacha bo'ladi; inventarizatsiya yakunlangach farqlar `adjustment` bo'lib yoziladi va qoldiq haqiqiyga tenglashadi; unit-test: qoldiq invarianti (parallel chiqimda manfiy bo'lmaydi).

### Bosqich 2 — Savdo konturi
Mijozlar CRUD + **Excel import**, kanban bitimlar, buyurtmalar (ombor tanlash, chegirma, subtotal/total hisoblash), confirm (FR-1.5: ombor qismi + status + `OrderItem.cost` muhri), cancel (FR-1.6, to'lov tekshiruvisiz — to'lovlar 3-bosqichda ulanadi), sotuv qaytarishi (FR-1.8; pul qaytarish qismi 3-bosqichda), mijoz kartasi (balans bloki hozircha to'lovsiz: qarz = confirmed buyurtmalar yig'indisi).
**DoD:** buyurtma tasdiqlanganda tanlangan ombordan qoldiq kamayadi; qoldiq yetmasa aniq xato va hech narsa o'zgarmaydi; chegirmali buyurtmada total to'g'ri; cancel qaytim harakatlarini yaratadi; sotuv qaytarishida qoldiq tiklanadi va miqdor sotilganidan oshsa xato; e2e-test: confirm → movements yaratildi.

### Bosqich 3 — Moliya va to'lovlar konturi
Hisoblar, kategoriyalar, manual tranzaksiyalar, balans, **to'lovlar (in/out, qisman, bog'lash)**, to'lov → avtomatik Transaction, qarzdorlik sahifasi (debitor/kreditor), hisob-fakturalar (yaratish, sent, avto-`paid`, **PDF chop etish** — sozlamalar rekvizitlari bilan, shu sabab `/settings` backend qismi shu bosqichda), buyurtma sahifasida to'lov holati, cancel'da to'lov tekshiruvi yoqiladi, mijozga pul qaytarish va yetkazib beruvchidan qaytarim (FR-3.6 kombinatsiyalari), hisoblar orasida o'tkazish (FR-3.9), yuk xati PDF (FR-1.9).
**DoD:** buyurtmaga 2 ta qisman to'lov kiritilganda mijoz qarzi to'g'ri kamayadi va jami yetganda invoice avto-`paid`; ortiqcha to'lov taqiqlanadi; to'lov o'chirilganda tranzaksiya ham o'chadi va qarz qayta hisoblanadi; xaridga to'lov kreditor qarzni kamaytiradi; invoice PDF rekvizitlar bilan yuklab olinadi; kassa→bank o'tkazmasi ikkala balansni o'zgartiradi, lekin tushum/xarajat ko'rsatkichlariga kirmaydi; sotuv qaytarishidan keyin mijoz qarzi to'g'ri kamayadi; e2e-test: payment → transaction → balans.

### Bosqich 4 — HR konturi
Bo'lim/lavozim, xodimlar CRUD, davomat jadvali, **avanslar** (→ expense, source=advance), vedomost (bazaviy + bonus − jarima − avans = net; → expense, source=salary), xodim kartasida to'lovlar tarixi.
**DoD:** avans berilgach vedomostda avtomatik ayiriladi; bir oy uchun ikkinchi vedomost yaratib bo'lmaydi; vedomost jami = net yig'indisi va moliyada aynan shu summa expense bo'lib tushadi; fired xodim keyingi vedomostga kirmaydi.

### Bosqich 5 — Panel, hisobotlar va yakuniy jilo
Dashboard (davr tanlagich, KPI + o'tgan davr bilan solishtirish, qarz va yalpi foyda kartalari, 3 grafik), 7 ta hisobot + xlsx/pdf eksport, **bildirishnomalar** (FR-7, polling + dedupe), **global qidiruv**, sozlamalar sahifasi (logotip yuklash), audit jurnali sahifasi, seed skript (Ilova A), README (ishga tushirish yo'riqnomasi).
**DoD:** `pnpm seed`dan keyin dashboard real raqamlarni (shu jumladan debitor/kreditor) ko'rsatadi va foiz o'zgarishlar chiqadi; kam zaxira va muddati o'tgan invoice bildirishnomalari keladi va takrorlanmaydi; Ctrl+K qidiruv 4 obyekt turida ishlaydi; har bir hisobot xlsx va pdf yuklab beradi; 11-bo'limdagi yakuniy checklist to'liq o'tadi.

---

## 11. Yakuniy qabul qilish mezonlari (checklist)

Asosiy stsenariy — **"Rahbarning bir haftasi"** (loyiha kartasidagi mezon):

- [ ] Direktor login qiladi va dashboardda tanlangan davr uchun tushum/xarajat/foyda hamda o'tgan davrga nisbatan o'zgarishni ko'radi
- [ ] Omborchi mahsulotlarni Excel'dan import qiladi (xato satrlar preview'da ko'rinadi)
- [ ] Omborchi yetkazib beruvchidan xarid hujjati kiritadi — qoldiq oshadi, kreditor qarz paydo bo'ladi
- [ ] Omborchi mahsulotni bir ombordan ikkinchisiga ko'chiradi — ikkala qoldiq to'g'ri o'zgaradi
- [ ] Savdo menejeri mijoz yaratadi, bitimni voronka bo'ylab siljitadi, chegirmali buyurtma tasdiqlaydi
- [ ] Buyurtma tasdiqlangach: tanlangan omborda qoldiq kamaygan, mijoz qarzi paydo bo'lgan, **kassa o'zgarmagan**
- [ ] Qoldiq yetarli bo'lmagan sotuvda tizim aniq xato beradi va hech narsa o'zgarmaydi
- [ ] Buxgalter buyurtmaga ikki bosqichda qisman to'lov qabul qiladi — qarz kamayadi, jami yetganda hisob-faktura avtomatik `paid` bo'ladi
- [ ] Buxgalter hisob-fakturani kompaniya rekvizitlari bilan PDF ko'rinishida chop etadi
- [ ] Buxgalter yetkazib beruvchiga to'lov qiladi — kreditor qarz kamayadi
- [ ] Buxgalter qo'lda xarajat (masalan, ijara) kiritadi va hisoblar balansini ko'radi
- [ ] HR xodimga avans beradi, oy oxirida vedomost yaratadi — avans avtomatik ayirilgan, moliyada "Ish haqi" xarajati ko'ringan
- [ ] Kam zaxira va 7 kunlik to'lanmagan hisob-faktura bo'yicha bildirishnomalar keladi
- [ ] Direktor `Ctrl+K` orqali mijoz/mahsulot/buyurtmani topadi
- [ ] Omborchi inventarizatsiya o'tkazadi — farqlar `adjustment` sifatida yoziladi va qoldiq haqiqiyga tenglashadi
- [ ] Savdo menejeri qisman sotuv qaytarishini rasmiylashtiradi — qoldiq tiklanadi, mijoz qarzi kamayadi
- [ ] Buxgalter kassadan bankka pul o'tkazadi — ikkala balans o'zgaradi, tushum/xarajat o'zgarmaydi
- [ ] Direktor foyda hisobotida mahsulot kesimida yalpi foydani ko'radi
- [ ] Har bir rol faqat o'z modullarini ko'radi (menyu + API darajasida)
- [ ] Direktor qarzdorlik hisobotini Excel va PDF ko'rinishida yuklab oladi
- [ ] Dashboard raqamlari modullardagi real ma'lumotlar bilan mos keladi
- [ ] Audit jurnalida tasdiqlash/to'lov/import amallari ko'rinadi

---

## 12. Claude Code bilan ishlash tartibi (tavsiya)

1. Bo'sh papkada git init qiling, ushbu faylni `TZ_ERP_tizimi.md` nomi bilan ildizga qo'ying.
2. `CLAUDE.md` yarating va unga qisqacha yozing: "Loyiha talablari TZ_ERP_tizimi.md faylida. Har doim unga amal qil. Pul — Decimal. Modullararo operatsiyalar — bitta DB tranzaksiyasida. Pul harakati faqat Payment orqali (6-bo'lim, 3-tamoyil). Hech narsa jismonan o'chirilmaydi."
3. Har bosqichni alohida sessiyada bering, masalan: *"TZ_ERP_tizimi.md dagi Bosqich 1 ni bajar. Yakunida DoD bandlarini o'zing tekshirib chiq."*
4. Bosqich tugagach DoD ni qo'lda ham tekshiring, git commit qiling, keyin keyingi bosqichga o'ting.
5. Katta o'zgarish so'rashdan oldin: *"Avval reja tuz, kod yozma"* — rejani tasdiqlagach bajartiring.
6. Biznes-logika buzilsa, FR raqamiga havola qiling: *"FR-3.6 bo'yicha ortiqcha to'lov taqiqlanishi kerak edi — tuzat va test yoz."*

---

## Ilova A. Seed (demo) ma'lumotlar talabi

Seed skripti (`pnpm seed`) quyidagilarni yaratadi:
- 5 foydalanuvchi (har bir roldan bittadan; parollar: `Demo1234!`)
- Sozlamalar: "Demo Savdo MChJ" rekvizitlari bilan
- 2 ombor (Asosiy ombor, Filial ombori)
- 2 hisob (Kassa, Bank — boshlang'ich qoldiq: 5 000 000 va 20 000 000)
- 7 tranzaksiya kategoriyasi (FR-3.3 ro'yxati)
- 4 kategoriya, 15 mahsulot (shtrix-kodlar bilan, 2 tasi kam zaxirada)
- 5 yetkazib beruvchi, 6 xarid hujjati (3 tasi qisman to'langan — kreditor qarz ko'rinsin)
- 10 mijoz, 8 bitim (turli bosqichlarda), 6 buyurtma (2 tasi chegirmali; 4 tasi confirmed, shundan 2 tasi qisman to'langan — debitor qarz ko'rinsin)
- 1 omborlararo ko'chirish hujjati
- 1 yakunlangan inventarizatsiya (kichik farqlar bilan)
- 1 sotuv qaytarishi va 1 xarid qaytarishi
- 1 hisoblararo o'tkazma (kassa → bank)
- 3 bo'lim, 5 lavozim, 12 xodim, joriy oy davomati (qisman), 2 avans, o'tgan oy vedomosti
- O'tgan 6 oy uchun tarqoq to'lovlar va manual tranzaksiyalar (grafiklar va solishtirish bo'sh ko'rinmasligi uchun)
- 3-4 namunaviy bildirishnoma

---

## Ilova B. 1.1-versiya o'zgarishlari (1.0 ga nisbatan)

| # | Qo'shildi / o'zgardi | Bo'limlar |
|---|---|---|
| 1 | **To'lovlar va qarzdorlik**: Payment modeli, qisman to'lovlar, debitor/kreditor; buyurtma tasdiqlash endi kassaga emas, qarzga yoziladi (nasiya savdo) | FR-1.5, FR-3.6, FR-3.7, 6.3, 7 |
| 2 | **Yetkazib beruvchilar va xarid hujjatlari** (Supplier, Purchase, PUR raqamlash, kreditor qarz) | FR-2.3, FR-2.4 |
| 3 | **Bir nechta ombor** va omborlararo ko'chirish; qoldiq ombor kesimida | FR-2.0, FR-2.6, FR-2.7 |
| 4 | **Excel import** (mahsulotlar, mijozlar): shablon → preview → commit | 3.8 |
| 5 | **Hisob-faktura PDF chop etish** kompaniya rekvizitlari va logotip bilan | FR-3.5, 3.9 |
| 6 | **Chegirmalar** buyurtma darajasida (subtotal/discount/total) | FR-1.4 |
| 7 | **Ish haqi kengaytmasi**: avans (alohida hujjat + avto-ayirish), bonus, jarima, net hisoblash | FR-4.4, FR-4.5 |
| 8 | **Bildirishnomalar** (kam zaxira, muddati o'tgan invoice, confirm, vedomost) + dedupe | 3.7 |
| 9 | **Dashboard**: davr tanlagich, o'tgan davr bilan solishtirish, qarz kartalari | 3.5 |
| 10 | **Global qidiruv (Ctrl+K)** va **audit jurnali sahifasi** | 3.10 |
| 11 | **Sozlamalar** (rekvizitlar, logotip) va shtrix-kod maydoni | 3.9, FR-2.1 |
| 12 | Hisobotlar 4 tadan 6 taga (qarzdorlik, to'lovlar) | FR-6.2 |
| 13 | Sxema yangilandi: +Supplier, Warehouse, Purchase(+Item), Payment, StockTransfer, Advance, AppSetting, Notification; TxSource qayta ko'rildi | 7 |

### 1.2-versiya qo'shimchalari

| # | Qo'shildi / o'zgardi | Bo'limlar |
|---|---|---|
| 14 | **Sotuv va xarid qaytarishlari** (SRT/PRT hujjatlari, qoldiq tiklanishi, qarz korreksiyasi, mijozga pul qaytarish) | FR-1.8, FR-2.10, FR-3.6, FR-3.7 |
| 15 | **Inventarizatsiya hujjati** (tizim qoldig'i → sanoq → farq → `adjustment`) | FR-2.11 |
| 16 | **Hisoblar orasida pul o'tkazish** (kassa↔bank) va uni tushum/xarajatdan chiqarib tashlash qoidasi | FR-3.9 |
| 17 | **O'rtacha tannarx (AVCO)** va `OrderItem.cost` muhri | FR-2.12, 7 |
| 18 | **Foyda hisoboti** (7-hisobot) va dashboardda yalpi foyda kartasi | FR-6.2, FR-5.3 |
| 19 | **Buyurtma yuk xati (PDF)** | FR-1.9 |
| 20 | Sxema: +SalesReturn(+Item), PurchaseReturn(+Item), StockCount(+Item), MoneyTransfer; `Product.avgCost`, `OrderItem.cost`; MovementType/TxSource kengaydi | 7 |

---

*Hujjat oxiri. Savollar yoki o'zgartirishlar bo'lsa — TZ versiyasini oshirib, o'zgarishlar jurnalini Ilova B ga qo'shing.*
