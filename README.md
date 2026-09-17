# ردیاب ADHD — Student Tracker PWA

[![Live Demo](https://img.shields.io/badge/Live%20Demo-adhd--friendly--tracker.pages.dev-6366f1?style=for-the-badge&logo=cloudflarepages&logoColor=white)](https://adhd-friendly-tracker.pages.dev/)
[![PWA Ready](https://img.shields.io/badge/PWA-Installable-10b981?style=for-the-badge&logo=pwa&logoColor=white)](https://adhd-friendly-tracker.pages.dev/)

> 🌐 **دموی آنلاین و زنده:**  
> **[https://adhd-friendly-tracker.pages.dev/](https://adhd-friendly-tracker.pages.dev/)**

یک اپ **Progressive Web App** برای مدیریت وظایف دانشجویان مبتلا به ADHD.  
قابل نصب روی Windows، iOS Safari، و Android بدون نیاز به VPN در ایران.

---

## 🚀 شروع سریع

```bash
# ۱. نصب وابستگی‌ها
npm install

# ۲. ساخت فایل .env (اختیاری - بدون آن هم کار می‌کند)
cp .env.example .env

# ۳. اجرای محلی
npm run dev
# → http://localhost:5173
```

---

## 📁 ساختار پروژه

```
adhd-tracker/
├── cloudflare-worker/
│   └── index.js              # پروکسی Gemini AI
├── supabase/
│   └── migration.sql         # اسکیمای دیتابیس
├── src/
│   ├── lib/
│   │   ├── db.js             # LocalStorage (آفلاین)
│   │   ├── supabase.js       # کلاینت Supabase
│   │   ├── gemini.js         # گیت‌وی هوش مصنوعی
│   │   ├── ical.js           # پارسر iCal مودل
│   │   ├── jalali.js         # تقویم شمسی
│   │   └── audio.js          # Web Audio API
│   ├── store/
│   │   ├── useTaskStore.js
│   │   ├── useTimerStore.js
│   │   └── useSettingsStore.js
│   └── components/ + pages/
├── .env.example
└── vite.config.js
```

---

## ☁️ راه‌اندازی Cloudflare Worker (AI)

```bash
cd cloudflare-worker
npm install -g wrangler
wrangler login
wrangler secret put GEMINI_API_KEY
wrangler deploy
# آدرس Worker را در .env بگذارید
```

---

## 🗄️ راه‌اندازی Supabase

1. پروژه رایگان در [supabase.com](https://supabase.com)
2. فایل `supabase/migration.sql` را در SQL Editor اجرا کنید
3. URL و Anon Key را در تنظیمات اپ وارد کنید

---

## 📱 نصب PWA

- **iOS Safari**: Share → Add to Home Screen
- **Android Chrome**: منو (⋮) → Install App  
- **Windows Chrome**: آیکون نصب در نوار آدرس

---

## 🤖 System Prompts

| Prompt | کاربرد |
|--------|--------|
| `BRAIN_DUMP_SYSTEM_PROMPT` | متن آزاد → وظایف ساختاریافته |
| `TASK_DECOMPOSER_SYSTEM_PROMPT` | وظیفه → ۳-۵ گام کوچک |
| `AUTO_SCHEDULE_SYSTEM_PROMPT` | زمان‌بندی روز بر اساس انرژی |

---

## 🎨 ویژگی‌های ADHD-Friendly

| ویژگی | توضیح |
|-------|--------|
| 🧠 تخلیه ذهن | ورودی متن + صوتی فارسی |
| 🎯 حالت تمرکز | تایمر SVG + confetti |
| ⚡ فیلتر انرژی | High/Medium/Low |
| 🔄 Drag and Drop | مرتب‌سازی دستی |
| 📅 تقویم یکپارچه ابری | شمسی + میلادی + همگام‌سازی زنده Google، Apple و Samsung Calendar |
| 🤖 هوش مصنوعی تاب‌آور | کشف خودکار مدل‌های فعال و Fallback هوشمند هنگام خطای ۴۰۴ |
| ⏰ کوری زمانی | ثبت و تحلیل دقت تخمین |
| 🎵 صدای طبیعی | Web Audio API بدون فایل |

---

## 🛠️ اسکریپت‌ها

```bash
npm run dev      # توسعه
npm run build    # تولید
npm run preview  # پیش‌نمایش
```
