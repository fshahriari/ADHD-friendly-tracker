import React, { useState, useMemo, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Link, RefreshCw, Plus, Trash2, Calendar as CalendarIcon, Bell, Clock, MapPin, Settings as SettingsIcon } from 'lucide-react';
import { useTaskStore } from '../../store/useTaskStore';
import { useEventStore } from '../../store/useEventStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { fetchAndParseICal } from '../../lib/ical';
import { icalDb } from '../../lib/db';
import {
  getJalaliMonthGrid, jalaliAddMonth, jalaliSubMonth,
  formatJalali, isSameDayJalali, PERSIAN_WEEKDAYS,
  toJalaliString, getJalaliParts,
} from '../../lib/jalali';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { Button, Spinner, toast, Modal } from '../shared';
import { useNavigate } from 'react-router-dom';

const CAT_COLOR = {
  exam: '#f43f5e', assignment: '#f59e0b', habit: '#10b981',
  personal: '#6366f1', lecture: '#0ea5e9',
};

// ── Add Manual Event Modal ────────────────────────────────────────────────
function AddEventModal({ open, onClose, defaultDate }) {
  const { addEvent } = useEventStore();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('lecture');
  const [dateStr, setDateStr] = useState(defaultDate ? defaultDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
  const [timeStr, setTimeStr] = useState('10:00');
  const [location, setLocation] = useState('');
  const [reminders, setReminders] = useState([1440, 60]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) { toast('عنوان رویداد الزامی است', 'warning'); return; }

    const startDate = new Date(`${dateStr}T${timeStr}:00`).toISOString();
    addEvent({
      title: title.trim(),
      category,
      startDate,
      location,
      reminders,
    });

    toast('رویداد به تقویم اضافه شد ✨');
    setTitle('');
    onClose();
  };

  const toggleReminder = (minutes) => {
    setReminders((prev) =>
      prev.includes(minutes) ? prev.filter((m) => m !== minutes) : [...prev, minutes]
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="➕ افزودن رویداد / کلاس / یادآوری به تقویم">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>عنوان رویداد *</label>
          <input className="input" placeholder="مثال: کلاس ریاضی ۲ یا جلسه پروژه..."
            value={title} onChange={(e) => setTitle(e.target.value)} required />
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>دسته‌بندی</label>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="lecture">کلاس / درس</option>
              <option value="exam">امتحان / کوییز</option>
              <option value="assignment">ددلاین پروژه</option>
              <option value="personal">شخصی / رویداد</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>مکان / کلاس</label>
            <input className="input" placeholder="کلاس ۱۰۲ یا آنلاین" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
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
          <Plus size={16} /> ایجاد رویداد
        </Button>
      </form>
    </Modal>
  );
}

// ── iCal Import Panel ─────────────────────────────────────────────────────
function ICalPanel({ onSync }) {
  const { icalUrls, addIcalUrl, removeIcalUrl } = useSettingsStore();
  const { importFromICal } = useTaskStore();
  const [newUrl, setNewUrl] = useState('');
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    if (!icalUrls.length) { toast('هیچ لینک iCal اضافه نشده', 'warning'); return; }
    setSyncing(true);
    let total = 0;
    for (const url of icalUrls) {
      try {
        const events = await fetchAndParseICal(url);
        icalDb.saveAll(events);
        importFromICal(events);
        total += events.length;
      } catch (err) {
        toast(`خطا در بارگذاری: ${url.slice(0, 40)}...`, 'error');
      }
    }
    toast(`${total} رویداد همگام‌سازی شد ✅`);
    setSyncing(false);
    onSync?.();
  };

  const handleAdd = () => {
    if (!newUrl.includes('.ics')) { toast('لینک باید با .ics ختم شود', 'warning'); return; }
    addIcalUrl(newUrl.trim());
    setNewUrl('');
    toast('لینک اضافه شد');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input className="input" placeholder="https://moodle.../calendar.ics"
          value={newUrl} onChange={(e) => setNewUrl(e.target.value)}
          style={{ flex: 1 }} dir="ltr" />
        <Button variant="ghost" onClick={handleAdd}><Plus size={16} /></Button>
      </div>

      {icalUrls.map((url, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(15,10,30,0.4)', borderRadius: 8, border: '1px solid #1a1130' }}>
          <Link size={13} color="#64748b" style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: '0.8rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'ltr', textAlign: 'left' }}>{url}</span>
          <button className="btn btn-icon btn-sm btn-ghost" onClick={() => removeIcalUrl(url)} style={{ color: '#64748b' }}>
            <Trash2 size={13} />
          </button>
        </div>
      ))}

      <Button variant="primary" onClick={handleSync} disabled={syncing || !icalUrls.length}>
        {syncing ? <><Spinner size={16} color="white" /> در حال همگام‌سازی...</> : <><RefreshCw size={15} /> همگام‌سازی اکنون</>}
      </Button>
    </div>
  );
}

// ── Unified Dual-Date Calendar Grid ───────────────────────────────────────
function DualCalendarGrid({ currentDate, tasks, events, onDayClick, selectedDate, isDark, primaryCalendar }) {
  const isJalaliPrimary = primaryCalendar !== 'gregorian';
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
                  <span key={`t${i}`} style={{ width: 4, height: 4, borderRadius: '50%', background: CAT_COLOR[t.category] || 'var(--color-primary-500)' }} />
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

  const [showIcal, setShowIcal] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);

  const { tasks } = useTaskStore();
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
          <Button variant="primary" size="sm" onClick={() => setShowAddEvent(true)}>
            <Plus size={14} /> افزودن رویداد
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowIcal(true)}>
            <Link size={14} /> مودل iCal
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#a78bfa', margin: 0 }}>
              رویدادهای {toJalaliString(selectedDate)} ({format(selectedDate, 'yyyy/MM/dd')})
            </h3>
          </div>

          {selectedItems.tasks.length === 0 && selectedItems.events.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>هیچ رویداد یا تکلیفی برای این روز وجود ندارد.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Events */}
              {selectedItems.events.map((e) => (
                <div key={e.id} className="surface" style={{ padding: '10px 14px', borderRight: '3px solid #34d399', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>📅 {e.title}</span>
                      <span style={{ fontSize: '0.72rem', background: 'rgba(52,211,153,0.15)', color: '#34d399', padding: '2px 8px', borderRadius: 20 }}>
                        رویداد تقویم
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4, display: 'flex', gap: 12 }}>
                      <span><Clock size={12} /> {new Date(e.startDate).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}</span>
                      {e.location && <span><MapPin size={12} /> {e.location}</span>}
                    </div>
                  </div>
                  <button onClick={() => deleteEvent(e.id)} className="btn btn-icon btn-ghost btn-sm" style={{ color: '#fb7185' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              {/* Tasks */}
              {selectedItems.tasks.map((t) => (
                <div key={t.id} className="surface" style={{ padding: '10px 14px', borderRight: `3px solid ${CAT_COLOR[t.category] || 'var(--color-primary-500)'}` }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', flex: 1 }}>📋 {t.title}</span>
                    <span style={{ fontSize: '0.72rem', background: `${CAT_COLOR[t.category]}20`, color: CAT_COLOR[t.category], padding: '2px 8px', borderRadius: 20 }}>
                      {t.category}
                    </span>
                  </div>
                  {t.estimatedMinutes && <span style={{ fontSize: '0.75rem', color: '#64748b' }}>🕐 {t.estimatedMinutes} دقیقه</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Manual Add Event modal */}
      <AddEventModal open={showAddEvent} onClose={() => setShowAddEvent(false)} defaultDate={selectedDate} />

      {/* iCal modal */}
      <Modal open={showIcal} onClose={() => setShowIcal(false)} title="📥 وارد کردن تقویم مودل (iCal)">
        <ICalPanel onSync={() => { setShowIcal(false); }} />
      </Modal>
    </div>
  );
}
