# TEXNIK TOPSHIRIQ (TZ)
# ERP TIZIMI — XATOLIKLARNI BARTARAF ETISH VA FRONTEND'NI TAKOMILLASHTIRISH

**Hujjat versiyasi:** 1.0
**Sana:** 18.07.2026
**Loyiha:** ERP tizimi (React + Vite, `localhost:5173`)
**Interfeys tili:** O'zbek (lotin)
**Ijro vositasi:** Claude Code

---

## CLAUDE CODE UCHUN UMUMIY KO'RSATMALAR

1. Ishni boshlashdan avval loyiha strukturasini to'liq o'rganib chiq: `src/` papkasi, router, sahifa komponentlari, state management (store/context), API/service qatlami, util funksiyalar.
2. Vazifalarni **prioritet tartibida** bajar: `P0 → P1 → P2 → P3`. Bir prioritet ichida TASK raqamlari tartibida yur.
3. Har bir TASK — alohida commit: `fix: TASK-001 hisob balansi validatsiyasi` yoki `feat: TASK-022 export funksiyasi`.
4. Yangi kutubxona qo'shishdan oldin `package.json` ni tekshir — mavjud kutubxonalar bilan yechish mumkin bo'lsa, yangisini qo'shma.
5. Mavjud dizayn tizimiga (ranglar, radius, spacing, shrift) qat'iy amal qil. Yangi komponentlar mavjudlari uslubida bo'lsin.
6. Har bir TASK'dan keyin **Qabul mezonlari** bo'yicha o'zingni tekshir, `npm run build` xatosiz o'tishiga ishonch hosil qil.
7. Biror vazifa mavjud arxitekturaga zid kelsa yoki ma'lumotlar modeli yetarli bo'lmasa — to'xtab, muqobil yechim taklif qil (o'zboshimchalik bilan modelni buzma).
8. Barcha yangi matnlar o'zbek lotin alifbosida, mavjud terminologiyaga mos bo'lsin (mijoz, bitim, buyurtma, hisob-faktura va h.k.).

---

# 1-BO'LIM. KRITIK XATOLIKLAR — P0 (moliyaviy mantiq)

## TASK-001. Hisob balansi validatsiyasi (Bank hisobi −36 148 000 so'm)

**Muammo.** Tizim hisob balansidan ortiq chiqimlarga cheklovsiz ruxsat beradi. Natijada «Hisoblar» sahifasida Bank hisobi **−36 148 000 so'm** ko'rsatilmoqda (asosan ish haqi vedomosti −45,2 mln va xarid to'lovlari hisobiga).

**Bajarilishi kerak:**
1. Chiqim tranzaksiyasi, to'lov (chiqim) va hisoblar orasidagi o'tkazma yaratishda tanlangan hisobning joriy balansi tekshirilsin.
2. Balans yetarli bo'lmasa — tasdiqlash modali:
   > «Diqqat! "{hisob nomi}" hisobida mablag' yetarli emas. Joriy qoldiq: {X} so'm. Amal bajarilsa balans manfiy bo'ladi: {Y} so'm.»
   Tugmalar: **«Bekor qilish»** (default) / **«Baribir davom etish»**.
3. Sozlamalar sahifasiga toggle: **«Manfiy balansga ruxsat berish»** (default: o'chiq). O'chiq holatda saqlash tugmasi bloklanadi va xato xabari ko'rsatiladi; yoqilganda faqat ogohlantirish modali chiqadi.
4. «Hisoblar» sahifasida manfiy balansli hisob kartasi: qizil chegara + ⚠ belgisi + «Balans manfiy» yozuvi.

**Qabul mezonlari:**
- [ ] Balansdan ortiq chiqim kiritilganda ogohlantirish/blok ishlaydi
- [ ] Sozlamadagi toggle ikkala rejimda to'g'ri ishlaydi
- [ ] Manfiy balansli hisob UI'da aniq ajralib turadi

---

## TASK-002. «Yalpi foyda» hisoblash formulasini to'g'rilash

**Muammo.** Direktor panelida **Yalpi foyda = 575 000 so'm**, **Foyda = 7 250 000 so'm**. Moliyaviy mantiqda Yalpi foyda ≥ Sof foyda bo'lishi shart — hozirgi holat noto'g'ri hisoblashdan dalolat.

**To'g'ri formulalar:**
```
Yalpi foyda (Gross Profit) = Sotuv tushumi − Sotilgan mahsulot tannarxi (COGS)
Sof foyda  (Net Profit)   = Yalpi foyda − Operatsion xarajatlar (ish haqi, ijara, kommunal, boshqa)
```

**Bajarilishi kerak:**
1. Dashboard KPI'larini hisoblovchi service/selector'ni top va joriy formulalarni audit qil.
2. «Foyda» kartasi hozir ehtimol `Tushum − Xarajat` (kassa oqimi) sifatida hisoblanmoqda — bu «Sof foyda» emas. Formulani yuqoridagiga moslashtir.
3. COGS mahsulot kartochkasidagi **«O'rtacha tannarx»** qiymatidan, sotuv sanasidagi holat bo'yicha hisoblansin.
4. Kartalar nomini aniqlashtir: «Foyda» → «Sof foyda», va har bir moliyaviy kartaga ℹ tooltip qo'sh (hover'da formula ko'rinsin).

**Qabul mezonlari:**
- [ ] Har qanday davrda Yalpi foyda ≥ Sof foyda
- [ ] Har bir KPI kartada formula tooltip'i bor
- [ ] Hisoblash birlik-testlar bilan qoplangan (agar test infratuzilmasi bo'lsa)

---

## TASK-003. Dashboard davr taqqoslash mantig'i

**Muammo.** «Oy» filtrida «Foyda +119% o'tgan davrga nisbatan» ko'rsatiladi, «Hisoblar» sahifasida esa davr farqi **−9 748 000 so'm**. Foydalanuvchi uchun qarama-qarshi signal.

**Bajarilishi kerak:**
1. «O'tgan davr» ta'rifini kodda aniq belgila va izohla (masalan: joriy oy 01–18.07 vs o'tgan oy 01–18.06 — teng uzunlikdagi davr).
2. Foiz yonida taqqoslash davri ko'rsatilsin: `+119% (01–18 iyunga nisbatan)`.
3. «Hisoblar» sahifasidagi «Davr tushumi / Davr xarajati» kartalariga davr yorlig'ini qo'sh (qaysi oraliq hisoblanayotgani ko'rinsin) va Dashboard bilan bir xil davr mantig'idan foydalan.
4. Chekka holatlar: o'tgan davr qiymati 0 bo'lsa — «yangi» deb ko'rsat (∞% yoki NaN chiqmasin).
5. Foiz rang mantig'ini tekshir: **xarajat kamayishi = yashil (yaxshi)**, **xarajat o'sishi = qizil**; tushum/foyda uchun teskarisi. Hozirgi «−93.5%» yashil ko'rsatilishi to'g'ri, lekin mantiq markazlashtirilgan util'da bo'lsin.

**Qabul mezonlari:**
- [ ] Har bir foiz yonida taqqoslash davri aniq yozilgan
- [ ] Dashboard va Hisoblar bir xil davr mantig'ida ishlaydi
- [ ] 0 ga bo'lish holati chiroyli qayta ishlanadi

---

## TASK-004. «To'lovlar» jadvalida saralash buzilgan

**Muammo.** To'lovlar sahifasida sanalar tartibsiz: `15.05 → 15.04 → 15.03 → 06.07 → 02.07 → 22.06 → 07.06`. Yozuvlar avval Chiqim, keyin Kirim bo'lib guruhlangan — sana bo'yicha yagona tartib yo'q.

**Ehtimoliy sabab.** Sana **string** sifatida solishtirilmoqda (`"15.05.2026" > "06.07.2026"` — string sifatida noto'g'ri natija beradi) yoki avval turi bo'yicha sort qilinyapti.

**Bajarilishi kerak:**
1. Saralashda sanani `Date`/timestamp ko'rinishiga o'tkazib solishtir (yagona `sortByDate` util yarat).
2. Default tartib: sana bo'yicha kamayish (eng yangi tepada), yo'nalish (Kirim/Chiqim)dan qat'i nazar.
3. «Sana» tugmasi asc/desc toggle bo'lib ishlasin (strelka indikator bilan).
4. Xuddi shu util barcha jadvallar (Buyurtmalar, Xaridlar, Tranzaksiyalar va h.k.) uchun ishlatilsin — string-sort xatosi boshqa joylarda ham bo'lishi mumkin, tekshirib chiq.

**Qabul mezonlari:**
- [ ] To'lovlar default holatda sana bo'yicha to'g'ri tartiblangan
- [ ] Saralash barcha jadvallarda `Date` asosida ishlaydi

---

# 2-BO'LIM. MA'LUMOT VA MAZMUN XATOLARI — P1

## TASK-005. Test ma'lumotlarini tozalash va nom validatsiyasi

1. «Bitimlar» → Yutildi ustunidagi **«qwertyuikl»** (7 410 741 so'm) bitimi o'chirilsin yoki mazmunli nomga o'zgartirilsin.
2. Bitim/buyurtma yaratish formalariga validatsiya: nom majburiy, kamida 3 belgi, faqat probel emas.

## TASK-006. Imlo va matn xatolari

1. Omborlar sahifasi: **«Toshkend Shaxri» → «Toshkent shahri»**.
2. «Buxoro Viloyati» → «Buxoro viloyati» (o'zbek tilida viloyat/shahar so'zlari kichik harfda).
3. Butun loyiha bo'ylab qidiruv: `grep -ri "toshkend" src/` — barcha uchragan joylar tuzatilsin (seed/mock ma'lumotlar ham).

## TASK-007. Hisob-faktura holatlari mantig'i

**Muammo.** `INV-2026-0001`: jami 1 530 000, to'langan 500 000 — holat baribir «Yuborilgan». Qisman to'lov holatda aks etmayapti.

**Bajarilishi kerak:**
1. Holatlar zanjiri: `Qoralama → Yuborilgan → Qisman to'langan → To'langan` (+ `Muddati o'tgan`).
2. Avtomatik hisoblash: `0 < to'langan < jami` → **«Qisman to'langan»** (sariq badge); `to'langan ≥ jami` → **«To'langan»** (yashil badge).
3. Jadvalda «To'langan» ustuni yonida progress ko'rsatkichi (masalan `500 000 / 1 530 000`) yoki foiz.

## TASK-008. Bo'sh Email ustuni

**Muammo.** Mijozlar va Yetkazib beruvchilar jadvallarida barcha email qiymatlari «—».

**Bajarilishi kerak:**
1. Yaratish/tahrirlash formasida email maydoni to'g'ri saqlanayotganini tekshir (bug bo'lishi mumkin).
2. Ma'lumot haqiqatan yo'q bo'lsa — ustunni default holatda yashir; jadval ustida «Ustunlar» sozlamasi (dropdown) orqali yoqish imkonini ber. Bo'sh ustun jadvalni bekorga kengaytirmasin.

## TASK-009. Yetkazib beruvchilarda «O'chirish» tugmasi yo'q

**Muammo.** Mijozlar jadvalida ✏️ + 🗑 bor, Yetkazib beruvchilarda faqat ✏️.

**Bajarilishi kerak:**
1. Amallar to'plamini birxillashtir: ikkala jadvalda ham edit + delete.
2. Bog'liq hujjatlari (xaridlar, to'lovlar) bor kontragent o'chirilmoqchi bo'lsa — qattiq o'chirish o'rniga **arxivlash (soft-delete)** taklif qilinsin: «Bu yetkazib beruvchiga 3 ta xarid bog'langan. O'chirib bo'lmaydi — arxivlansinmi?»

---

# 3-BO'LIM. UI/UX XATOLIKLARI — P1

## TASK-010. Sana formatini birxillashtirish

**Muammo.** Filtrlardagi native date input `mm/dd/yyyy` ko'rsatadi, jadvallar esa `dd.mm.yyyy`.

**Bajarilishi kerak:**
1. Yagona `DatePicker` komponenti (custom yoki mavjud kutubxona asosida): format **dd.mm.yyyy**, o'zbekcha oy nomlari, haftaning birinchi kuni — dushanba.
2. Direktor paneli davr filtri, barcha «Sana» filtrlari va formalar shu komponentga o'tkazilsin.
3. `formatDate()` util yaratilsin — jadvaldagi barcha sanalar shu orqali chiqarilsin (TASK-028 bilan bog'liq).

## TASK-011. Direktor paneli grafigini yaxshilash

**Muammo.** «Oxirgi 12 oy» grafikida bitta ulkan qizil ustun (iyul xarajati ~60 mln) qolgan barcha ustunlarni ko'rinmas holga keltirgan; legend va tooltip yo'q.

**Bajarilishi kerak:**
1. **Interaktiv tooltip**: hover'da — oy nomi, Tushum, Xarajat, Farq (formatlangan summalar bilan).
2. **Legend**: Tushum (ko'k) / Xarajat (qizil).
3. Y-o'q: «nice ticks» + och gorizontal grid chiziqlar; qiymatlar `15 mln` ko'rinishida.
4. Ekstremal og'ish muammosi uchun bittasini tanla: grouped bar + Y-o'q auto-scale, yoki grafik ustida «Log shkala» toggle'i.
5. Bo'sh oylar 0 chizig'ida ko'rinsin (grafik «teshik» bo'lmasin).

## TASK-012. Status badge tizimini birxillashtirish

**Muammo.** Buyurtmalar sahifasida «Jo'natilgan» — qora badge, qolganlari — rangli. Vizual iyerarxiya buzilgan.

**Bajarilishi kerak:**
1. Markazlashtirilgan `<StatusBadge variant="..."/>` komponenti.
2. Yagona palitra (butun tizim bo'ylab):
   | Holat | Rang |
   |---|---|
   | Qoralama | kulrang |
   | Tasdiqlangan | yashil |
   | Jo'natilgan | ko'k |
   | Yakunlangan | to'q yashil |
   | Bekor qilingan | qizil |
   | Qisman to'langan | sariq |
   | Kirim | yashil / Chiqim | qizil |
3. Barcha sahifalardagi mavjud badge'lar shu komponentga migratsiya qilinsin.

## TASK-013. Scrollbar stilizatsiyasi

**Muammo.** Sidebar va kontent orasida eski Windows-uslubidagi keng scrollbar ko'rinib turibdi.

**Bajarilishi kerak:**
1. Custom thin scrollbar: kenglik 6–8px, `border-radius`, hover'da quyuqlashadi (`::-webkit-scrollbar*`).
2. Firefox: `scrollbar-width: thin; scrollbar-color: ...`.
3. Sidebar ichki skrolli overlay ko'rinishda bo'lsin, layoutni surib yubormasin.

## TASK-014. Sticky header va sahifa sarlavhasi to'qnashuvi

**Muammo.** Direktor panelida skroll paytida «Direktor paneli» sarlavhasi yuqori header ostida qisman kesilib qoladi.

**Bajarilishi kerak:**
1. Yuqori header: `position: sticky; top: 0;` + fon rangi + `z-index` to'g'ri qiymatda.
2. Kontent konteyneriga yetarli `padding-top`; sarlavha hech qachon kesilmasin.
3. Ixtiyoriy: davr filtrlari (Bugun/Hafta/Oy/Chorak/Yil) skroll paytida sticky bo'lib qolsin.

## TASK-015. Davomat jadvalini yaxshilash

**Bajarilishi kerak:**
1. **Dam olish kunlari** (shanba, yakshanba) ustunlari och kulrang fon bilan ajratilsin.
2. **Bugungi kun** ustuni highlight qilinsin (masalan, och ko'k fon + qalin sana).
3. **Kelajak kunlar** kataklarini disabled ko'rinishda qil (bosib bo'lmasin yoki xira).
4. Xodim **ishga kirgan sanadan oldingi** kataklar chizilmasin/disabled bo'lsin (hozir yangi xodimlar qatori butunlay bo'sh va sababsiz ko'rinadi).
5. Qator oxiriga oylik yig'indi ustunlari: ✓ / ✗ / K / T sonlari.
6. Katak bosilganda holatlar aylanishi saqlansin, lekin hover'da tooltip: «3-iyul — Kasal».

---

# 4-BO'LIM. FRONTEND TAKOMILLASHTIRISH — P2

## TASK-016. Bo'sh holatlar (Empty States)

1. Har bir jadval/ro'yxat bo'sh bo'lganda: ikonka + matn («Hozircha sotuv qaytarishlari yo'q») + CTA tugma («+ Yangi qaytarish»).
2. Qidiruv/filtr natija bermasa: «Hech narsa topilmadi» + **«Filtrlarni tozalash»** tugmasi.
3. Yagona `<EmptyState/>` komponenti sifatida.

## TASK-017. Loading skeletonlar

1. Jadvallar, KPI kartalar, kanban ustunlari va grafik uchun skeleton komponentlar.
2. Sahifalar orasida o'tishda layout shift (CLS) bo'lmasin — skeleton o'lchamlari real kontentga mos.

## TASK-018. Toast bildirishnomalar

1. Yagona toast tizimi (mavjud kutubxona bo'lmasa — yengil custom): muvaffaqiyat (yashil), xato (qizil), info (ko'k).
2. Barcha CRUD amallardan so'ng: «Mijoz saqlandi», «Buyurtma o'chirildi» va h.k.
3. O'chirish toast'ida **«Bekor qilish» (Undo, 5s)** imkoniyati — imkon bo'lsa.

## TASK-019. O'chirish tasdiqlash modali

1. Barcha 🗑 amallar uchun yagona `<ConfirmDialog/>`: «Rostdan ham o'chirmoqchimisiz? Bu amalni ortga qaytarib bo'lmaydi.»
2. Bog'liq hujjatlar soni ko'rsatilsin: «Bu mijozga 3 ta buyurtma va 1 ta hisob-faktura bog'langan» (mavjud bo'lsa o'chirish o'rniga arxivlash — TASK-009 mantig'i bilan uyg'un).

## TASK-020. Paginatsiya

1. Barcha jadvallar uchun pagination: sahifa hajmi 10/25/50/100, jami ko'rsatkich: «1–10 / 45 tadan».
2. Ma'lumot hajmi katta bo'lgan sahifalarda (Tranzaksiyalar, Mahsulotlar) majburiy.
3. Arxitekturaga qarab client-side yoki server-side — mavjud API imkoniyatiga moslash.

## TASK-021. Jadval ustunlarini saralash

1. Barcha jadval sarlavha ustunlari (Raqam, Sana, Nomi, Summa, Holat) bosilganda saralanadigan bo'lsin.
2. Faol ustunda strelka indikator (▲/▼), qayta bosilganda yo'nalish almashadi.
3. TASK-004 dagi `Date`-asosli saralash util'idan foydalanilsin; summalar raqam sifatida saralansin.

## TASK-022. Export (Excel / PDF)

1. Jadvalli sahifalarga **«Export»** tugmasi: `.xlsx` (SheetJS) va PDF.
2. Ustuvor sahifalar: Tranzaksiyalar, To'lovlar, Qarzdorlik, Mahsulotlar, Ish haqi, Davomat.
3. **Hisob-faktura uchun alohida print-friendly PDF shablon**: kompaniya rekvizitlari, mijoz, buyurtma tarkibi (mahsulot, miqdor, narx, jami), imzo joyi. «Yuklab olish» ikonkasi shu shablonni bersin.

## TASK-023. Bildirishnoma tizimi (🔔)

**Muammo.** Header'dagi qo'ng'iroq ikonkasi hozircha dekorativ.

**Bajarilishi kerak:**
1. Dropdown-ro'yxat: kam zaxira ogohlantirishlari («Marker to'plami: 15 dona qoldi»), muddati o'tgan qarzlar, yangi buyurtma/bitim hodisalari.
2. O'qilmaganlar soni — badge; «Hammasini o'qilgan deb belgilash» tugmasi.
3. Bildirishnoma bosilganda tegishli sahifaga o'tish.

## TASK-024. Global qidiruv (Ctrl+K) — command palette

1. Mavjud qidiruv maydonini to'laqonli command palette'ga aylantir: mijozlar, mahsulotlar, buyurtmalar, yetkazib beruvchilar va sahifalar bo'ylab qidiradi.
2. Klaviatura navigatsiyasi (↑↓ Enter Esc), natijalar guruhlangan (Sahifalar / Mijozlar / Mahsulotlar...).
3. So'nggi qidiruvlar/tez amallar («+ Yangi buyurtma»).

## TASK-025. Bitimlar kanbanini yaxshilash

1. **Drag-and-drop**: kartani ustunlar orasida sudrab holatni o'zgartirish (masalan `@dnd-kit` bilan).
2. Karta bosilganda batafsil drawer/modal: mijoz, summa, mas'ul menejer, izohlar, holat tarixi.
3. «Yo'qotildi» ustuniga tashlanganda sabab tanlash modali (Narx / Raqobatchi / Boshqa).
4. Har bir ustun sarlavhasidagi soni va jami summa saqlansin (hozirgi kabi).

## TASK-026. Responsive dizayn

1. `< 1024px`: sidebar collapse — hamburger tugma bilan ochiladigan drawer.
2. Jadvallar: gorizontal scroll (min-width bilan) yoki mobil uchun card-view.
3. KPI grid: 4 ustun → 2 ustun → 1 ustun (`lg / md / sm`).
4. Kanban mobil rejimda gorizontal snap-scroll.

## TASK-027. Forma validatsiyasi

1. Yagona validatsiya yondashuvi (loyihada mavjud bo'lsa — `react-hook-form + zod`, bo'lmasa yengil custom).
2. Telefon: `+998 XX XXX-XX-XX` mask; Email: format tekshiruvi.
3. Majburiy maydonlar real-time xato matni bilan (submit'dan keyin emas, blur'da).
4. Summa inputlari: yozish paytida ming ajratgich (`10 000 000`), faqat raqam qabul qiladi.

## TASK-028. Formatlash util'larini markazlashtirish

1. `src/utils/format.ts` (yoki mavjud util papka): `formatMoney(1030000) → "1 030 000 so'm"`, `formatDate(d) → "18.07.2026"`, `formatPercent(x)`.
2. Loyiha bo'ylab hardcode formatlashlarni shu util'larga almashtir.
3. Manfiy summalar: `−1 500 000 so'm` (qizil), musbat: `+300 000 so'm` (yashil) — semantika komponent darajasida.

---

# 5-BO'LIM. QO'SHIMCHA TAKLIFLAR — P3 (ixtiyoriy, vaqt qolsa)

## TASK-029. Dark mode
CSS variables asosida (ranglar allaqachon token bo'lsa oson). Header'da toggle, tanlov `localStorage`da saqlanadi.

## TASK-030. Direktor paneli qo'shimcha vidjetlari
Top-5 mijoz (tushum bo'yicha), Top-5 mahsulot (sotuv bo'yicha), «Oxirgi amallar» tasmasi (audit jurnalidan).

## TASK-031. Qarzdorlik aging jadvali
Qarzlarni muddat bo'yicha guruhlash: 0–30 / 31–60 / 61–90 / 90+ kun ustunlari. Muddati o'tganlar qizil.

## TASK-032. Davomat ↔ Ish haqi integratsiyasi ko'rsatkichi
Ish haqi hisoblashda davomat (kelmadi/kasal/ta'til) hisobga olinayotgan bo'lsa — vedomostda buni ko'rsatish; olinmayotgan bo'lsa, hisoblash qoidasini sozlamalarga chiqarish.

## TASK-033. Klaviatura shortcutlari
`N` — joriy sahifada yangi yozuv, `/` yoki `Ctrl+K` — qidiruv, `Esc` — modalni yopish. Sozlamalarda shortcutlar ro'yxati.

## TASK-034. Rolga asoslangan UI
Direktor / Menejer / Omborchi rollariga qarab sidebar bo'limlari va amallar (o'chirish, moliya) cheklansin. Hozir rol faqat header'da yozuv sifatida turibdi.

---

# 6-BO'LIM. DIZAYN TIZIMI QOIDALARI (barcha yangi ishlar uchun)

1. **Uslub saqlanadi:** to'q sidebar + oq kontent, mavjud radius/spacing/shrift.
2. **Semantik ranglar:** yashil — ijobiy/kirim/faol; qizil — salbiy/chiqim/xato; sariq — ogohlantirish/qisman; ko'k — jarayonda/informatsion; kulrang — neytral/qoralama.
3. Bir xil ma'no — bir xil komponent: badge, tugma, modal, toast, empty-state, skeleton — hammasi bitta joydan (`src/components/ui/`).
4. Ikonkalar to'plami yagona bo'lsin (loyihada qaysi ishlatilgan bo'lsa — o'shani davom ettir).
5. Barcha interaktiv elementlar: hover, focus-visible, disabled holatlariga ega.

---

# 7-BO'LIM. YAKUNIY TEST CHEKLISTI

**Moliya mantig'i:**
- [ ] Manfiy balans validatsiyasi ishlaydi (TASK-001)
- [ ] Yalpi foyda ≥ Sof foyda (TASK-002)
- [ ] Foizlar taqqoslash davri bilan ko'rsatiladi (TASK-003)
- [ ] To'lovlar va barcha jadvallar sana bo'yicha to'g'ri saralanadi (TASK-004)
- [ ] Qisman to'langan fakturalar to'g'ri holat oladi (TASK-007)

**UI birxilligi:**
- [ ] Barcha sanalar `dd.mm.yyyy` (TASK-010)
- [ ] Badge palitra yagona (TASK-012)
- [ ] «Toshkend» so'zi loyihada qolmagan (TASK-006)
- [ ] Grafikda tooltip + legend bor (TASK-011)

**UX:**
- [ ] Har jadvalda empty state, skeleton, pagination (TASK-016, 017, 020)
- [ ] O'chirishlar tasdiq modali orqali (TASK-019)
- [ ] CRUD amallar toast bilan javob beradi (TASK-018)

**Texnik:**
- [ ] `npm run build` xatosiz
- [ ] Konsolda error/warning yo'q (asosiy sahifalar smoke-test)
- [ ] 1366px va 1920px kengliklarda layout buzilmaydi; <1024px responsive (TASK-026)

---

# ILOVA A. Tavsiya etilgan ish bosqichlari

```
1-sprint (P0):  TASK-001 … TASK-004   — moliyaviy mantiq (eng muhim)
2-sprint (P1):  TASK-005 … TASK-015   — ma'lumot va UI xatolari
3-sprint (P2):  TASK-016 … TASK-028   — UX takomillashtirish
4-sprint (P3):  TASK-029 … TASK-034   — qo'shimcha imkoniyatlar
```

Har sprint yakunida: build tekshiruvi, asosiy sahifalar bo'ylab smoke-test, checklist bo'yicha o'zini baholash.

# ILOVA B. Claude Code'ga boshlang'ich prompt namunasi

> Loyiha ildizidagi `ERP_Texnik_Topshiriq.md` faylini o'qib chiq. Avval loyiha strukturasini o'rgan (`src/` daraxti, router, store, servislar) va qisqa xulosa ber. So'ng TASK-001 dan boshlab P0 vazifalarni birma-bir bajar: har TASK uchun reja → kod → qabul mezonlari bo'yicha tekshiruv → commit. Har bir TASK yakunida nima o'zgargani haqida qisqa hisobot ber.
