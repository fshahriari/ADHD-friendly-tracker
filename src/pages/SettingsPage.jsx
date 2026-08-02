import React, { useState } from 'react';
import { useSettingsStore } from '../store/useSettingsStore';
import { useEventStore } from '../store/useEventStore';

import { Button, toast } from '../components/shared';
import { timerLogDb, taskDb, eventsDb, coachRulesDb, settingsDb, icalDb } from '../lib/db';
import { callGemini } from '../lib/gemini';
import { Save, Moon, Sun, Palette, Server, Shield, Brain, Plus, Trash2, CheckCircle2, Download, Upload } from 'lucide-react';

function Section({ title, icon, children }) {
  return (
    <section style={{ marginBottom: 24 }}>
      <h2 className="section-title">{icon} {title}</h2>
      <div className="surface" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {children}
      </div>
    </section>
  );
}

function Row({ label, desc, children }) {
  const isDark = useSettingsStore((s) => s.theme) === 'dark';
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
        {desc && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>{desc}</div>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ value, onChange }) {
  return (
    <button onClick={() => onChange(!value)}
      style={{
        width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
        background: value ? 'linear-gradient(135deg, #6d28d9, #8b5cf6)' : '#1a1130',
        position: 'relative', transition: 'background 250ms', flexShrink: 0,
        boxShadow: value ? '0 0 10px rgba(var(--accent-glow-rgb),0.4)' : 'none',
      }}>
      <span style={{
        position: 'absolute', top: 3, left: value ? 25 : 3,
        width: 20, height: 20, borderRadius: '50%', background: 'white',
        transition: 'left 250ms', boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
      }} />
    </button>
  );
}

const ACCENT_COLORS = [
  { id: 'violet', label: 'بنفش تمرکز', color: '#8b5cf6' },
  { id: 'emerald', label: 'زمردی دوپامین', color: '#10b981' },
  { id: 'cyan', label: 'آبی اقیانوس', color: '#0ea5e9' },
  { id: 'rose', label: 'رز انرژی', color: '#f43f5e' },
  { id: 'amber', label: 'کهربایی آرام', color: '#f59e0b' },
];

import { useAuthStore } from '../store/useAuthStore';
import { LogOut } from 'lucide-react';

export default function SettingsPage() {
  const settings = useSettingsStore();
  const { coachRules, addCoachRule, deleteCoachRule } = useEventStore();
  const { user, isAdmin, logout } = useAuthStore();

  const [supaUrl, setSupaUrl]       = useState(settings.supabaseUrl || '');
  const [supaKey, setSupaKey]       = useState(settings.supabaseAnonKey || '');
  const [proxyUrl, setProxyUrl]     = useState(settings.geminiProxyUrl || '');
  const [backupUrl, setBackupUrl]   = useState(settings.backupGeminiProxyUrl || '');
  const [directKey, setDirectKey]   = useState(settings.directGeminiApiKey || '');
  const [aiProvider, setAiProvider] = useState(settings.aiProvider || 'gemini');
  const [useCustomKeys, setUseCustomKeys] = useState(settings.useCustomKeys || false);

  const [focus, setFocus]           = useState(settings.focusDuration || 25);
  const [shortBreak, setShortBreak] = useState(settings.shortBreak || 5);
  const [longBreak, setLongBreak]   = useState(settings.longBreak || 15);

  const [newRuleText, setNewRuleText] = useState('');
  const [testingAi, setTestingAi]     = useState(false);

  const save = () => {
    settings.update({
      supabaseUrl: supaUrl,
      supabaseAnonKey: supaKey,
      geminiProxyUrl: proxyUrl,
      backupGeminiProxyUrl: backupUrl,
      directGeminiApiKey: directKey,
      aiProvider,
      useCustomKeys,
      focusDuration: focus,
      shortBreak,
      longBreak,
    });
    toast('تنظیمات ذخیره شد ✅');
  };

  const handleExport = () => {
    const data = {
      settings: settingsDb.get(),
      tasks: taskDb.getAll(),
      events: eventsDb.getAll(),
      timerLogs: timerLogDb.getAll(),
      coachRules: coachRulesDb.getAll(),
      icalEvents: icalDb.getAll(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `adhd_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('فایل پشتیبان دانلود شد 💾');
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.settings) settingsDb.save(data.settings);
        if (data.tasks) taskDb.saveAll(data.tasks);
        if (data.events) eventsDb.saveAll(data.events);
        if (data.timerLogs) timerLogDb.saveAll(data.timerLogs);
        if (data.coachRules) coachRulesDb.saveAll(data.coachRules);
        if (data.icalEvents) icalDb.saveAll(data.icalEvents);
        
        toast('اطلاعات با موفقیت بازیابی شد! در حال بارگذاری مجدد... ✅');
        setTimeout(() => window.location.reload(), 1500);
      } catch (err) {
        toast('خطا در خواندن فایل پشتیبان ❌', { icon: '⚠️' });
      }
    };
    reader.readAsText(file);
  };

  const handleTestAi = async () => {
    setTestingAi(true);
    try {
      // Save current state first to test
      settings.update({ geminiProxyUrl: proxyUrl, backupGeminiProxyUrl: backupUrl, directGeminiApiKey: directKey });
      const res = await callGemini('سلام، آیا سرور هوش مصنوعی وصل است؟', 'تست سریع. فقط پاسخ بده: بله وصل است.');
      toast(`پاسخ هوش مصنوعی: ${res.trim()} ✨`);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setTestingAi(false);
    }
  };

  const handleAddRule = (e) => {
    e.preventDefault();
    if (!newRuleText.trim()) return;
    addCoachRule(newRuleText);
    setNewRuleText('');
    toast('قانون جدید اضافه شد ✨');
  };

  const isDark = settings.theme === 'dark';

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
          ⚙️ تنظیمات
        </h1>
        <Button variant="ghost" size="sm" onClick={logout} style={{ color: '#ef4444' }}>
          <LogOut size={16} /> خروج از حساب
        </Button>
      </div>

      {/* Appearance & Theme Accent */}
      <Section title="ظاهر و رنگ تم" icon="🎨">
        <Row label="حالت تاریک / روشن" desc="تغییر تم دیداری برنامه">
          <button onClick={settings.toggleTheme}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 10, border: '1px solid #2f2258', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', color: isDark ? '#94a3b8' : '#4c4469', fontSize: '0.85rem', fontWeight: 600 }}>
            {settings.theme === 'dark' ? <><Sun size={15} /> حالت روشن</> : <><Moon size={15} /> حالت تاریک</>}
          </button>
        </Row>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>رنگ اصلی تم (Accent Theme)</label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {ACCENT_COLORS.map((c) => {
              const isSel = (settings.accentColor || 'violet') === c.id;
              return (
                <button key={c.id} onClick={() => settings.setAccentColor(c.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 10,
                    border: `2px solid ${isSel ? c.color : (isDark ? 'transparent' : 'rgba(var(--accent-glow-rgb),0.15)')}`,
                    background: isSel ? (isDark ? 'rgba(var(--accent-glow-rgb),0.25)' : '#ffffff') : (isDark ? 'rgba(15,10,30,0.4)' : '#ffffff'),
                    boxShadow: isSel ? `0 2px 10px ${c.color}50` : 'none',
                    cursor: 'pointer', fontFamily: 'inherit',
                    color: isDark ? '#e2e8f0' : '#1e1b4b',
                    fontSize: '0.85rem', fontWeight: 700,
                  }}>
                  <span style={{ width: 14, height: 14, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
      </Section>

      {/* Date Primary Toggle (Theme-Aware) */}
      <Section title="نمایش تاریخ" icon="📅">
        <Row label="تاریخ اصلی" desc="کدام تقویم به صورت اصلی (بزرگ‌تر) نشان داده شود؟">
          <div className="date-toggle-container" style={{ display: 'flex', background: '#0f0a1e', borderRadius: 10, padding: 4, gap: 4, border: '1px solid #1a1130' }}>
            {[{ v: 'jalali', l: 'شمسی' }, { v: 'gregorian', l: 'میلادی' }].map((o) => {
              const active = (settings.calendarPrimary || 'jalali') === o.v;
              return (
                <button key={o.v}
                  className={`date-toggle-btn${active ? ' active' : ''}`}
                  onClick={() => settings.update({ calendarPrimary: o.v })}
                  style={{
                    padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontFamily: 'inherit', fontWeight: 700, fontSize: '0.85rem', transition: 'all 150ms',
                    background: active ? 'var(--accent-color)' : 'transparent',
                    color: active ? '#ffffff' : 'var(--text-secondary)',
                  }}>{o.l}</button>
              );
            })}
          </div>
        </Row>
      </Section>

      <Section title="حافظه و قوانین دستیار ADHD" icon="🧠">
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
          دستیار هوش مصنوعی هنگام بررسی متن شما، این قوانین را به عنوان ترجیح شما در نظر می‌گیرد و یادآوری‌ها را بر این اساس تنظیم می‌کند.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {coachRules.map((rule) => (
            <div key={rule.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(var(--accent-glow-rgb),0.1)', borderRadius: 10, border: '1px solid rgba(var(--accent-glow-rgb),0.2)' }}>
              <span style={{ fontSize: '0.83rem', color: 'var(--text-primary)' }}>📌 {rule.rule}</span>
              <button onClick={() => deleteCoachRule(rule.id)} className="btn btn-icon btn-ghost btn-sm" style={{ color: '#fb7185' }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={handleAddRule} style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input className="input" placeholder="مثال: یادآوری امتحانات همیشه ۳ روز قبل تنظیم بشه..."
            value={newRuleText} onChange={(e) => setNewRuleText(e.target.value)} />
          <Button variant="secondary" size="sm" type="submit">
            <Plus size={14} /> افزودن
          </Button>
        </form>
      </Section>

      {/* Multi-Proxy & AI Resilience */}
      <Section title="تنظیمات هوش مصنوعی" icon="🤖">
        <div style={{ padding: '10px 14px', background: 'rgba(14,165,233,0.08)', borderRadius: 10, border: '1px solid rgba(14,165,233,0.2)', marginBottom: 12 }}>
          <p style={{ margin: 0, fontSize: '0.8rem', color: isDark ? '#7dd3fc' : '#0369a1', lineHeight: 1.6 }}>
            انتخاب ارائه‌دهنده و کلیدهای هوش مصنوعی. در صورت استفاده از کلیدهای دیفالت سیستم، هیچ نیازی به تنظیم این بخش نیست.
          </p>
        </div>

        {!isAdmin && (
          <Row label="استفاده از کلید شخصی" desc="اگر می‌خواهید از کلید API اختصاصی خودتان استفاده کنید، این گزینه را روشن کنید">
            <input type="checkbox" checked={useCustomKeys} onChange={(e) => {
              setUseCustomKeys(e.target.checked);
              settings.update({ useCustomKeys: e.target.checked });
            }} />
          </Row>
        )}

        {(isAdmin || useCustomKeys) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>نوع API</label>
              <select className="input" value={aiProvider} onChange={(e) => {
                setAiProvider(e.target.value);
                settings.update({ aiProvider: e.target.value });
              }} style={{ width: '100%' }}>
                <option value="gemini">Gemini (پروکسی Cloudflare)</option>
                <option value="openai">OpenAI Compatible (سرویس‌های واسط ایرانی)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                {aiProvider === 'openai' ? 'آدرس Base URL سرویس واسط' : 'آدرس پروکسی اصلی (Cloudflare Worker)'}
              </label>
              <input className="input" placeholder="https://..." dir="ltr"
                value={proxyUrl} onChange={(e) => setProxyUrl(e.target.value)} onBlur={save} />
            </div>

            {aiProvider === 'gemini' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>آدرس پروکسی پشتیبان</label>
                <input className="input" placeholder="https://..." dir="ltr"
                  value={backupUrl} onChange={(e) => setBackupUrl(e.target.value)} onBlur={save} />
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>کلید API (API Key)</label>
              <input className="input" placeholder="sk-..." dir="ltr" type="password"
                value={directKey} onChange={(e) => setDirectKey(e.target.value)} onBlur={save} />
            </div>
          </div>
        )}

        <Button variant="ghost" size="sm" onClick={handleTestAi} disabled={testingAi} style={{ width: 'fit-content', marginTop: 12 }}>
          {testingAi ? '⏳ در حال تست اتصال...' : <><CheckCircle2 size={14} /> تست اتصال هوش مصنوعی</>}
        </Button>
      </Section>

      {/* Timer Config */}
      <Section title="تنظیمات تایمر تمرکز" icon="⏱">
        {[
          { label: 'مدت تمرکز (دقیقه)', value: focus, set: setFocus, min: 5, max: 90 },
          { label: 'استراحت کوتاه (دقیقه)', value: shortBreak, set: setShortBreak, min: 1, max: 15 },
          { label: 'استراحت طولانی (دقیقه)', value: longBreak, set: setLongBreak, min: 10, max: 30 },
        ].map((f) => (
          <Row key={f.label} label={f.label}>
            <input type="number" min={f.min} max={f.max} value={f.value}
              onChange={(e) => f.set(parseInt(e.target.value) || f.min)}
              onBlur={save}
              className="input" style={{ width: 80, textAlign: 'center' }} />
          </Row>
        ))}
      </Section>

      {/* Supabase Config (Admin only for now, since we migrate to PocketBase) */}
      {isAdmin && (
        <Section title="پایگاه داده ابری (درحال مهاجرت)" icon="☁️">
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>Supabase URL</label>
            <input className="input" placeholder="https://xxx.supabase.co" dir="ltr"
              value={supaUrl} onChange={(e) => setSupaUrl(e.target.value)} onBlur={save} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>Supabase Anon Key</label>
            <input className="input" placeholder="eyJhbGciOiJI..." dir="ltr" type="password"
              value={supaKey} onChange={(e) => setSupaKey(e.target.value)} onBlur={save} />
          </div>
        </Section>
      )}

      {/* Backup & Restore */}
      <Section title="پشتیبان‌گیری آفلاین" icon="💾">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            تمام اطلاعات شما به صورت لوکال ذخیره می‌شود. می‌توانید از آن‌ها خروجی بگیرید و یا فایل قبلی را وارد کنید.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Button variant="outline" size="sm" onClick={handleExport} style={{ display: 'flex', gap: 8 }}>
              <Download size={16} /> خروجی گرفتن (Export JSON)
            </Button>
            <label>
              <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
              <Button variant="outline" size="sm" as="span" style={{ display: 'flex', gap: 8, cursor: 'pointer' }}>
                <Upload size={16} /> بازیابی اطلاعات (Import JSON)
              </Button>
            </label>
          </div>
        </div>
      </Section>

      {/* Save */}
      <Button variant="primary" size="lg" onClick={save} style={{ width: '100%', marginBottom: 24 }}>
        <Save size={18} /> ذخیره تنظیمات
      </Button>

      <div style={{ textAlign: 'center', padding: '4px 0 8px' }}>
        <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-primary-500)', margin: '0 0 4px' }}>
          ساخته شده با ❤️ برای ADHD‌های خفن
        </p>
        <p style={{ fontSize: '0.72rem', color: '#64748b', margin: 0 }}>
          توسط <strong style={{ color: '#a78bfa' }}>فاژی</strong> · ردیاب ADHD نسخه ۱.۰
        </p>
      </div>
    </div>
  );
}
