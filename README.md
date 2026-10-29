# مخزن لوگوهای ایرانی (Iran Logo Kit)

سایت استاتیک برای GitHub Pages: ۸۳۴ لوگو (SVG + PNG) در ۲۱ دسته، با جستجو، فیلتر و دانلود.

## ساختار
- `index.html` – ساختار صفحه
- `styles.css` – استایل‌ها (تم سبز-سیاه، RTL)
- `app.js` – منطق برنامه (vanilla JS، بدون وابستگی)
- `sw.js` / `manifest.webmanifest` – کار آفلاین و نصب به‌عنوان اپ
- `data/logos.json` – فهرست لوگوها
- `logos/svg/` و `logos/png/` – فایل‌ها
- `download/iran-brand-logos-all-formats.zip` – پکیج کامل
- `.nojekyll` – غیرفعال کردن Jekyll در GitHub Pages

## انتشار روی GitHub Pages
1. ریپازیتوری جدید بسازید (مثلاً `iran-logo-kit`).
2. این پوشه را push کنید.
3. Settings → Pages → Source: `Deploy from a branch` → Branch: `main` / `(root)`.
4. آدرس: `https://<username>.github.io/iran-logo-kit/`

> نکته: سایت با `fetch` فهرست را می‌خواند، پس باید از طریق HTTP باز شود، نه با دابل‌کلیک روی فایل.

## لایسنس
کد و داده‌ها: MIT (طبق LICENSE). لوگوها متعلق به برندهای مربوطه‌اند.

## رنگ‌های برند
- زیتل: `#0AB5E0` (منبع: Brandfetch) · نیرو موتور: `#FF2929` و `#0D3B66` (منبع: Brandfetch)
- هلو: `#C60001` (منبع: Brandfetch) · کله: سبز و قرمز مطابق ثبت علامت تجاری
- برای سایر لوگوهای سیاه/سفید منبع معتبر رنگ پیدا نشد؛ آن‌ها بدون تغییر منتشر شده‌اند.
