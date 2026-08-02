import { create } from 'zustand';
import { timerLogDb } from '../lib/db';
import { playFocusStart, playBreak, playTick, playComplete } from '../lib/audio';

export const TIMER_STATES = { IDLE: 'idle', RUNNING: 'running', PAUSED: 'paused', BREAK: 'break', DONE: 'done' };

export const useTimerStore = create((set, get) => ({
  state: TIMER_STATES.IDLE,
  focusTaskId: null,
  totalSeconds: 25 * 60,
  remainingSeconds: 25 * 60,
  intervalRef: null,
  sessionStartedAt: null,
  sessionCount: 0,     // how many focus sessions completed today
  breakSeconds: 5 * 60,

  // ── Start focus session ───────────────────────────────────────────
  startFocus: (taskId, durationMinutes = 25) => {
    const { intervalRef } = get();
    if (intervalRef) clearInterval(intervalRef);

    const totalSeconds = durationMinutes * 60;
    const settings = JSON.parse(localStorage.getItem('adhd_settings') || '{}');
    if (settings.soundEnabled !== false) playFocusStart();

    const ref = setInterval(() => {
      const { remainingSeconds, state } = get();
      if (state !== TIMER_STATES.RUNNING) return;
      if (remainingSeconds <= 1) {
        clearInterval(get().intervalRef);
        get()._onSessionComplete();
      } else {
        // Tick every minute for audio feedback
        if ((remainingSeconds - 1) % 60 === 0) {
          if (settings.soundEnabled !== false) playTick();
        }
        set({ remainingSeconds: remainingSeconds - 1 });
      }
    }, 1000);

    set({
      state: TIMER_STATES.RUNNING,
      focusTaskId: taskId,
      totalSeconds,
      remainingSeconds: totalSeconds,
      intervalRef: ref,
      sessionStartedAt: new Date().toISOString(),
    });
  },

  pause: () => {
    const { intervalRef, state } = get();
    if (state !== TIMER_STATES.RUNNING) return;
    clearInterval(intervalRef);
    set({ state: TIMER_STATES.PAUSED, intervalRef: null });
  },

  resume: () => {
    const { state, remainingSeconds, focusTaskId, totalSeconds } = get();
    if (state !== TIMER_STATES.PAUSED) return;
    const settings = JSON.parse(localStorage.getItem('adhd_settings') || '{}');

    const ref = setInterval(() => {
      const { remainingSeconds: rem, state: s } = get();
      if (s !== TIMER_STATES.RUNNING) return;
      if (rem <= 1) {
        clearInterval(get().intervalRef);
        get()._onSessionComplete();
      } else {
        set({ remainingSeconds: rem - 1 });
      }
    }, 1000);

    set({ state: TIMER_STATES.RUNNING, intervalRef: ref });
  },

  stop: () => {
    const { intervalRef } = get();
    if (intervalRef) clearInterval(intervalRef);
    set({ state: TIMER_STATES.IDLE, remainingSeconds: get().totalSeconds, intervalRef: null, sessionStartedAt: null });
  },

  startBreak: (minutes = 5) => {
    const { intervalRef } = get();
    if (intervalRef) clearInterval(intervalRef);
    const settings = JSON.parse(localStorage.getItem('adhd_settings') || '{}');
    if (settings.soundEnabled !== false) playBreak();

    const breakSeconds = minutes * 60;
    const ref = setInterval(() => {
      const { remainingSeconds, state } = get();
      if (state !== TIMER_STATES.BREAK) return;
      if (remainingSeconds <= 1) {
        clearInterval(get().intervalRef);
        set({ state: TIMER_STATES.IDLE, remainingSeconds: get().totalSeconds, intervalRef: null });
      } else {
        set({ remainingSeconds: remainingSeconds - 1 });
      }
    }, 1000);

    set({ state: TIMER_STATES.BREAK, remainingSeconds: breakSeconds, totalSeconds: breakSeconds, intervalRef: ref });
  },

  // ── Internal: session complete ────────────────────────────────────
  _onSessionComplete: () => {
    const { focusTaskId, sessionStartedAt, sessionCount } = get();
    const settings = JSON.parse(localStorage.getItem('adhd_settings') || '{}');
    if (settings.soundEnabled !== false) playComplete();

    // Log actual duration for time-blindness tracking
    if (focusTaskId && sessionStartedAt) {
      const tasks = JSON.parse(localStorage.getItem('adhd_tasks') || '[]');
      const task = tasks.find((t) => t.id === focusTaskId);
      if (task) {
        const actualMinutes = Math.round((Date.now() - new Date(sessionStartedAt).getTime()) / 60000);
        timerLogDb.addEntry({
          taskId: focusTaskId,
          category: task.category,
          estimatedMinutes: task.estimatedMinutes || 25,
          actualMinutes,
        });
      }
    }

    set({
      state: TIMER_STATES.DONE,
      remainingSeconds: 0,
      intervalRef: null,
      sessionCount: sessionCount + 1,
    });
  },

  // ── Getters ───────────────────────────────────────────────────────
  getProgress: () => {
    const { totalSeconds, remainingSeconds } = get();
    if (totalSeconds === 0) return 0;
    return (totalSeconds - remainingSeconds) / totalSeconds;
  },

  getDisplayTime: () => {
    const { remainingSeconds } = get();
    const m = Math.floor(remainingSeconds / 60).toString().padStart(2, '0');
    const s = (remainingSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  },
}));
