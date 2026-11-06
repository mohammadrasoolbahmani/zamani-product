# راهنمای انتشار ZAMANI BURGER

این سند مسیر کامل انتشار پروژه را قدم‌به‌قدم توضیح می‌دهد:

- **کد و نسخه‌ها:** GitHub
- **فرانت‌اند (React/Vite):** Vercel
- **بک‌اند (Django/DRF):** Render
- **دیتابیس:** PostgreSQL رایگان Neon

> دیتابیس SQLite فقط برای اجرای محلی است. روی هاست‌هایی مثل Render و Vercel فایل‌سیستم پایدار نیست و باید از Postgres استفاده شود. پروژه با متغیر `DATABASE_URL` به‌صورت خودکار به Postgres وصل می‌شود.

---

## ۰. پیش‌نیازها

- حساب [GitHub](https://github.com)
- حساب [Vercel](https://vercel.com) (ورود با GitHub)
- حساب [Render](https://render.com) (ورود با GitHub)
- حساب [Neon](https://neon.tech) برای Postgres رایگان
- Git نصب‌شده روی سیستم

---

## ۱. آماده‌سازی و آپلود روی GitHub

در پوشه پروژه (`C:\Users\LOQ\Desktop\dash`):

```cmd
git init -b main
git config user.name "ZAMANI BURGER"
git config user.email "you@example.com"
git add .
git commit -m "chore: prepare ZAMANI BURGER for production deployment"
```

یک مخزن **خالی** (بدون README) در GitHub بساز؛ مثلاً `zamaniburger-dashboard`:

```cmd
git remote add origin https://github.com/<USERNAME>/zamaniburger-dashboard.git
git push -u origin main
```

> فایل‌های `.env`، `db.sqlite3`، `node_modules` و `dist` به‌صورت خودکار نادیده گرفته می‌شوند. قبل از push با `git status` مطمئن شو فایل حساسی اضافه نشده است.

### اجرای CI
با هر push، ورک‌فلوی `.github/workflows/ci.yml` تست‌های بک‌اند و build فرانت‌اند را اجرا می‌کند.

---

## ۲. ساخت دیتابیس Postgres روی Neon

1. در Neon یک Project جدید بساز (Region نزدیک کاربران، مثلاً Frankfurt).
2. از بخش **Connection Details** رشته اتصال را کپی کن. حتماً `?sslmode=require` داشته باشد:
   ```text
   postgresql://USER:PASSWORD@ep-xxxx.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```
3. این مقدار را برای مرحله بعد نگه دار (`DATABASE_URL`).

> جایگزین: Render Postgres یا Supabase. هر سرویسی که URL سازگار با Postgres بدهد کافی است.

---

## ۳. استقرار بک‌اند روی Render

### روش الف — Blueprint (پیشنهادی)
1. در Render → **New +** → **Blueprint**.
2. مخزن GitHub را انتخاب کن. فایل `render.yaml` به‌صورت خودکار خوانده می‌شود.
3. هنگام ساخت، مقدار این متغیرها را وارد کن:
   - `DATABASE_URL` → رشته Neon
   - `CORS_ALLOWED_ORIGINS` → فعلاً `http://localhost:5173` (بعداً دامنه Vercel را اضافه می‌کنی)
   - `CSRF_TRUSTED_ORIGINS` → فعلاً `https://<SERVICE-NAME>.onrender.com` (در مرحله ۵ دامنه Vercel هم اضافه می‌شود)
4. Deploy را بزن. اولین build شامل `migrate` و `collectstatic` است.
5. بعد از سبز شدن سرویس، این آدرس باید `{"status":"ok"}` برگرداند:
   ```text
   https://<SERVICE-NAME>.onrender.com/api/health/
   ```

### روش ب — سرویس دستی
اگر Blueprint را نمی‌خواهی:

- **Root Directory:** `backend`
- **Build Command:**
  ```bash
  pip install --upgrade pip && pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate --noinput
  ```
- **Start Command:**
  ```bash
  gunicorn zamaniburger_backend.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --timeout 60
  ```
- **Health Check Path:** `/api/health/`
- **Environment:**
  | کلید | مقدار |
  |---|---|
  | `PYTHON_VERSION` | `3.10.11` |
  | `DEBUG` | `False` |
  | `SECRET_KEY` | یک رشته تصادفی طولانی (Render می‌تواند بسازد) |
  | `DATABASE_URL` | رشته Neon |
  | `ALLOWED_HOSTS` | `.onrender.com` |
  | `CORS_ALLOWED_ORIGINS` | دامنه Vercel (بعداً) |
  | `CSRF_TRUSTED_ORIGINS` | `https://<SERVICE-NAME>.onrender.com` (و بعداً دامنه Vercel) |

### ساخت داده اولیه و کاربر مدیر
در Render → سرویس → **Shell**:

```bash
python manage.py seed_catalog
python manage.py createsuperuser
```

- `seed_catalog` همان ۷ محصول و ۳ تولیدکننده فعلی را می‌سازد و اجرای دوباره‌اش مشکلی ندارد.
- برای `createsuperuser` نام کاربری و رمز قوی انتخاب کن. اگر می‌خواهی غیرتعاملی باشد:
  ```bash
  DJANGO_SUPERUSER_PASSWORD='یک-رمز-قوی' python manage.py createsuperuser --noinput --username admin --email admin@example.com
  ```
- پنل ادمین: `https://<SERVICE-NAME>.onrender.com/admin/`

---

## ۴. استقرار فرانت‌اند روی Vercel

1. در Vercel → **Add New** → **Project** → مخزن GitHub را انتخاب کن.
2. **Root Directory** را روی `frontend` بگذار.
3. Framework: **Vite** (خودکار تشخیص داده می‌شود).
4. Build Command: `npm run build` — Output Directory: `dist`.
5. در **Environment Variables** اضافه کن:
   ```text
   VITE_API_URL=https://<SERVICE-NAME>.onrender.com/api
   ```
6. Deploy. آدرس نهایی چیزی شبیه این می‌شود:
   ```text
   https://zamaniburger.vercel.app
   ```

> `frontend/vercel.json` مسیرهای SPA (رفرش صفحه‌های داخلی) و هدرهای امنیتی را تنظیم می‌کند.

---

## ۵. اتصال نهایی فرانت و بک‌اند

در Render → Environment این دو مقدار را تنظیم کن (دامنه واقعی سرویس رندر و دامنه Vercel را جایگزین کن):

```text
CORS_ALLOWED_ORIGINS=https://zamaniburger.vercel.app
CSRF_TRUSTED_ORIGINS=https://<SERVICE-NAME>.onrender.com,https://zamaniburger.vercel.app
```

> `CSRF_TRUSTED_ORIGINS` باید دامنهٔ خود Render را هم داشته باشد تا ورود به پنل ادمین کار کند.

سپس **Manual Deploy → Deploy latest commit** را بزن (یا فقط Restart).

حالا:
1. سایت Vercel را باز کن.
2. با کاربر مدیر وارد شو.
3. یک ثبت آزمایشی انجام بده و پاک کن.
4. سلامت API: `https://<SERVICE-NAME>.onrender.com/api/health/`

---

## ۶. دامنه اختصاصی (اختیاری)

- **Vercel:** Project → Settings → Domains → دامنه را اضافه کن و رکورد DNS را طبق راهنما تنظیم کن.
- بعد از اتصال دامنه، همان دامنه را در `CORS_ALLOWED_ORIGINS` و `CSRF_TRUSTED_ORIGINS` بک‌اند هم اضافه کن (با `https://`). دامنهٔ Render را از `CSRF_TRUSTED_ORIGINS` حذف نکن.
- در صورت تمایل، یک ساب‌دامین مثل `api.example.com` به Render بده و `ALLOWED_HOSTS` را به‌روزرسانی کن.

---

## ۷. نکات مهم عملیاتی

- **پلن رایگان Render** پس از بی‌کاری سرویس را می‌خواباند؛ اولین درخواست ممکن است ۳۰ تا ۶۰ ثانیه طول بکشد. برای استفاده روزانه، پلن پایه یا یک سرویس UptimeRobot توصیه می‌شود.
- **Neon رایگان** محدودیت ذخیره‌سازی و اتصال هم‌زمان دارد؛ برای این حجم داده کافی است.
- **تصویر محصول:** آپلود فایل روی Render پایدار نیست (دیسک موقت). در نسخه فعلی تصویر محصول اختیاری است و رابط از آواتار خودکار استفاده می‌کند. برای آپلود واقعی، بعداً Object Storage (مثل Cloudinary یا S3) اضافه کن.
- **پشتیبان‌گیری:** از Neon به‌صورت دوره‌ای بکاپ بگیر (`pg_dump`).
- **رمزها:** رمز محیط توسعه را هرگز روی نسخه آنلاین استفاده نکن؛ برای مدیر یک رمز قوی و یکتا بگذار.
- **DEBUG:** همیشه `False` روی سرور. با `DEBUG=True` و `SECRET_KEY` خالی، سرویس عمداً بالا نمی‌آید.

---

## ۸. عیب‌یابی سریع

| مشکل | علت رایج | راه‌حل |
|---|---|---|
| `DisallowedHost` | دامنه در `ALLOWED_HOSTS` نیست | `.onrender.com` و دامنه اختصاصی را اضافه کن |
| خطای CORS در مرورگر | دامنه Vercel در `CORS_ALLOWED_ORIGINS` نیست | دامنه دقیق با `https://` را اضافه و Redeploy کن |
| `CSRF verification failed` در ادمین | دامنه در `CSRF_TRUSTED_ORIGINS` نیست | همان دامنه را اضافه کن |
| صفحه ۴۰۴ بعد از رفرش | تنظیم SPA در Vercel | وجود `frontend/vercel.json` و Root Directory=`frontend` را چک کن |
| `SECRET_KEY ... required` | `DEBUG=False` بدون کلید | `SECRET_KEY` را در Environment بگذار |
| `could not connect to server` | `DATABASE_URL` غلط/بدون SSL | رشته Neon را با `?sslmode=require` دوباره بگذار |
| استایل پنل ادمین لود نمی‌شود | `collectstatic` اجرا نشده | Build Command را کامل کن و Redeploy |
| داده‌ها بعد از دیپلوی پاک می‌شوند | استفاده از SQLite | `DATABASE_URL` را تنظیم کن |

---

## ۹. چک‌لیست قبل از تحویل رسمی

- [ ] کد روی GitHub push شده است
- [ ] `DEBUG=False` و `SECRET_KEY` تصادفی روی Render تنظیم شده است
- [ ] `DATABASE_URL` به Neon وصل است و migrate اجرا شده
- [ ] `seed_catalog` اجرا شده (۷ محصول و ۳ تولیدکننده)
- [ ] کاربر مدیر با رمز قوی ساخته شده و رمز پیش‌فرض توسعه استفاده نشده
- [ ] `CORS_ALLOWED_ORIGINS` دقیقاً دامنه Vercel است و `CSRF_TRUSTED_ORIGINS` هم دامنه Render و هم دامنه Vercel را دارد
- [ ] `/api/health/` سبز است
- [ ] ورود، ثبت تولید، ثبت گاری، ثبت گروهی و گزارش‌گیری روی نسخه آنلاین تست شده‌اند
- [ ] بکاپ دیتابیس گرفته شده است
