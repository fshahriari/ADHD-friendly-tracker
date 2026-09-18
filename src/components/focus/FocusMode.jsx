import React, { useEffect, useRef } from 'react';
import { Play, Pause, Square, Coffee, SkipForward } from 'lucide-react';
import { useTimerStore, TIMER_STATES } from '../../store/useTimerStore';
import { useTaskStore } from '../../store/useTaskStore';
import { useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { keepScreenAwake, releaseScreenAwake, hapticNotification, hapticImpact } from '../../lib/capacitor';

import { useSettingsStore } from '../../store/useSettingsStore';

// ── SVG Timer Ring ────────────────────────────────────────────────────────
function TimerRing({ progress, displayTime, state, sessionCount }) {
  const { theme } = useSettingsStore();
  const isDark = theme === 'dark';

  const R = 100;
  const cx = 130;
  const cy = 130;
  const circumference = 2 * Math.PI * R;
  const offset = circumference * (1 - progress);

  const colors = {
    [TIMER_STATES.RUNNING]: 'var(--color-primary-500)',
    [TIMER_STATES.PAUSED]:  '#f59e0b',
    [TIMER_STATES.BREAK]:   '#34d399',
    [TIMER_STATES.DONE]:    '#34d399',
    [TIMER_STATES.IDLE]:    isDark ? '#2f2258' : '#6d28d9',
  };
  const strokeColor = colors[state] || 'var(--color-primary-500)';

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={260} height={260} viewBox="0 0 260 260" aria-label={`تایمر: ${displayTime}`}>
        {/* Glow filter */}
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Track */}
        <circle cx={cx} cy={cy} r={R} className="progress-ring-track" strokeWidth={14} />

        {/* Fill */}
        {progress > 0 && (
          <circle cx={cx} cy={cy} r={R}
            fill="none"
            stroke={strokeColor}
            strokeWidth={14}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transformOrigin: 'center', transform: 'rotate(-90deg)', transition: 'stroke-dashoffset 1s linear, stroke 400ms ease', filter: 'url(#glow)' }}
          />
        )}

        {/* Dot at progress end */}
        {progress > 0 && progress < 1 && (
          <circle
            cx={cx + R * Math.cos(-Math.PI / 2 + 2 * Math.PI * progress)}
            cy={cy + R * Math.sin(-Math.PI / 2 + 2 * Math.PI * progress)}
            r={7} fill={strokeColor} style={{ filter: 'url(#glow)' }}
          />
        )}
      </svg>

      {/* Center content */}
      <div style={{ position: 'absolute', textAlign: 'center' }}>
        {state === TIMER_STATES.DONE ? (
          <div className="animate-bounce-in">
            <div style={{ fontSize: '3rem' }}>🎉</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#34d399' }}>آفرین!</div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: '3rem', fontWeight: 800, color: isDark ? '#e2e8f0' : '#1e1b4b', fontVariantNumeric: 'tabular-nums', letterSpacing: '-2px' }}>
              {displayTime}
            </div>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: isDark ? '#94a3b8' : '#4c4469', marginTop: 2 }}>
              {state === TIMER_STATES.IDLE   && 'آماده شروع'}
              {state === TIMER_STATES.RUNNING && '🔥 در حال تمرکز'}
              {state === TIMER_STATES.PAUSED  && '⏸ مکث شده'}
              {state === TIMER_STATES.BREAK   && '☕ استراحت'}
            </div>
            {sessionCount > 0 && (
              <div style={{ fontSize: '0.72rem', color: isDark ? '#64748b' : '#5b4fa0', marginTop: 4 }}>
                {'🍅'.repeat(Math.min(sessionCount, 8))} {sessionCount} جلسه
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Focus Mode ────────────────────────────────────────────────────────────
export default function FocusMode() {
  const {
    state, focusTaskId, startFocus, pause, resume, stop, startBreak,
    getProgress, getDisplayTime, sessionCount,
  } = useTimerStore();
  const { tasks, toggleComplete, getHighestPriorityTask } = useTaskStore();
  const navigate = useNavigate();
  const didFireConfetti = useRef(false);

  const task = focusTaskId ? tasks.find((t) => t.id === focusTaskId) : getHighestPriorityTask();

  // Keep screen awake during focus sessions
  useEffect(() => {
    if (state === TIMER_STATES.RUNNING) {
      keepScreenAwake();
    } else {
      releaseScreenAwake();
    }
    return () => releaseScreenAwake();
  }, [state]);

  // Fire confetti + haptic on DONE
  useEffect(() => {
    if (state === TIMER_STATES.DONE && !didFireConfetti.current) {
      didFireConfetti.current = true;
      hapticNotification('SUCCESS');
      confetti({
        particleCount: 120, spread: 80, origin: { y: 0.6 },
        colors: ['var(--color-primary-500)', '#34d399', '#fbbf24', '#fb7185', '#6366f1'],
      });
      setTimeout(() => confetti({ particleCount: 60, angle: 60, spread: 55, origin: { x: 0 } }), 200);
      setTimeout(() => confetti({ particleCount: 60, angle: 120, spread: 55, origin: { x: 1 } }), 400);
    }
    if (state !== TIMER_STATES.DONE) didFireConfetti.current = false;
  }, [state]);

  const handleStart = () => {
    if (task) {
      hapticImpact('Medium');
      startFocus(task.id, task.estimatedMinutes || 25);
    }
  };

  const handleMarkDone = () => {
    if (task) { toggleComplete(task.id); stop(); }
  };

  const CAT_LABELS = { exam: 'مهم / ددلاین', assignment: 'کاری / پروژه', habit: 'عادت', personal: 'شخصی', lecture: 'جلسه / رویداد' };
  const DURATION_OPTIONS = [5, 10, 15, 25, 30, 45, 50];

  return (
    <div style={{
      minHeight: '85dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 28, padding: '24px 16px',
      background: 'radial-gradient(ellipse at center, rgba(var(--accent-glow-rgb),0.08) 0%, transparent 70%)',
    }}>
      {/* Task info */}
      {task ? (
        <div className="surface-glass animate-fade-in" style={{ padding: '16px 24px', textAlign: 'center', maxWidth: 420, width: '100%' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 6 }}>
            {CAT_LABELS[task.category] || ''} · اولویت {task.priority === 'high' ? '🔴 بالا' : task.priority === 'medium' ? '🟡 متوسط' : '⚪ پایین'}
          </div>
          <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#e2e8f0', lineHeight: 1.4 }}>
            {task.title}
          </h2>
          {task.description && (
            <p style={{ margin: '8px 0 0', fontSize: '0.82rem', color: '#64748b' }}>{task.description}</p>
          )}
        </div>
      ) : (
        <div className="surface-glass animate-fade-in" style={{ padding: '20px 28px', textAlign: 'center' }}>
          <p style={{ color: '#64748b', margin: 0 }}>هیچ وظیفه‌ای برای تمرکز وجود ندارد.</p>
        </div>
      )}

      {/* Timer Ring */}
      <TimerRing
        progress={getProgress()}
        displayTime={getDisplayTime()}
        state={state}
        sessionCount={sessionCount}
      />

      {/* Duration selector (only when idle) */}
      {state === TIMER_STATES.IDLE && (
        <div className="animate-fade-in" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {DURATION_OPTIONS.map((d) => (
            <button key={d} onClick={() => task && startFocus(task.id, d)}
              className="btn btn-ghost btn-sm" style={{ fontSize: '0.8rem', minWidth: 52 }}>
              {d}د
            </button>
          ))}
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        {state === TIMER_STATES.IDLE && (
          <button onClick={handleStart} disabled={!task}
            className="btn btn-primary btn-lg" style={{ gap: 10 }}>
            <Play size={20} /> شروع تمرکز
          </button>
        )}

        {state === TIMER_STATES.RUNNING && (
          <>
            <button onClick={pause} className="btn btn-ghost btn-lg" style={{ gap: 10 }}>
              <Pause size={20} /> مکث
            </button>
            <button onClick={stop} className="btn btn-ghost" style={{ color: '#64748b' }}>
              <Square size={16} />
            </button>
          </>
        )}

        {state === TIMER_STATES.PAUSED && (
          <>
            <button onClick={resume} className="btn btn-primary btn-lg" style={{ gap: 10 }}>
              <Play size={20} /> ادامه
            </button>
            <button onClick={stop} className="btn btn-ghost" style={{ color: '#64748b' }}>
              <Square size={16} />
            </button>
          </>
        )}

        {state === TIMER_STATES.DONE && (
          <>
            <button onClick={handleMarkDone} className="btn btn-accent btn-lg" style={{ gap: 10 }}>
              ✅ وظیفه تمام شد!
            </button>
            <button onClick={() => startFocus(task?.id, task?.estimatedMinutes || 25)}
              className="btn btn-ghost btn-lg" style={{ gap: 8 }}>
              <SkipForward size={16} /> دور بعدی
            </button>
            <button onClick={() => startBreak(5)} className="btn btn-ghost" style={{ gap: 8, color: '#34d399' }}>
              <Coffee size={16} /> استراحت ۵ دقیقه
            </button>
          </>
        )}

        {state === TIMER_STATES.BREAK && (
          <button onClick={stop} className="btn btn-primary btn-lg">
            ⏭ پایان استراحت
          </button>
        )}
      </div>

      {/* Tips for ADHD */}
      {state === TIMER_STATES.IDLE && (
        <div className="animate-fade-in" style={{ maxWidth: 380, textAlign: 'center' }}>
          <p style={{ fontSize: '0.8rem', color: '#334155', lineHeight: 1.7, margin: 0 }}>
            💡 <strong style={{ color: '#64748b' }}>نکته:</strong> فقط روی این یک وظیفه تمرکز کن.
            اگر ایده‌ای آمد، سریع در تخلیه ذهن بنویس و برگرد.
          </p>
        </div>
      )}

      {/* Back button */}
      <button onClick={() => navigate(-1)} className="btn btn-ghost btn-sm" style={{ color: '#334155' }}>
        ← بازگشت
      </button>
    </div>
  );
}
