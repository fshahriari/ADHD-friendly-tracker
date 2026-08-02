import React, { useState, useMemo, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Link, RefreshCw, Plus, Trash2, Calendar as CalendarIcon, Bell, Clock, MapPin } from 'lucide-react';
import { useTaskStore } from '../../store/useTaskStore';
import { useEventStore } from '../../store/useEventStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { fetchAndParseICal } from '../../lib/ical';
import { icalDb } from '../../lib/db';
import {
  getJalaliMonthGrid, jalaliAddMonth, jalaliSubMonth,
  formatJalali, isSameDayJalali, PERSIAN_WEEKDAYS,
  toJalaliString,
} from '../../lib/jalali';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { Button, Spinner, toast, Modal } from '../shared';

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
  const [reminders, setReminders] = useState([1440, 60]); // Default 1 day and 1 hour before

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
          <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: 6 }}>عنوان رویداد *</label>
          <input className="input" placeholder="مثال: کلاس ریاضی ۲ یا جلسه پروژه..."
            value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: 6 }}>تاریخ رویداد</label>
            <input type="date" className="input" value={dateStr} onChange={(e) => setDateStr(e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: 6 }}>ساعت شروع</label>
            <input type="time" className="input" value={timeStr} onChange={(e) => setTimeStr(e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: 6 }}>دسته‌بندی</label>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="lecture">کلاس / درس</option>
              <option value="exam">امتحان / کوییز</option>
              <option value="assignment">ددلاین پروژه</option>
              <option value="personal">شخصی / رویداد</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: 6 }}>مکان / کلاس</label>
            <input className="input" placeholder="کلاس ۱۰۲ یا آنلاین" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
        </div>

        {/* Reminder offsets */}
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: 6 }}>زمان‌های یادآوری (Push Notification)</label>
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
                    borderColor: active ? '#8b5cf6' : '#2f2258',
                    background: active ? 'rgba(139,92,246,0.2)' : 'transparent',
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
          <span style={{ flex: 1, fontSize: '0.8rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'ltr', textAlign: 'left' }}>{url}</span>
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

// ── Jalali Calendar Grid ──────────────────────────────────────────────────
function JalaliGrid({ currentDate, tasks, events, onDayClick, selectedDate, isDark }) {
  const { days, firstDayOffset, month, year } = getJalaliMonthGrid(currentDate);
  const today = new Date();
  const textMuted = isDark ? '#94a3b8' : '#4c4469';
  const textFaint = isDark ? '#475569' : '#7c6fa0';

  const getItemsForDay = (day) => {
    const tList = tasks.filter((t) => t.dueDate && isSameDayJalali(new Date(t.dueDate), day));
    const eList = events.filter((e) => e.startDate && isSameDayJalali(new Date(e.startDate), day));
    return { tList, eList };
  };

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <span style={{ fontWeight: 700, fontSize: '1rem', color: isDark ? '#e2e8f0' : '#1e1b4b' }}>{month} {year}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 }}>
        {PERSIAN_WEEKDAYS.map((wd) => (
          <div key={wd} style={{ textAlign: 'center', fontSize: '0.72rem', color: textFaint, fontWeight: 700, padding: '4px 0' }}>
            {wd}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {Array.from({ length: firstDayOffset }).map((_, i) => <div key={`e${i}`} />)}

        {days.map((day) => {
          const { tList, eList } = getItemsForDay(day);
          const isToday = isSameDayJalali(day, today);
          const isSel = selectedDate && isSameDayJalali(day, selectedDate);
          const totalCount = tList.length + eList.length;

          return (
            <button key={day.toISOString()} onClick={() => onDayClick(day)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 2, padding: '8px 4px', borderRadius: 8, cursor: 'pointer',
                border: `1.5px solid ${isSel ? '#8b5cf6' : isToday ? 'rgba(139,92,246,0.4)' : 'transparent'}`,
                background: isSel ? 'rgba(139,92,246,0.2)' : isToday ? 'rgba(139,92,246,0.08)' : 'transparent',
                color: isToday ? '#a78bfa' : textMuted,
                fontFamily: 'inherit', transition: 'all 150ms',
              }}>
              <span style={{ fontSize: '0.85rem', fontWeight: isToday ? 700 : 500 }}>
                {formatJalali(day, 'd')}
              </span>
              <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center', minHeight: 6 }}>
                {tList.slice(0, 2).map((t, i) => (
                  <span key={`t${i}`} style={{ width: 5, height: 5, borderRadius: '50%', background: CAT_COLOR[t.category] || '#8b5cf6' }} />
                ))}
                {eList.slice(0, 2).map((e, i) => (
                  <span key={`e${i}`} style={{ width: 5, height: 5, borderRadius: 1, background: '#34d399' }} />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Gregorian Calendar Grid ───────────────────────────────────────────────
function GregorianGrid({ currentDate, tasks, events, onDayClick, selectedDate, isDark }) {
  const start = startOfMonth(currentDate);
  const end = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start, end });
  const today = new Date();
  const firstDayOffset = start.getDay();
  const textMuted = isDark ? '#94a3b8' : '#4c4469';
  const textFaint = isDark ? '#475569' : '#7c6fa0';

  const getItemsForDay = (day) => {
    const tList = tasks.filter((t) => t.dueDate && isSameDay(new Date(t.dueDate), day));
    const eList = events.filter((e) => e.startDate && isSameDay(new Date(e.startDate), day));
    return { tList, eList };
  };

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <span style={{ fontWeight: 700, fontSize: '1rem', color: isDark ? '#e2e8f0' : '#1e1b4b' }}>
          {format(currentDate, 'MMMM yyyy')}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 }}>
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: '0.72rem', color: textFaint, fontWeight: 700 }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {Array.from({ length: firstDayOffset }).map((_, i) => <div key={`e${i}`} />)}
        {days.map((day) => {
          const { tList, eList } = getItemsForDay(day);
          const isToday = isSameDay(day, today);
          const isSel = selectedDate && isSameDay(day, selectedDate);
          return (
            <button key={day.toISOString()} onClick={() => onDayClick(day)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                padding: '8px 4px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                border: `1.5px solid ${isSel ? '#8b5cf6' : isToday ? 'rgba(139,92,246,0.4)' : 'transparent'}`,
                background: isSel ? 'rgba(139,92,246,0.2)' : isToday ? 'rgba(139,92,246,0.08)' : 'transparent',
                color: isToday ? '#a78bfa' : textMuted, transition: 'all 150ms',
              }}>
              <span style={{ fontSize: '0.85rem', fontWeight: isToday ? 700 : 500 }}>{format(day, 'd')}</span>
              <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center', minHeight: 6 }}>
                {tList.slice(0, 2).map((t, i) => (
                  <span key={`t${i}`} style={{ width: 5, height: 5, borderRadius: '50%', background: CAT_COLOR[t.category] || '#8b5cf6' }} />
                ))}
                {eList.slice(0, 2).map((e, i) => (
                  <span key={`e${i}`} style={{ width: 5, height: 5, borderRadius: 1, background: '#34d399' }} />
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
  const [mode, setMode] = useState('jalali');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  const [showIcal, setShowIcal] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);

  const { tasks } = useTaskStore();
  const { events, loadEvents, deleteEvent } = useEventStore();
  const { theme } = useSettingsStore();
  const isDark = theme === 'dark';

  useEffect(() => {
    loadEvents();
  }, []);

  const selectedItems = useMemo(() => {
    if (!selectedDate) return { tasks: [], events: [] };
    const tFiltered = tasks.filter((t) => t.dueDate && (mode === 'jalali' ? isSameDayJalali(new Date(t.dueDate), selectedDate) : isSameDay(new Date(t.dueDate), selectedDate)));
    const eFiltered = events.filter((e) => e.startDate && (mode === 'jalali' ? isSameDayJalali(new Date(e.startDate), selectedDate) : isSameDay(new Date(e.startDate), selectedDate)));
    return { tasks: tFiltered, events: eFiltered };
  }, [selectedDate, tasks, events, mode]);

  const prevMonth = () => setCurrentDate((d) => mode === 'jalali' ? jalaliSubMonth(d) : subMonths(d, 1));
  const nextMonth = () => setCurrentDate((d) => mode === 'jalali' ? jalaliAddMonth(d) : addMonths(d, 1));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <h1 className="section-title" style={{ margin: 0, fontSize: '1.3rem' }}>📅 تقویم و رویدادها</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="primary" size="sm" onClick={() => setShowAddEvent(true)}>
            <Plus size={14} /> افزودن رویداد
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowIcal(true)}>
            <Link size={14} /> مودل iCal
          </Button>
        </div>
      </div>

      {/* Mode toggle — theme-aware */}
      <div className="date-toggle-container" style={{
        display: 'flex',
        background: isDark ? '#0f0a1e' : '#e4dcfc',
        borderRadius: 10, padding: 4, gap: 4, width: 'fit-content',
        border: `1px solid ${isDark ? '#1a1130' : 'rgba(109,40,217,0.2)'}`,
      }}>
        {[{ v: 'jalali', l: 'شمسی' }, { v: 'gregorian', l: 'میلادی' }].map((m) => (
          <button key={m.v} onClick={() => setMode(m.v)}
            className={`date-toggle-btn${mode === m.v ? ' active' : ''}`}
            style={{
              padding: '7px 18px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
              border: 'none', fontWeight: 700, fontSize: '0.85rem', transition: 'all 150ms',
              background: mode === m.v
                ? (isDark ? 'rgba(139,92,246,0.35)' : '#6d28d9')
                : 'transparent',
              color: mode === m.v
                ? (isDark ? '#a78bfa' : '#ffffff')
                : (isDark ? '#64748b' : '#4c4469'),
            }}>
            {m.l}
          </button>
        ))}
      </div>

      {/* Calendar grid card */}
      <div className="surface" style={{ padding: 16 }}>
        {/* Nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <button onClick={nextMonth} className="btn btn-icon btn-ghost btn-sm"><ChevronRight size={18} /></button>
          <button onClick={() => setCurrentDate(new Date())} className="btn btn-ghost btn-sm" style={{ fontSize: '0.78rem' }}>امروز</button>
          <button onClick={prevMonth} className="btn btn-icon btn-ghost btn-sm"><ChevronLeft size={18} /></button>
        </div>

        {mode === 'jalali'
          ? <JalaliGrid currentDate={currentDate} tasks={tasks} events={events} onDayClick={setSelectedDate} selectedDate={selectedDate} isDark={isDark} />
          : <GregorianGrid currentDate={currentDate} tasks={tasks} events={events} onDayClick={setSelectedDate} selectedDate={selectedDate} isDark={isDark} />
        }
      </div>

      {/* Selected day items */}
      {selectedDate && (
        <div className="animate-fade-in">
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#94a3b8', marginBottom: 10 }}>
            رویدادهای {mode === 'jalali' ? toJalaliString(selectedDate) : format(selectedDate, 'MMM dd, yyyy')}
          </h3>

          {selectedItems.tasks.length === 0 && selectedItems.events.length === 0 ? (
            <p style={{ color: '#475569', fontSize: '0.85rem', margin: 0 }}>هیچ رویداد یا تکلیفی برای این روز وجود ندارد.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Events */}
              {selectedItems.events.map((e) => (
                <div key={e.id} className="surface" style={{ padding: '10px 14px', borderRight: '3px solid #34d399', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#e2e8f0' }}>📅 {e.title}</span>
                      <span style={{ fontSize: '0.72rem', background: 'rgba(52,211,153,0.15)', color: '#34d399', padding: '2px 8px', borderRadius: 20 }}>
                        رویداد تقویم
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 4, display: 'flex', gap: 12 }}>
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
                <div key={t.id} className="surface" style={{ padding: '10px 14px', borderRight: `3px solid ${CAT_COLOR[t.category] || '#8b5cf6'}` }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#e2e8f0', flex: 1 }}>📋 {t.title}</span>
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
