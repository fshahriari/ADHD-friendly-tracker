import React, { useEffect } from 'react';
import { useTaskStore } from '../store/useTaskStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useTimerStore, TIMER_STATES } from '../store/useTimerStore';
import TaskList from '../components/tasks/TaskList';
import { Button } from '../components/shared';
import { useNavigate } from 'react-router-dom';
import { formatJalali, toJalaliString } from '../lib/jalali';
import { format } from 'date-fns';
import { Zap, Focus, Brain } from 'lucide-react';
import { autoScheduleDay } from '../lib/gemini';
import { toast } from '../components/shared';

const ENERGY_OPTS = [
  { v: 'high',   label: 'انرژی بالا',  icon: '⚡', desc: 'آماده برای کارهای سخت' },
  { v: 'medium', label: 'متوسط',        icon: '🔆', desc: 'کارهای معمولی' },
  { v: 'low',    label: 'کم‌انرژی',     icon: '🌙', desc: 'کارهای آسان و ساده' },
];

function EnergySelector() {
  const { energyLevel, setEnergyLevel } = useSettingsStore();
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      {ENERGY_OPTS.map((o) => (
        <button key={o.v} onClick={() => setEnergyLevel(o.v)}
          style={{
            flex: 1, minWidth: 90, padding: '12px 8px', borderRadius: 12, border: '1.5px solid',
            cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center', transition: 'all 150ms',
            background: energyLevel === o.v ? 'rgba(var(--accent-glow-rgb), 0.25)' : 'transparent',
            borderColor: energyLevel === o.v ? 'var(--color-primary-500)' : '#2f2258',
            color: energyLevel === o.v ? 'var(--text-primary)' : 'var(--text-muted)',
            boxShadow: energyLevel === o.v ? '0 2px 10px rgba(var(--accent-glow-rgb),0.2)' : 'none',
          }}>
          <div style={{ fontSize: '1.4rem', marginBottom: 4 }}>{o.icon}</div>
          <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>{o.label}</div>
          <div style={{ fontSize: '0.68rem', marginTop: 2, color: 'var(--text-muted)' }}>{o.desc}</div>
        </button>
      ))}
    </div>
  );
}

function StatsBar({ tasks }) {
  const total     = tasks.length;
  const done      = tasks.filter((t) => t.completed).length;
  const overdue   = tasks.filter((t) => !t.completed && t.dueDate && new Date(t.dueDate) < new Date()).length;
  const today     = tasks.filter((t) => !t.completed && t.dueDate && new Date(t.dueDate).toDateString() === new Date().toDateString()).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
      {[
        { label: 'کل', value: total, color: 'var(--color-primary-500)' },
        { label: 'تمام‌شده', value: done, color: '#34d399' },
        { label: 'امروز', value: today, color: '#f59e0b' },
        { label: '% پیشرفت', value: `${pct}%`, color: '#0ea5e9' },
      ].map((s) => (
        <div key={s.label} className="surface" style={{ padding: '14px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: s.color }}>{s.value}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 3 }}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { tasks, loadTasks, getHighestPriorityTask, updateTask } = useTaskStore();
  const { energyLevel, calendarPrimary = 'jalali' } = useSettingsStore();

  // Dual date display
  const now = new Date();
  const jalaliDate = toJalaliString(now);
  const gregorianDate = format(now, 'yyyy/MM/dd');
  const jalaliLong = formatJalali(now, 'EEEE، dd MMMM yyyy');
  const gregLong = format(now, 'EEEE، MMMM dd yyyy');
  const primaryDate   = calendarPrimary === 'jalali' ? jalaliLong   : gregLong;
  const secondaryDate = calendarPrimary === 'jalali' ? gregorianDate : jalaliDate;
  const { startFocus, state: timerState } = useTimerStore();
  const navigate = useNavigate();
  const [scheduling, setScheduling] = React.useState(false);

  useEffect(() => { loadTasks(); }, []);

  const topTask = getHighestPriorityTask();
  const incomplete = tasks.filter((t) => !t.completed);

  const handleAutoSchedule = async () => {
    if (!incomplete.length) { toast('وظیفه‌ای برای زمان‌بندی وجود ندارد', 'warning'); return; }
    setScheduling(true);
    try {
      const schedule = await autoScheduleDay(incomplete, energyLevel);
      schedule.forEach(({ taskId, scheduledTime }) => {
        if (taskId) updateTask(taskId, { scheduledTime });
      });
      toast(`${schedule.length} وظیفه زمان‌بندی شد ✨`);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setScheduling(false);
    }
  };


  return (
    <div className="page">
      {/* Greeting */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: '0 0 6px', fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', background: 'linear-gradient(135deg, #a78bfa, #34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          سلام! 👋
        </h1>
        {/* Primary date — larger */}
        <p style={{ margin: '0 0 3px', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          {primaryDate}
        </p>
        {/* Secondary date — smaller, muted */}
        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', direction: 'ltr', textAlign: 'right' }}>
          {secondaryDate}
        </p>
      </div>

      {/* Energy selector */}
      <section style={{ marginBottom: 20 }}>
        <h2 className="section-title">⚡ امروز چقدر انرژی داری؟</h2>
        <EnergySelector />
      </section>

      {/* Stats */}
      <section style={{ marginBottom: 20 }}>
        <StatsBar tasks={tasks} />
      </section>

      {/* Focus now hero */}
      {topTask && timerState === TIMER_STATES.IDLE && (
        <div className="surface-glass animate-slide-up" style={{ padding: '16px 20px', marginBottom: 20, borderColor: 'rgba(var(--accent-glow-rgb),0.3)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-primary-500)', fontWeight: 700, marginBottom: 6 }}>🎯 مهم‌ترین وظیفه الان</div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>{topTask.title}</div>
          <Button variant="primary" onClick={() => { startFocus(topTask.id, topTask.estimatedMinutes); navigate('/focus'); }}>
            <Focus size={16} /> شروع تمرکز
          </Button>
        </div>
      )}

      {/* AI Auto-schedule */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Button variant="ai" size="sm" onClick={handleAutoSchedule} disabled={scheduling}>
          {scheduling ? '⏳ در حال زمان‌بندی...' : <><Zap size={14} /> زمان‌بندی خودکار روز</>}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => navigate('/brain-dump')}>
          <Brain size={14} /> تخلیه ذهن
        </Button>
      </div>

      {/* Task list */}
      <section>
        <h2 className="section-title">📋 وظایف</h2>
        <TaskList />
      </section>
    </div>
  );
}
