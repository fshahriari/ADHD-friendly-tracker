import React, { useState, useMemo, useEffect } from 'react';
import {
  ChevronRight, ChevronLeft, Link, RefreshCw, Plus, Trash2,
  Calendar as CalendarIcon, Bell, Clock, MapPin, Settings as SettingsIcon,
  ExternalLink, Globe, Edit3, Check, Tag
} from 'lucide-react';
import { useTaskStore } from '../../store/useTaskStore';
import { useEventStore } from '../../store/useEventStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { fetchAndParseICal } from '../../lib/ical';
import { icalDb, DEFAULT_CATEGORIES } from '../../lib/db';
import ConnectCalendarModal from './ConnectCalendarModal';
import TaskForm from '../tasks/TaskForm';
import {
  getJalaliMonthGrid, jalaliAddMonth, jalaliSubMonth,
  formatJalali, isSameDayJalali, PERSIAN_WEEKDAYS,
  toJalaliString, getJalaliParts,
} from '../../lib/jalali';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { Button, Spinner, toast, Modal, CategoryBadge, CategoryManagerModal } from '../shared';
import { useNavigate } from 'react-router-dom';

const CAT_COLOR = {
  exam: '#f43f5e', assignment: '#f59e0b', habit: '#10b981',
  personal: '#6366f1', lecture: '#0ea5e9',
};

// ── Quick Category Selector Modal ─────────────────────────────────────────
function QuickCategoryModal({ open, onClose, event }) {
  const { updateEvent } = useEventStore();
  const customCategories = useSettingsStore((s) => s.customCategories) || DEFAULT_CATEGORIES;
  const [showCatManager, setShowCatManager] = useState(false);

  if (!event) return null;

  const handleSelect = (catValue, catLabel) => {
    updateEvent(event.id, { category: catValue });
    toast(`دسته‌بندی رویداد به «${catLabel}» تغییر یافت ✨`);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="🏷️ تغییر دسته‌بندی رویداد" maxWidth="440px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: 0 }}>
            دسته‌بندی موردنظر برای رویداد <strong>«{event.title}»</strong>:
          </p>
          <button
            type="button"
            onClick={() => setShowCatManager(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: 'none',
              border: 'none',
              color: 'var(--color-primary-400)',
              fontSize: '0.78rem',
              cursor: 'pointer',
              fontWeight: 600,
              padding: '2px 6px',
            }}
          >
            <SettingsIcon size={12} /> ویرایش دسته‌ها
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
          {customCategories.map((cat) => {
            const isCurrent = (event.category || 'lecture') === cat.value;
            const catColor = cat.color || 'var(--color-primary-500)';
            return (
              <button
                key={cat.value}
                type="button"
                onClick={() => handleSelect(cat.value, cat.label)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: `1.5px solid ${isCurrent ? catColor : 'rgba(100,116,139,0.2)'}`,
                  background: isCurrent ? `${catColor}20` : 'transparent',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: '0.88rem',
                  fontWeight: isCurrent ? 700 : 500,
                  transition: 'all 150ms ease',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '1.1rem' }}>{cat.icon}</span>
                  <span>{cat.label}</span>
                </span>
                {isCurrent && <Check size={16} color={catColor} />}
              </button>
            );
          })}
        </div>

        <CategoryManagerModal
          open={showCatManager}
          onClose={() => setShowCatManager(false)}
        />
      </div>
    </Modal>
  );
}

// ── Edit Event Modal ───────────────────────────────────────────────────────
function EditEventModal({ open, onClose, event }) {
  const { updateEvent } = useEventStore();
  const customCategories = useSettingsStore((s) => s.customCategories) || DEFAULT_CATEGORIES;
  const [showCatManager, setShowCatManager] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('lecture');
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('10:00');
  const [location, setLocation] = useState('');
  const [reminders, setReminders] = useState([1440, 60]);

  useEffect(() => {
    if (event) {
      setTitle(event.title || '');
      setCategory(event.category || 'lecture');
      const d = event.startDate ? new Date(event.startDate) : new Date();
      setDateStr(d.toISOString().split('T')[0]);
      setTimeStr(d.toTimeString().slice(0, 5));
      setLocation(event.location || '');
      setReminders(event.reminders || [1440, 60]);
    }
  }, [event]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim() || !event) return;

    const startDate = new Date(`${dateStr}T${timeStr}:00`).toISOString();
    updateEvent(event.id, {
      title: title.trim(),
      category,
      startDate,
      location,
      reminders,
    });

    toast('اطلاعات و دسته‌بندی رویداد با موفقیت ذخیره شد ✨');
    onClose();
  };

  const toggleReminder = (minutes) => {
    setReminders((prev) =>
      prev.includes(minutes) ? prev.filter((m) => m !== minutes) : [...prev, minutes]
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="✏️ ویرایش رویداد تقویم">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>عنوان رویداد *</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>

        {/* Category selector */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              دسته‌بندی (تغییر دهید)
            </label>
            <button
              type="button"
              onClick={() => setShowCatManager(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                background: 'none',
                border: 'none',
                color: 'var(--color-primary-400)',
                fontSize: '0.78rem',
                cursor: 'pointer',
                fontWeight: 600,
                padding: '2px 6px',
              }}
            >
              <SettingsIcon size={12} /> ویرایش دسته‌ها
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {customCategories.map((c) => {
              const isSelected = category === c.value;
              const catColor = c.color || 'var(--color-primary-500)';
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 14px',
                    borderRadius: 20,
                    border: `1.5px solid ${isSelected ? catColor : 'rgba(100,116,139,0.25)'}`,
                    background: isSelected ? `${catColor}25` : 'transparent',
                    color: isSelected ? catColor : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: '0.82rem',
                    fontWeight: isSelected ? 700 : 500,
                    transition: 'all 150ms ease',
                  }}
                >
                  <span>{c.icon}</span>
                  <span>{c.label}</span>
                </button>
              );
            })}
          </div>
          <CategoryManagerModal
            open={showCatManager}
            onClose={() => setShowCatManager(false)}
            onCategoryAdded={(newVal) => setCategory(newVal)}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>تاریخ رویداد</label>
            <input type="date" className="input" value={dateStr} onChange={(e) => setDateStr(e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>ساعت شروع</label>
            <input type="time" className="input" value={timeStr} onChange={(e) => setTimeStr(e.target.value)} />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>مکان / لینک جلسه</label>
          <input className="input" placeholder="اتاق جلسه، گوگل‌میت، زوم یا محل قرار" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>زمان‌های یادآوری (Push Notification)</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { m: 1440, label: '۱ روز قبل' },
              { m: 120,  label: '۲ ساعت قبل' },
              { m: 60,   label: '۱ ساعت قبل' },
              { m: 15,   label: '۱۵ دقیقه قبل' },
              { m: 0,    label: 'هم‌زمان' },
            ].map(({ m, label }) => {
              const active = reminders.includes(m);
              return (
                <button type="button" key={m} onClick={() => toggleReminder(m)}
                  style={{
                    padding: '6px 12px', borderRadius: 8, border: '1.5px solid',
                    cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: 600,
                    borderColor: active ? 'var(--color-primary-500)' : '#2f2258',
                    background: active ? 'rgba(var(--accent-glow-rgb),0.2)' : 'transparent',
                    color: active ? '#a78bfa' : '#64748b',
                  }}>
                  <Bell size={12} style={{ display: 'inline', marginLeft: 4 }} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <Button variant="primary" type="submit" style={{ marginTop: 6 }}>
          <Check size={16} /> ذخیره تغییرات
        </Button>
      </form>
    </Modal>
  );
}

// ── Add Item to Calendar Modal (Event or Scheduled Task) ────────────────────
function AddEventModal({ open, onClose, defaultDate, initialType = 'event' }) {
  const { addEvent } = useEventStore();
  const { addTask } = useTaskStore();
  const customCategories = useSettingsStore((s) => s.customCategories) || DEFAULT_CATEGORIES;
  const [showCatManager, setShowCatManager] = useState(false);
  const [entryType, setEntryType] = useState(initialType);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(
    initialType === 'task'
      ? (customCategories.find(c => c.value === 'assignment')?.value || customCategories[0]?.value || 'assignment')
      : (customCategories.find(c => c.value === 'lecture')?.value || customCategories[0]?.value || 'lecture')
  );
  const [dateStr, setDateStr] = useState(
    defaultDate ? defaultDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
  );
  const [timeStr, setTimeStr] = useState('10:00');
  const [location, setLocation] = useState('');
  const [reminders, setReminders] = useState([1440, 60]);

  useEffect(() => {
    if (open) {
      setEntryType(initialType);
      setCategory(
        initialType === 'task'
          ? (customCategories.find(c => c.value === 'assignment')?.value || customCategories[0]?.value || 'assignment')
          : (customCategories.find(c => c.value === 'lecture')?.value || customCategories[0]?.value || 'lecture')
      );
      if (defaultDate) {
        setDateStr(defaultDate.toISOString().split('T')[0]);
      }
    }
  }, [open, defaultDate, initialType, customCategories]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) { toast('عنوان الزامی است', 'warning'); return; }

    const isoDate = new Date(`${dateStr}T${timeStr}:00`).toISOString();

    if (entryType === 'task') {
      addTask({
        title: title.trim(),
        category,
        dueDate: isoDate,
        priority: 'medium',
        steps: [],
      });
      toast('وظیفه با موفقیت به تقویم و فهرست کارها افزوده شد ✨');
    } else {
      addEvent({
        title: title.trim(),
        category,
        startDate: isoDate,
        location,
        reminders,
      });
      toast('رویداد با موفقیت به تقویم اضافه شد ✨');
    }

    setTitle('');
    setLocation('');
    onClose();
  };

  const toggleReminder = (minutes) => {
    setReminders((prev) =>
      prev.includes(minutes) ? prev.filter((m) => m !== minutes) : [...prev, minutes]
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="➕ افزودن به تقویم">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Type toggle: Event vs Task */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
          padding: 4,
          background: 'rgba(100,116,139,0.1)',
          borderRadius: 10,
        }}>
          <button
            type="button"
            onClick={() => {
              setEntryType('event');
              setCategory(customCategories.find(c => c.value === 'lecture')?.value || customCategories[0]?.value || 'lecture');
            }}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: '0.84rem',
              fontWeight: 700,
              background: entryType === 'event' ? 'var(--color-primary-500)' : 'transparent',
              color: entryType === 'event' ? '#ffffff' : 'var(--text-secondary)',
              transition: 'all 150ms ease',
            }}
          >
            📅 رویداد / جلسه
          </button>
          <button
            type="button"
            onClick={() => {
              setEntryType('task');
              setCategory(customCategories.find(c => c.value === 'assignment')?.value || customCategories[0]?.value || 'assignment');
            }}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: '0.84rem',
              fontWeight: 700,
              background: entryType === 'task' ? 'var(--color-primary-500)' : 'transparent',
              color: entryType === 'task' ? '#ffffff' : 'var(--text-secondary)',
              transition: 'all 150ms ease',
            }}
          >
            📋 وظیفه زمان‌دار
          </button>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
            {entryType === 'task' ? 'عنوان وظیفه *' : 'عنوان جلسه یا رویداد *'}
          </label>
          <input
            className="input"
            placeholder={entryType === 'task' ? 'مثال: ارسال گزارش پروژه یا پیگیری فاکتور...' : 'مثال: جلسه هفتگی تیم یا ویزیت پزشک...'}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        {/* Category selector with interactive chips */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              دسته‌بندی (انتخاب کنید)
            </label>
            <button
              type="button"
              onClick={() => setShowCatManager(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                background: 'none',
                border: 'none',
                color: 'var(--color-primary-400)',
                fontSize: '0.78rem',
                cursor: 'pointer',
                fontWeight: 600,
                padding: '2px 6px',
              }}
            >
              <SettingsIcon size={12} /> ویرایش دسته‌بندی‌ها
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {customCategories.map((c) => {
              const isSelected = category === c.value;
              const catColor = c.color || 'var(--color-primary-500)';
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 14px',
                    borderRadius: 20,
                    border: `1.5px solid ${isSelected ? catColor : 'rgba(100,116,139,0.25)'}`,
                    background: isSelected ? `${catColor}25` : 'transparent',
                    color: isSelected ? catColor : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: '0.82rem',
                    fontWeight: isSelected ? 700 : 500,
                    transition: 'all 150ms ease',
                  }}
                >
                  <span>{c.icon}</span>
                  <span>{c.label}</span>
                </button>
              );
            })}
          </div>
          <CategoryManagerModal
            open={showCatManager}
            onClose={() => setShowCatManager(false)}
            onCategoryAdded={(newVal) => setCategory(newVal)}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
              {entryType === 'task' ? 'تاریخ ددلاین' : 'تاریخ رویداد'}
            </label>
            <input type="date" className="input" value={dateStr} onChange={(e) => setDateStr(e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
              {entryType === 'task' ? 'ساعت موعد' : 'ساعت شروع'}
            </label>
            <input type="time" className="input" value={timeStr} onChange={(e) => setTimeStr(e.target.value)} />
          </div>
        </div>

        {entryType === 'event' && (
          <>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>مکان / لینک جلسه آنلاین</label>
              <input className="input" placeholder="اتاق جلسه، گوگل‌میت، زوم یا محل قرار" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>زمان‌های یادآوری (Push Notification)</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[
                  { m: 1440, label: '۱ روز قبل' },
                  { m: 120,  label: '۲ ساعت قبل' },
                  { m: 60,   label: '۱ ساعت قبل' },
                  { m: 15,   label: '۱۵ دقیقه قبل' },
                  { m: 0,    label: 'هم‌زمان' },
                ].map(({ m, label }) => {
                  const active = reminders.includes(m);
                  return (
                    <button type="button" key={m} onClick={() => toggleReminder(m)}
                      style={{
                        padding: '6px 12px', borderRadius: 8, border: '1.5px solid',
                        cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: 600,
                        borderColor: active ? 'var(--color-primary-500)' : '#2f2258',
                        background: active ? 'rgba(var(--accent-glow-rgb),0.2)' : 'transparent',
                        color: active ? '#a78bfa' : '#64748b',
                      }}>
                      <Bell size={12} style={{ display: 'inline', marginLeft: 4 }} />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        <Button variant="primary" type="submit" style={{ marginTop: 6 }}>
          <Plus size={16} /> {entryType === 'task' ? 'افزودن وظیفه به تقویم' : 'ایجاد رویداد در تقویم'}
        </Button>
      </form>
    </Modal>
  );
}

// ── Unified Dual-Date Calendar Grid ───────────────────────────────────────
function DualCalendarGrid({ currentDate, tasks, events, onDayClick, selectedDate, isDark, primaryCalendar }) {
  const isJalaliPrimary = primaryCalendar !== 'gregorian';
  const customCategories = useSettingsStore((s) => s.customCategories) || DEFAULT_CATEGORIES;
  const catColorMap = useMemo(() => Object.fromEntries(customCategories.map((c) => [c.value, c.color])), [customCategories]);
  const today = new Date();
  const textMuted = isDark ? '#94a3b8' : '#4c4469';
  const textFaint = isDark ? '#475569' : '#7c6fa0';

  // Compute Grid Days
  let days = [];
  let firstDayOffset = 0;
  let mainTitle = '';
  let subTitle = '';

  if (isJalaliPrimary) {
    const grid = getJalaliMonthGrid(currentDate);
    days = grid.days;
    firstDayOffset = grid.firstDayOffset;
    mainTitle = `${grid.month} ${grid.year}`;
    subTitle = format(currentDate, 'MMMM yyyy');
  } else {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    days = eachDayOfInterval({ start, end });
    firstDayOffset = start.getDay();
    mainTitle = format(currentDate, 'MMMM yyyy');
    const jParts = getJalaliParts(currentDate);
    subTitle = `${formatJalali(currentDate, 'MMMM')} ${jParts.jy}`;
  }

  const getItemsForDay = (day) => {
    const tList = tasks.filter((t) => t.dueDate && isSameDay(new Date(t.dueDate), day));
    const eList = events.filter((e) => e.startDate && isSameDay(new Date(e.startDate), day));
    return { tList, eList };
  };

  return (
    <div>
      {/* Month/Year Titles — Main & Sub Dual Dates */}
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
          {mainTitle}
        </div>
        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: textFaint, marginTop: 1 }}>
          {subTitle}
        </div>
      </div>

      {/* Weekday headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 }}>
        {PERSIAN_WEEKDAYS.map((wd) => (
          <div key={wd} style={{ textAlign: 'center', fontSize: '0.75rem', color: textFaint, fontWeight: 700, padding: '4px 0' }}>
            {wd}
          </div>
        ))}
      </div>

      {/* Grid cells showing BOTH dates */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {Array.from({ length: firstDayOffset }).map((_, i) => <div key={`e${i}`} />)}

        {days.map((day) => {
          const { tList, eList } = getItemsForDay(day);
          const isToday = isSameDay(day, today);
          const isSel = selectedDate && isSameDay(day, selectedDate);

          const primaryNum = isJalaliPrimary ? formatJalali(day, 'd') : format(day, 'd');
          const secondaryNum = isJalaliPrimary ? format(day, 'd') : formatJalali(day, 'd');

          return (
            <button key={day.toISOString()} onClick={() => onDayClick(day)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justify: 'center', gap: 1, padding: '6px 2px', borderRadius: 10, cursor: 'pointer',
                border: `1.5px solid ${isSel ? 'var(--color-primary-500)' : isToday ? 'rgba(var(--accent-glow-rgb),0.5)' : 'transparent'}`,
                background: isSel ? 'rgba(var(--accent-glow-rgb),0.22)' : isToday ? 'rgba(var(--accent-glow-rgb),0.1)' : 'transparent',
                color: isToday ? '#a78bfa' : textMuted,
                fontFamily: 'inherit', transition: 'all 150ms',
              }}>
              {/* Primary Date Number */}
              <span style={{ fontSize: '0.9rem', fontWeight: isToday ? 800 : 600, color: isToday ? 'var(--color-primary-500)' : 'var(--text-primary)' }}>
                {primaryNum}
              </span>

              {/* Secondary Date Number (Alternative) */}
              <span style={{ fontSize: '0.65rem', fontWeight: 500, color: textFaint, marginTop: -2 }}>
                {secondaryNum}
              </span>

              {/* Event & Task indicator dots */}
              <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center', minHeight: 6, marginTop: 2 }}>
                {tList.slice(0, 2).map((t, i) => (
                  <span key={`t${i}`} style={{ width: 4, height: 4, borderRadius: '50%', background: catColorMap[t.category] || CAT_COLOR[t.category] || 'var(--color-primary-500)' }} />
                ))}
                {eList.slice(0, 2).map((e, i) => (
                  <span key={`e${i}`} style={{ width: 4, height: 4, borderRadius: 1, background: '#34d399' }} />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Calendar View ────────────────────────────────────────────────────
export default function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [addType, setAddType] = useState('event');

  const [editingEvent, setEditingEvent] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [quickCategoryEvent, setQuickCategoryEvent] = useState(null);

  const { tasks, addTask } = useTaskStore();
  const { events, loadEvents, deleteEvent } = useEventStore();
  const { theme, calendarPrimary = 'jalali' } = useSettingsStore();
  const isDark = theme === 'dark';
  const navigate = useNavigate();

  useEffect(() => {
    loadEvents();
  }, []);

  const selectedItems = useMemo(() => {
    if (!selectedDate) return { tasks: [], events: [] };
    const tFiltered = tasks.filter((t) => t.dueDate && isSameDay(new Date(t.dueDate), selectedDate));
    const eFiltered = events.filter((e) => e.startDate && isSameDay(new Date(e.startDate), selectedDate));
    return { tasks: tFiltered, events: eFiltered };
  }, [selectedDate, tasks, events]);

  const isJalali = calendarPrimary !== 'gregorian';
  const prevMonth = () => setCurrentDate((d) => isJalali ? jalaliSubMonth(d) : subMonths(d, 1));
  const nextMonth = () => setCurrentDate((d) => isJalali ? jalaliAddMonth(d) : addMonths(d, 1));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 className="section-title" style={{ margin: 0, fontSize: '1.3rem' }}>📅 تقویم یکپارچه دوگانه</h1>
          <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#64748b' }}>
            نمایش همزمان تاریخ شمسی و میلادی · تاریخ اصلی: <strong>{isJalali ? 'شمسی' : 'میلادی'}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="primary" size="sm" onClick={() => { setAddType('event'); setShowAddEvent(true); }}>
            <Plus size={14} /> افزودن به تقویم
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowConnectModal(true)}>
            <Globe size={14} color="#4285F4" /> اتصال تقویم (گوگل / اپل / سامسونگ)
          </Button>
        </div>
      </div>

      {/* Unified Calendar Grid Card */}
      <div className="surface" style={{ padding: 16 }}>
        {/* Navigation bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <button onClick={nextMonth} className="btn btn-icon btn-ghost btn-sm" title="ماه بعدی"><ChevronRight size={18} /></button>
          <button onClick={() => setCurrentDate(new Date())} className="btn btn-ghost btn-sm" style={{ fontSize: '0.8rem', fontWeight: 600 }}>امروز</button>
          <button onClick={prevMonth} className="btn btn-icon btn-ghost btn-sm" title="ماه قبلی"><ChevronLeft size={18} /></button>
        </div>

        {/* Dual Calendar Grid */}
        <DualCalendarGrid
          currentDate={currentDate}
          tasks={tasks}
          events={events}
          onDayClick={setSelectedDate}
          selectedDate={selectedDate}
          isDark={isDark}
          primaryCalendar={calendarPrimary}
        />
      </div>

      {/* Selected Day Details */}
      {selectedDate && (
        <div className="animate-fade-in">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <h3 style={{ fontSize: '0.94rem', fontWeight: 700, color: '#a78bfa', margin: 0 }}>
              رویدادها و وظایف {toJalaliString(selectedDate)} ({format(selectedDate, 'yyyy/MM/dd')})
            </h3>
            <div style={{ display: 'flex', gap: 6 }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setAddType('event'); setShowAddEvent(true); }}
                style={{ fontSize: '0.78rem', padding: '4px 10px' }}
              >
                <Plus size={13} /> رویداد جدید
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setAddType('task'); setShowAddEvent(true); }}
                style={{ fontSize: '0.78rem', padding: '4px 10px' }}
              >
                <Plus size={13} /> وظیفه جدید
              </Button>
            </div>
          </div>

          {selectedItems.tasks.length === 0 && selectedItems.events.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>هیچ رویداد یا وظیفه‌ای برای این روز وجود ندارد.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Events */}
              {selectedItems.events.map((e) => {
                const isGoogle = e.source === 'google';
                const isApple = e.source === 'apple';
                const isSamsung = e.source === 'samsung';
                const isExternal = isGoogle || isApple || isSamsung || e.source === 'moodle' || e.source === 'ical';
                const borderColor = isGoogle ? '#4285F4' : (isApple ? '#94a3b8' : (isSamsung ? '#034ea2' : '#34d399'));

                return (
                  <div
                    key={e.id}
                    className="surface"
                    style={{
                      padding: '12px 16px',
                      borderRight: `4px solid ${borderColor}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ flex: 1, direction: 'rtl', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)', direction: 'rtl', textAlign: 'right' }}>
                            {isGoogle ? '🌐' : isApple ? '🍏' : isSamsung ? '📱' : '📅'} {e.title}
                          </span>

                          {/* Interactive Category Badge */}
                          <CategoryBadge
                            category={e.category || 'lecture'}
                            onClick={() => setQuickCategoryEvent(e)}
                            style={{ cursor: 'pointer' }}
                            title="کلیک برای تغییر دسته‌بندی"
                          />

                          {isGoogle && (
                            <span style={{ fontSize: '0.68rem', background: isDark ? 'rgba(66,133,244,0.15)' : 'rgba(37,99,235,0.12)', color: isDark ? '#60a5fa' : '#1d4ed8', padding: '1px 8px', borderRadius: 20, fontWeight: 700 }}>
                              Google Calendar
                            </span>
                          )}
                          {isApple && (
                            <span style={{ fontSize: '0.68rem', background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(100,116,139,0.15)', color: isDark ? '#e2e8f0' : '#334155', padding: '1px 8px', borderRadius: 20, fontWeight: 700 }}>
                              Apple Calendar
                            </span>
                          )}
                          {isSamsung && (
                            <span style={{ fontSize: '0.68rem', background: isDark ? 'rgba(3,78,162,0.2)' : 'rgba(3,78,162,0.12)', color: isDark ? '#93c5fd' : '#034ea2', padding: '1px 8px', borderRadius: 20, fontWeight: 700 }}>
                              Samsung Calendar
                            </span>
                          )}
                          {e.calendarName && !isGoogle && !isApple && !isSamsung && (
                            <span style={{ fontSize: '0.68rem', background: 'rgba(var(--accent-glow-rgb),0.12)', color: 'var(--color-primary-400)', padding: '1px 8px', borderRadius: 20 }}>
                              {e.calendarName}
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 14 }}>
                          <span>
                            <Clock size={12} style={{ display: 'inline', marginLeft: 4 }} />
                            {e.isAllDay ? 'تمام روز' : (
                              <>
                                {new Date(e.startDate).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                                {e.endDate && ` تا ${new Date(e.endDate).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}`}
                              </>
                            )}
                          </span>
                          {e.location && (
                            <span>
                              <MapPin size={12} style={{ display: 'inline', marginLeft: 4 }} />
                              {e.location}
                            </span>
                          )}
                        </div>

                        {e.description && (
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '6px 0 0', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                            {e.description.slice(0, 160)}{e.description.length > 160 ? '...' : ''}
                          </p>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button
                          onClick={() => setQuickCategoryEvent(e)}
                          className="btn btn-icon btn-ghost btn-sm"
                          title="تغییر دسته‌بندی"
                          style={{ color: 'var(--color-primary-400)' }}
                        >
                          <Tag size={14} />
                        </button>
                        {!isExternal && (
                          <button
                            onClick={() => setEditingEvent(e)}
                            className="btn btn-icon btn-ghost btn-sm"
                            title="ویرایش رویداد"
                          >
                            <Edit3 size={14} />
                          </button>
                        )}
                        {!isExternal && (
                          <button
                            onClick={() => deleteEvent(e.id)}
                            className="btn btn-icon btn-ghost btn-sm"
                            style={{ color: '#fb7185' }}
                            title="حذف"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Action buttons: Join online meeting & Convert to Task */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 6, borderTop: '1px solid rgba(var(--accent-glow-rgb),0.08)' }}>
                      {e.meetingUrl && (
                        <a
                          href={e.meetingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-sm btn-ghost"
                          style={{ fontSize: '0.75rem', textDecoration: 'none', color: '#60a5fa', borderColor: 'rgba(96,165,250,0.3)', padding: '4px 10px', minHeight: 30 }}
                        >
                          <ExternalLink size={12} /> ورود به جلسه آنلاین
                        </a>
                      )}
                      <button
                        onClick={() => {
                          addTask({
                            title: e.title,
                            description: e.description || e.location || '',
                            dueDate: e.startDate,
                            category: e.category || 'personal',
                            priority: 'medium',
                          });
                          toast('رویداد به لیست وظایف افزوده شد 📋');
                        }}
                        className="btn btn-sm btn-ghost"
                        style={{ fontSize: '0.75rem', padding: '4px 10px', minHeight: 30 }}
                      >
                        <Plus size={12} /> تبدیل به وظیفه
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Tasks */}
              {selectedItems.tasks.map((t) => (
                <div
                  key={t.id}
                  className="surface"
                  style={{
                    padding: '12px 14px',
                    borderRight: `3px solid ${CAT_COLOR[t.category] || 'var(--color-primary-500)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0, direction: 'rtl', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', direction: 'rtl', textAlign: 'right' }}>📋 {t.title}</span>
                      <CategoryBadge
                        category={t.category}
                        onClick={() => setEditingTask(t)}
                        style={{ cursor: 'pointer' }}
                        title="کلیک برای تغییر دسته‌بندی و ویرایش"
                      />
                    </div>
                    {t.estimatedMinutes && (
                      <span style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 4, display: 'inline-block' }}>
                        🕐 {t.estimatedMinutes} دقیقه
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <button
                      onClick={() => setEditingTask(t)}
                      className="btn btn-icon btn-ghost btn-sm"
                      title="ویرایش وظیفه و تغییر دسته‌بندی"
                    >
                      <Edit3 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Manual Add Modal (Event or Task) */}
      <AddEventModal
        open={showAddEvent}
        onClose={() => setShowAddEvent(false)}
        defaultDate={selectedDate}
        initialType={addType}
      />

      {/* Edit Event modal */}
      <EditEventModal
        open={Boolean(editingEvent)}
        onClose={() => setEditingEvent(null)}
        event={editingEvent}
      />

      {/* Quick Category Selector modal */}
      <QuickCategoryModal
        open={Boolean(quickCategoryEvent)}
        onClose={() => setQuickCategoryEvent(null)}
        event={quickCategoryEvent}
      />

      {/* Edit Task form */}
      <TaskForm
        open={Boolean(editingTask)}
        onClose={() => setEditingTask(null)}
        initial={editingTask}
      />

      {/* Connect Calendar modal (Google, Apple, Samsung, ICS) */}
      <ConnectCalendarModal
        open={showConnectModal}
        onClose={() => setShowConnectModal(false)}
        onSyncComplete={() => { loadEvents(); }}
      />
    </div>
  );
}
