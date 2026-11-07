# تصاريح الغردقة (PWA)

تطبيق Progressive Web App لعرض تشغيلات الغردقة (القاهرة / الأقصر) من Google Sheets، مع إدارة المرشدين وإشعارات يومية.

## المميزات

- عرض 7 أيام قادمة (من بكرة)
- فلترة تلقائية: HRG → CAI و HRG → LUX فقط
- طباعة يوم واحد أو كل الأيام (A4 landscape)
- إدارة المرشدين (إضافة / تعديل / أرشفة / سحب من الشيت)
- Push Notifications يوميًا حوالي الساعة 9 صباحًا بتوقيت القاهرة
- يعمل كتطبيق من الشاشة الرئيسية (Android + iOS)
- زر خروج + بانر تثبيت التطبيق

## 1) Service Account (مرة واحدة)

1. Google Cloud Console ← مشروع جديد ← فعّل **Google Sheets API**.
2. IAM ← Service Accounts ← Create ← Keys ← Add key ← JSON (نزّل الملف).
3. افتح الشيت ← Share ← الصق إيميل الـ Service Account (`client_email`) بصلاحية **Editor**.

## 2) مفاتيح الإشعارات

```bash
npx web-push generate-vapid-keys
```

انسخ الـ Public و Private.

## 3) المتغيرات (.env أو Vercel)

| المتغير | الوصف |
|---------|--------|
| `APP_PIN` | الرقم السري للدخول |
| `SHEET_ID` | ID الشيت (الجزء بين `/d/` و `/edit`) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | محتوى ملف JSON كامل أو base64 منه |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | المفتاح العام |
| `VAPID_PRIVATE_KEY` | المفتاح الخاص |
| `VAPID_EMAIL` | إيميل (مثل you@example.com) |
| `CRON_SECRET` | نص عشوائي طويل (Vercel يبعته تلقائيًا للـ cron) |

## 4) التشغيل محليًا

```bash
cp .env.example .env.local
# عدّل القيم
npm install
npm run dev
```

## 5) النشر على Vercel

```bash
npm i -g vercel
vercel            # أول مرة: اربط المشروع
# ضيف المتغيرات من لوحة Vercel ← Settings ← Environment Variables
vercel --prod
```

الـ cron مضبوط على `0 6 * * *` و `0 7 * * *` (UTC) عشان يطلع حوالي 9 صباحًا بتوقيت القاهرة.

## 6) على الموبايل

- افتح رابط Vercel ← ادخل الرقم السري.
- Android: هيظهر بانر "تثبيت" أو من القائمة ← Install app.
- iPhone: Share ← Add to Home Screen، وافتح من الأيقونة (مطلوب للإشعارات على iOS 16.4+).

## اختبار الإشعار فورًا

```bash
curl -H "Authorization: Bearer $CRON_SECRET" "https://YOUR_APP.vercel.app/api/cron?force=1"
```

## هيكل الشيت المتوقع

- تابات بأسماء أيام مثل `7NOV` أو `07 NOV` (اليوم + أول 3 حروف من الشهر بالإنجليزي).
- صف هيدر فيه أعمدة: `FILE NO` | `PAX` | `STATUS` | `HOTEL` | `GUIDE` ...
- STATUS يكون فيه مثل: `HRG / CAI` أو `HRG / LUX` (يُتجاهل المطارات).
- تاب `Guides` و `PushSubs` بيتنشؤوا تلقائيًا.

## ملاحظات

- خطة Hobby في Vercel بتشغّل الـ cron في أي وقت خلال الساعة المحددة (مش بالدقيقة).
- الإشعارات تحتاج HTTPS (Vercel بيوفره).
- الرقم السري بيتخزن في `localStorage` على الجهاز فقط.
