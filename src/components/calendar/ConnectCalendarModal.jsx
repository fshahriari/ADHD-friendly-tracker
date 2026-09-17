import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon, CheckCircle2, AlertCircle, RefreshCw,
  Trash2, Upload, HelpCircle, Plus, Monitor, AlertTriangle, ExternalLink
} from 'lucide-react';
import { Modal, Button, Spinner, toast } from '../shared';
import { calendarSyncService } from '../../lib/calendarSyncService';
import { useSettingsStore } from '../../store/useSettingsStore';

export default function ConnectCalendarModal({ open, onClose, onSyncComplete }) {
  const { theme } = useSettingsStore();
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState('google'); // 'google' | 'apple' | 'custom' | 'samsung' | 'connected'
  const [calendars, setCalendars] = useState([]);
  const [googleUrl, setGoogleUrl] = useState('');
  const [googleName, setGoogleName] = useState('');
  const [appleUrl, setAppleUrl] = useState('');
  const [appleName, setAppleName] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [customName, setCustomName] = useState('');
  const [samsungUrl, setSamsungUrl] = useState('');
  const [samsungName, setSamsungName] = useState('');

  const [connecting, setConnecting] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);

  // Load calendars and listen to changes
  useEffect(() => {
    if (!open) return;
    const update = () => setCalendars(calendarSyncService.getCalendars());
    update();
    return calendarSyncService.subscribe(update);
  }, [open]);

  // If there are connected calendars, default to 'connected' tab if user clicks or already has some
  const connectedCount = calendars.length;

  const handleConnect = async ({ url, name, provider }) => {
    if (!url.trim()) {
      toast('لطفاً آدرس تقویم را وارد کنید', 'warning');
      return;
    }

    // Friendly validation for Google Calendar
    if (provider === 'google' && !url.includes('.ics') && !url.includes('/ical/')) {
      toast('لطفاً آدرس مخفی iCal (Secret address) که به .ics ختم می‌شود را کپی کنید', 'warning');
      return;
    }

    setConnecting(true);
    try {
      const { calendar, events, error } = await calendarSyncService.addCalendar({
        url: url.trim(),
        name: name.trim() || (provider === 'google' ? 'Google Calendar' : (provider === 'apple' ? 'Apple Calendar' : 'تقویم')),
        provider,
      });

      if (error) {
        toast(`تقویم اضافه شد اما همگام‌سازی رویدادها با خطا مواجه شد: ${error}`, 'warning');
      } else {
        toast(`تقویم با موفقیت متصل شد! (${events.length} رویداد دریافت شد) 🎉`);
      }

      // Reset form
      if (provider === 'google')  { setGoogleUrl(''); setGoogleName(''); }
      if (provider === 'apple')   { setAppleUrl(''); setAppleName(''); }
      if (provider === 'samsung') { setSamsungUrl(''); setSamsungName(''); }
      if (provider === 'moodle' || provider === 'ical') { setCustomUrl(''); setCustomName(''); }

      setActiveTab('connected');
      onSyncComplete?.();
    } catch (err) {
      toast(`خطا در اتصال به تقویم: ${err.message}`, 'error');
    } finally {
      setConnecting(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileLoading(true);
    try {
      const text = await file.text();
      const calName = file.name.replace(/\.ics$/i, '');
      const { events } = await calendarSyncService.importFromIcsText(text, calName, 'google');
      toast(`فایل با موفقیت وارد شد! (${events.length} رویداد افزوده شد) ✅`);
      setActiveTab('connected');
      onSyncComplete?.();
    } catch (err) {
      toast(`خطا در خواندن فایل تقویم: ${err.message}`, 'error');
    } finally {
      setFileLoading(false);
      e.target.value = '';
    }
  };

  const handleSyncAll = async () => {
    setSyncingAll(true);
    try {
      const { totalEvents, errors } = await calendarSyncService.syncAll();
      if (errors.length) {
        toast(`همگام‌سازی با چند هشدار پایان یافت: ${errors.join('، ')}`, 'warning');
      } else {
        toast(`${totalEvents} رویداد از تمام تقویم‌ها به‌روزرسانی شد ✅`);
      }
      onSyncComplete?.();
    } catch (err) {
      toast(`خطا در همگام‌سازی: ${err.message}`, 'error');
    } finally {
      setSyncingAll(false);
    }
  };

  const handleRemove = (id, name) => {
    calendarSyncService.removeCalendar(id);
    toast(`تقویم «${name}» حذف شد.`);
    onSyncComplete?.();
  };

  return (
    <Modal open={open} onClose={onClose} title="🔗 اتصال به تقویم‌های ابری">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Navigation Tabs */}
        <div style={{
          display: 'flex', gap: 6, padding: 4, background: isDark ? 'rgba(var(--accent-glow-rgb), 0.08)' : 'rgba(var(--accent-glow-rgb), 0.05)',
          borderRadius: 12, border: `1px solid ${isDark ? 'rgba(var(--accent-glow-rgb), 0.15)' : 'rgba(var(--accent-glow-rgb), 0.2)'}`, overflowX: 'auto'
        }}>
          {[
            { id: 'google',    label: 'Google Calendar', icon: '🌐', color: '#4285F4' },
            { id: 'apple',     label: 'Apple Calendar',  icon: '🍏', color: '#94a3b8' },
            { id: 'custom',    label: 'مودل / فایل .ics', icon: '📁', color: '#f59e0b' },
            { id: 'samsung',   label: 'Samsung Calendar', icon: '📱', color: '#034ea2' },
            { id: 'connected', label: `تقویم‌های متصل (${connectedCount})`, icon: '📋', color: '#34d399' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1, minWidth: 'fit-content', padding: '8px 12px', borderRadius: 9,
                border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem',
                fontWeight: activeTab === tab.id ? 700 : 500,
                background: activeTab === tab.id ? 'var(--color-primary-600)' : 'transparent',
                color: activeTab === tab.id ? '#ffffff' : (isDark ? 'var(--text-secondary)' : '#4c4469'),
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'all 150ms ease',
                whiteSpace: 'nowrap',
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ── TAB 1: GOOGLE CALENDAR ────────────────────────────────────── */}
        {activeTab === 'google' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Desktop Web Notice */}
            <div style={{
              background: isDark ? 'rgba(59, 130, 246, 0.12)' : 'rgba(59, 130, 246, 0.08)',
              border: `1px solid ${isDark ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.25)'}`,
              borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 10
            }}>
              <Monitor size={20} color={isDark ? '#60a5fa' : '#2563eb'} style={{ marginTop: 2, flexShrink: 0 }} />
              <div style={{ fontSize: '0.82rem', lineHeight: 1.7, color: isDark ? '#e2e8f0' : '#1e293b' }}>
                <strong style={{ color: isDark ? '#93c5fd' : '#1d4ed8', display: 'block', marginBottom: 2 }}>
                  💻 نکته مهم: این کار حتماً باید در نسخه وب (کامپیوتر یا ویندوز) انجام شود
                </strong>
                <span>
                  <strong>اپلیکیشن موبایل گوگل کلندر اصلاً گزینه خروجی iCal ندارد</strong> و گوگل این قابلیت را فقط و فقط در <strong>نسخه وب (کامپیوتر/ویندوز)</strong> قرار داده است؛ پس برای دریافت این لینک حتماً باید از طریق مرورگر کامپیوتر یا ویندوز اقدام نمایید.
                </span>
              </div>
            </div>

            {/* Guide Steps */}
            <div style={{
              background: isDark ? 'rgba(66, 133, 244, 0.06)' : 'rgba(66, 133, 244, 0.05)',
              border: `1px solid ${isDark ? 'rgba(66, 133, 244, 0.2)' : 'rgba(66, 133, 244, 0.18)'}`,
              borderRadius: 14, padding: 14,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                color: isDark ? '#93c5fd' : '#1d4ed8',
                fontWeight: 800, fontSize: '0.92rem', marginBottom: 12
              }}>
                <span>📋 مراحل گام‌به‌گام در ویندوز (مرورگر کامپیوتر):</span>
              </div>

              <ol style={{
                margin: 0, paddingRight: 20, fontSize: '0.82rem', lineHeight: 1.9,
                color: isDark ? 'var(--text-secondary)' : '#334155',
                display: 'flex', flexDirection: 'column', gap: 8
              }}>
                <li>
                  وارد <a href="https://calendar.google.com" target="_blank" rel="noreferrer" style={{ color: isDark ? '#60a5fa' : '#1d4ed8', fontWeight: 700, textDecoration: 'underline' }}>calendar.google.com</a> شوید.
                </li>
                <li>
                  <strong>باز کردن منوی سمت چپ:</strong> اگر ستون سمت چپ بسته است، بالای صفحه سمت چپ روی <strong>آیکون ۳ خط (☰)</strong> بزنید تا ستون باز شود.
                </li>
                <li>
                  <strong>پیدا کردن تقویم:</strong> در ستون سمت چپ، به پایین اسکرول کنید تا بخش <strong>My calendars</strong> (تقویم‌های من) را ببینید. نام تقویم اصلی‌تان (که معمولاً نام خودتان است) آنجا قرار دارد.
                </li>
                <li>
                  <strong>کلیک روی سه‌نقطه:</strong> ماوس را روی نام تقویم ببرید تا علامت <strong>۳ نقطه عمودی (⋮)</strong> در کنار آن ظاهر شود. روی ۳ نقطه کلیک کرده و گزینه <strong>Settings and sharing</strong> (تنظیمات و اشتراک‌گذاری) را انتخاب کنید.
                </li>
                <li>
                  <strong>رسیدن به بخش یکپارچه‌سازی:</strong> در صفحه‌ای که باز می‌شود، صفحه را به سمت پایین اسکرول کنید تا به تیتر <strong>Integrate calendar</strong> (یکپارچه‌سازی تقویم) برسید (یا از منوی سمت چپ روی Integrate calendar کلیک کنید).
                </li>
                <li>
                  <strong>کپی کردن لینک مخفی:</strong> به دنبال کادر <strong>Secret address in iCal format</strong> (آدرس محرمانه با فرمت iCal) باشید و روی دکمه <strong>Copy</strong> (آیکون کپی) در کنار آن کلیک کنید. لینکی که کپی می‌شود به <code>.ics</code> ختم می‌شود؛ همان را در کادر زیر وارد کنید.
                </li>
              </ol>

              {/* Troubleshooting notes */}
              <div style={{
                marginTop: 14, paddingTop: 12, borderTop: `1px dashed ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                display: 'flex', flexDirection: 'column', gap: 8
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.82rem', color: isDark ? '#f59e0b' : '#b45309' }}>
                  <AlertTriangle size={15} />
                  <span>دو نکته کلیدی در صورت پیدا نشدن:</span>
                </div>
                <ul style={{
                  margin: 0, paddingRight: 20, fontSize: '0.78rem', lineHeight: 1.7,
                  color: isDark ? 'var(--text-secondary)' : '#475569',
                  display: 'flex', flexDirection: 'column', gap: 4
                }}>
                  <li>
                    <strong>چرخدنده بالای صفحه را نزنید:</strong> چرخدنده بالای صفحه مربوط به تنظیمات عمومی است؛ حتماً باید سه‌نقطه روی اسم تقویم در منوی چپ را بزنید.
                  </li>
                  <li>
                    <strong>ایمیل سازمانی / اداری:</strong> اگر تقویم مربوط به ایمیل شرکتی یا دانشگاهی است، ممکن است ادمین سازمان اشتراک‌گذاری تقویم را بسته باشد، اما در جیمیل‌های شخصی (<code>@gmail.com</code>) این بخش همیشه فعال و در دسترس است.
                  </li>
                </ul>
              </div>
            </div>

            {/* Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                  آدرس مخفی تقویم گوگل (Secret iCal URL) *
                </label>
                <input
                  type="url"
                  className="input"
                  dir="ltr"
                  placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
                  value={googleUrl}
                  onChange={(e) => setGoogleUrl(e.target.value)}
                  style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                  نام نمایشی دلخواه (اختیاری)
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="مثال: کارهای روزمره گوگل یا تقویم کاری"
                  value={googleName}
                  onChange={(e) => setGoogleName(e.target.value)}
                />
              </div>

              <Button
                variant="primary"
                onClick={() => handleConnect({ url: googleUrl, name: googleName, provider: 'google' })}
                disabled={connecting || !googleUrl.trim()}
                style={{ marginTop: 4, background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}
              >
                {connecting ? <><Spinner size={16} color="white" /> در حال اتصال و دریافت رویدادها...</> : <><CheckCircle2 size={16} /> اتصال تقویم گوگل</>}
              </Button>
            </div>
          </div>
        )}

        {/* ── TAB 2: APPLE CALENDAR ─────────────────────────────────────── */}
        {activeTab === 'apple' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
              background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(var(--accent-glow-rgb), 0.08)',
              border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(var(--accent-glow-rgb), 0.25)'}`,
              borderRadius: 14, padding: 14,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                color: isDark ? '#f1f5f9' : '#0f172a',
                fontWeight: 800, fontSize: '0.95rem', marginBottom: 10
              }}>
                <span>🍏 راهنمای اتصال تقویم اپل (iCloud Calendar):</span>
              </div>
              <ol style={{
                margin: 0, paddingRight: 20, fontSize: '0.82rem', lineHeight: 1.8,
                color: isDark ? 'var(--text-secondary)' : '#334155'
              }}>
                <li>
                  در آیفون، مک یا وبسایت <a href="https://www.icloud.com/calendar" target="_blank" rel="noreferrer" style={{ color: isDark ? '#38bdf8' : '#0284c7', fontWeight: 600, textDecoration: 'underline' }}>iCloud.com</a> برنامه Calendar را باز کنید.
                </li>
                <li>
                  روی علامت تقویم‌ها یا علامت اشتراک‌گذاری (ℹ️) کنار تقویم موردنظرتان بزنید.
                </li>
                <li>
                  گزینه <strong>Public Calendar</strong> را روشن کنید و دکمه <strong>Share Link</strong> را لمس کنید.
                </li>
                <li>
                  لینک کپی‌شده (که با <code>webcal://</code> یا <code>https://</code> شروع می‌شود) را در کادر زیر قرار دهید.
                </li>
              </ol>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                  لینک تقویم اپل (Webcal یا ICS) *
                </label>
                <input
                  type="url"
                  className="input"
                  dir="ltr"
                  placeholder="webcal://p12-caldav.icloud.com/published/2/..."
                  value={appleUrl}
                  onChange={(e) => setAppleUrl(e.target.value)}
                  style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                  نام نمایشی دلخواه (اختیاری)
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="مثال: تقویم شخصی آیفون"
                  value={appleName}
                  onChange={(e) => setAppleName(e.target.value)}
                />
              </div>

              <Button
                variant="primary"
                onClick={() => handleConnect({ url: appleUrl, name: appleName, provider: 'apple' })}
                disabled={connecting || !appleUrl.trim()}
                style={{ marginTop: 4 }}
              >
                {connecting ? <><Spinner size={16} color="white" /> در حال اتصال...</> : <><CheckCircle2 size={16} /> اتصال تقویم اپل</>}
              </Button>
            </div>
          </div>
        )}

        {/* ── TAB 3: CUSTOM / MOODLE / FILE UPLOAD ─────────────────────── */}
        {activeTab === 'custom' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Custom Link Section */}
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: 8 }}>
                🌐 اتصال با لینک تقویم دانشگاه (مودل) یا Outlook:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input
                  type="url"
                  className="input"
                  dir="ltr"
                  placeholder="https://moodle.../calendar/export_execute.php?..."
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                />
                <input
                  type="text"
                  className="input"
                  placeholder="نام تقویم (مثال: کلاس‌های ترم پاییز)"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                />
                <Button
                  variant="primary"
                  onClick={() => handleConnect({ url: customUrl, name: customName, provider: 'moodle' })}
                  disabled={connecting || !customUrl.trim()}
                >
                  {connecting ? <><Spinner size={16} color="white" /> در حال اتصال...</> : <><Plus size={16} /> افزودن تقویم</>}
                </Button>
              </div>
            </div>

            <div style={{ height: 1, background: 'var(--color-surface-700)' }} />

            {/* Offline File Upload Section */}
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: 6 }}>
                📁 بارگذاری فایل خروجی تقویم (.ics):
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 10px' }}>
                اگر به اینترنت آزاد دسترسی ندارید، می‌توانید فایل تقویم خروجی گرفته شده از گوگل یا اپل را مستقیم آپلود کنید:
              </p>
              <label style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '20px 16px', borderRadius: 12, border: '2px dashed var(--color-surface-600)',
                cursor: 'pointer', background: 'rgba(var(--accent-glow-rgb),0.04)', transition: 'border-color 150ms',
              }}>
                <Upload size={24} color="#a78bfa" style={{ marginBottom: 6 }} />
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {fileLoading ? 'در حال پردازش فایل...' : 'انتخاب یا رها کردن فایل .ics'}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                  پشتیبانی از تمام خروجی‌های استاندارد تقویم
                </span>
                <input
                  type="file"
                  accept=".ics,text/calendar"
                  onChange={handleFileUpload}
                  disabled={fileLoading}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          </div>
        )}

        {/* ── TAB 4: SAMSUNG CALENDAR ───────────────────────────────────── */}
        {activeTab === 'samsung' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
              background: isDark ? 'rgba(3, 78, 162, 0.12)' : 'rgba(3, 78, 162, 0.08)',
              border: `1px solid ${isDark ? 'rgba(3, 78, 162, 0.35)' : 'rgba(3, 78, 162, 0.3)'}`,
              borderRadius: 14, padding: 14,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                color: isDark ? '#60a5fa' : '#034ea2',
                fontWeight: 800, fontSize: '0.95rem', marginBottom: 10
              }}>
                <span>📱 نحوه اتصال تقویم سامسونگ (Samsung Calendar):</span>
              </div>
              <p style={{
                fontSize: '0.82rem', lineHeight: 1.8,
                color: isDark ? 'var(--text-secondary)' : '#334155',
                margin: '0 0 10px'
              }}>
                گوشی‌های سامسونگ رویدادها را روی حساب‌های ابری شما (مثل اکانت‌های گوگل کاری یا شخصی شما) ذخیره و همگام می‌کنند.
              </p>

              <div style={{
                background: isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
                border: `1px solid ${isDark ? '#1a1130' : '#e2e8f0'}`,
                borderRadius: 10, padding: '10px 12px', marginBottom: 10, fontSize: '0.8rem', lineHeight: 1.7
              }}>
                <strong style={{ color: isDark ? '#a78bfa' : '#6d28d9', display: 'block', marginBottom: 4 }}>
                  💡 بهترین روش (همگام‌سازی زنده و خودکار):
                </strong>
                چون در گوشی سامسونگ، رویدادهای کاری و شخصی‌تان روی اکانت‌های گوگل‌تان ذخیره می‌شوند،
                کافیست در تب <strong>Google Calendar</strong> آدرس مخفی iCal تقویم هر دو اکانت گوگل خود را جداگانه اضافه کنید.
                با این کار، هر رویدادی در تقویم گوشی سامسونگ ثبت یا ویرایش کنید، بلافاصله و خودکار اینجا هم به‌روزرسانی می‌شود!
                <div style={{ marginTop: 8 }}>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab('google')} style={{ fontSize: '0.78rem' }}>
                    رفتن به تب اتصال Google Calendar
                  </Button>
                </div>
              </div>

              <div style={{
                background: isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
                border: `1px solid ${isDark ? '#1a1130' : '#e2e8f0'}`,
                borderRadius: 10, padding: '10px 12px', fontSize: '0.8rem', lineHeight: 1.7
              }}>
                <strong style={{ color: isDark ? '#34d399' : '#059669', display: 'block', marginBottom: 4 }}>
                  📁 روش دوم: خروجی مستقیم فایل تقویم از گوشی سامسونگ (.ics):
                </strong>
                در برنامه تقویم سامسونگ روی گوشی: منو (☰) &gt; تنظیمات (⚙️) &gt; گزینه Manage calendars یا Export calendar را بزنید و تقویم را به شکل فایل ذخیره کنید، سپس در کادر زیر بارگذاری نمایید:
              </div>
            </div>

            {/* Direct .ics upload for Samsung */}
            <label style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '16px', borderRadius: 12, border: '2px dashed var(--color-surface-600)',
              cursor: 'pointer', background: 'rgba(var(--accent-glow-rgb),0.04)', transition: 'border-color 150ms',
            }}>
              <Upload size={22} color="#a78bfa" style={{ marginBottom: 4 }} />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {fileLoading ? 'در حال پردازش...' : 'بارگذاری فایل خروجی تقویم سامسونگ (.ics)'}
              </span>
              <input
                type="file"
                accept=".ics,text/calendar"
                onChange={handleFileUpload}
                disabled={fileLoading}
                style={{ display: 'none' }}
              />
            </label>

            {/* Direct URL connection for Samsung */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                  یا وارد کردن لینک اشتراک تقویم سامسونگ (در صورت داشتن لینک آنلاین):
                </label>
                <input
                  type="url"
                  className="input"
                  dir="ltr"
                  placeholder="https://..."
                  value={samsungUrl}
                  onChange={(e) => setSamsungUrl(e.target.value)}
                  style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                />
              </div>
              <input
                type="text"
                className="input"
                placeholder="نام تقویم (مثال: تقویم شخصی سامسونگ)"
                value={samsungName}
                onChange={(e) => setSamsungName(e.target.value)}
              />
              <Button
                variant="primary"
                onClick={() => handleConnect({ url: samsungUrl, name: samsungName, provider: 'samsung' })}
                disabled={connecting || !samsungUrl.trim()}
                style={{ background: 'linear-gradient(135deg, #034ea2, #1d4ed8)' }}
              >
                {connecting ? <><Spinner size={16} color="white" /> در حال اتصال...</> : <><CheckCircle2 size={16} /> اتصال تقویم سامسونگ</>}
              </Button>
            </div>
          </div>
        )}

        {/* ── TAB 5: CONNECTED CALENDARS LIST ─────────────────────────── */}
        {activeTab === 'connected' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {calendars.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-secondary)' }}>
                <CalendarIcon size={36} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>هنوز هیچ تقویمی متصل نشده است.</p>
                <p style={{ margin: '6px 0 16px', fontSize: '0.78rem' }}>از تب‌های بالا برای اتصال تقویم گوگل یا اپل استفاده کنید.</p>
                <Button variant="ghost" size="sm" onClick={() => setActiveTab('google')}>
                  رفتن به اتصال Google Calendar
                </Button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    تقویم‌های فعال ({calendars.length})
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSyncAll}
                    disabled={syncingAll}
                    style={{ fontSize: '0.78rem' }}
                  >
                    {syncingAll ? <><Spinner size={14} /> در حال همگام‌سازی...</> : <><RefreshCw size={13} /> همگام‌سازی همه</>}
                  </Button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 300, overflowY: 'auto' }}>
                  {calendars.map((cal) => (
                    <div
                      key={cal.id}
                      className="surface"
                      style={{
                        padding: '12px 14px', borderRadius: 12,
                        borderRight: `4px solid ${cal.color || '#4285F4'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                            {cal.name}
                          </span>
                          <span style={{
                            fontSize: '0.68rem', padding: '1px 8px', borderRadius: 10,
                            background: `${cal.color || '#4285F4'}20`, color: cal.color || '#4285F4', fontWeight: 700,
                          }}>
                            {cal.provider === 'google' ? 'Google Calendar' : (cal.provider === 'apple' ? 'Apple Calendar' : 'iCal')}
                          </span>
                          {cal.isFile && (
                            <span style={{ fontSize: '0.65rem', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', padding: '1px 6px', borderRadius: 6 }}>
                              فایل آفلاین
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                          <span>📅 {cal.eventCount || 0} رویداد</span>
                          {cal.lastSync && (
                            <span>🕒 آخرین همگام‌سازی: {new Date(cal.lastSync).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}</span>
                          )}
                        </div>

                        {cal.error && (
                          <div style={{ fontSize: '0.72rem', color: '#fb7185', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <AlertCircle size={12} />
                            <span>خطا در همگام‌سازی اخیر</span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button
                          onClick={() => handleRemove(cal.id, cal.name)}
                          className="btn btn-icon btn-ghost btn-sm"
                          title="حذف تقویم"
                          style={{ color: '#fb7185', padding: 6 }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
