// ── LocalStorage-backed DB (offline fallback) ────────────────────────────
// All operations are synchronous with LocalStorage and async-compatible
// for easy swap with Supabase when online.

const KEYS = {
  TASKS: 'adhd_tasks',
  SETTINGS: 'adhd_settings',
  TIMER_LOG: 'adhd_timer_log',
  BRAIN_DUMPS: 'adhd_brain_dumps',
  ICAL_EVENTS: 'adhd_ical_events',
  CONNECTED_CALENDARS: 'adhd_connected_calendars',
  EVENTS: 'adhd_events',
  COACH_RULES: 'adhd_coach_rules',
};

// Generic helpers
const read = (key, fallback = []) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const write = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch {
    console.warn('[db] LocalStorage write failed for key:', key);
    return false;
  }
};

// ── Tasks ────────────────────────────────────────────────────────────────
export const taskDb = {
  getAll: () => read(KEYS.TASKS, []),

  save: (task) => {
    const tasks = read(KEYS.TASKS, []);
    const idx = tasks.findIndex((t) => t.id === task.id);
    if (idx >= 0) {
      tasks[idx] = { ...tasks[idx], ...task, updatedAt: new Date().toISOString() };
    } else {
      tasks.push({ ...task, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    write(KEYS.TASKS, tasks);
    return task;
  },

  delete: (id) => {
    const tasks = read(KEYS.TASKS, []).filter((t) => t.id !== id);
    write(KEYS.TASKS, tasks);
  },

  reorder: (orderedIds) => {
    const tasks = read(KEYS.TASKS, []);
    const map = Object.fromEntries(tasks.map((t) => [t.id, t]));
    const reordered = orderedIds.map((id, idx) => ({ ...map[id], order: idx })).filter(Boolean);
    write(KEYS.TASKS, reordered);
  },

  saveAll: (tasks) => write(KEYS.TASKS, tasks),
};

// ── Calendar Non-Task Events ─────────────────────────────────────────────
export const eventsDb = {
  getAll: () => read(KEYS.EVENTS, []),

  save: (event) => {
    const events = read(KEYS.EVENTS, []);
    const idx = events.findIndex((e) => e.id === event.id);
    if (idx >= 0) {
      events[idx] = { ...events[idx], ...event, updatedAt: new Date().toISOString() };
    } else {
      events.push({ ...event, id: event.id || crypto.randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    write(KEYS.EVENTS, events);
    return event;
  },

  delete: (id) => {
    const events = read(KEYS.EVENTS, []).filter((e) => e.id !== id);
    write(KEYS.EVENTS, events);
  },

  saveAll: (events) => write(KEYS.EVENTS, events),
};

// ── ADHD Coach Rules (User Preferences / AI Memory) ─────────────────────
export const coachRulesDb = {
  getAll: () => read(KEYS.COACH_RULES, [
    { id: '1', rule: 'برای تکالیف دانشگاه همیشه ۲۴ ساعت و ۱ ساعت قبل ددلاین یادآوری بگذار.' },
    { id: '2', rule: 'کلاس‌های درس را به صورت ایونت در تقویم ثبت کن.' },
  ]),

  save: (ruleText) => {
    const rules = coachRulesDb.getAll();
    const newRule = { id: crypto.randomUUID(), rule: ruleText, createdAt: new Date().toISOString() };
    rules.push(newRule);
    write(KEYS.COACH_RULES, rules);
    return newRule;
  },

  delete: (id) => {
    const rules = coachRulesDb.getAll().filter((r) => r.id !== id);
    write(KEYS.COACH_RULES, rules);
  },
};

// ── Timer Log (time blindness training) ──────────────────────────────────
export const timerLogDb = {
  getAll: () => read(KEYS.TIMER_LOG, []),

  add: (log) => {
    const logs = read(KEYS.TIMER_LOG, []);
    logs.push({ ...log, loggedAt: new Date().toISOString() });
    write(KEYS.TIMER_LOG, logs);
  },

  getAverageAccuracy: (taskCategory) => {
    const logs = read(KEYS.TIMER_LOG, []).filter(
      (l) => !taskCategory || l.category === taskCategory
    );
    if (!logs.length) return 1;
    const ratios = logs.map((l) => l.actualMinutes / Math.max(l.estimatedMinutes, 1));
    return ratios.reduce((a, b) => a + b, 0) / ratios.length;
  },
};

// ── Brain Dumps ──────────────────────────────────────────────────────────
export const brainDumpDb = {
  getAll: () => read(KEYS.BRAIN_DUMPS, []),

  add: (dump) => {
    const dumps = read(KEYS.BRAIN_DUMPS, []);
    dumps.unshift({ ...dump, id: crypto.randomUUID(), savedAt: new Date().toISOString() });
    if (dumps.length > 100) dumps.splice(100);
    write(KEYS.BRAIN_DUMPS, dumps);
  },

  delete: (id) => {
    const dumps = read(KEYS.BRAIN_DUMPS, []).filter((d) => d.id !== id);
    write(KEYS.BRAIN_DUMPS, dumps);
  },
};

// ── iCal Events ──────────────────────────────────────────────────────────
export const icalDb = {
  getAll: () => read(KEYS.ICAL_EVENTS, []),

  saveAll: (events) => write(KEYS.ICAL_EVENTS, events),

  getLastSync: () => {
    const events = read(KEYS.ICAL_EVENTS, []);
    return events[0]?.syncedAt || null;
  },
};

// ── Connected External Calendars (Google, Apple, Moodle) ─────────────────
export const connectedCalendarsDb = {
  getAll: () => read(KEYS.CONNECTED_CALENDARS, []),

  saveAll: (calendars) => write(KEYS.CONNECTED_CALENDARS, calendars),

  add: (cal) => {
    const list = read(KEYS.CONNECTED_CALENDARS, []);
    const filtered = list.filter((c) => c.id !== cal.id && c.url !== cal.url);
    filtered.push(cal);
    write(KEYS.CONNECTED_CALENDARS, filtered);
  },

  update: (id, partial) => {
    const list = read(KEYS.CONNECTED_CALENDARS, []);
    const updated = list.map((c) => (c.id === id ? { ...c, ...partial } : c));
    write(KEYS.CONNECTED_CALENDARS, updated);
  },

  remove: (id) => {
    const list = read(KEYS.CONNECTED_CALENDARS, []);
    write(KEYS.CONNECTED_CALENDARS, list.filter((c) => c.id !== id && c.url !== id));
  },
};

// ── Settings ─────────────────────────────────────────────────────────────
export const settingsDb = {
  get: () => read(KEYS.SETTINGS, {
    theme: 'dark',
    accentColor: 'violet', // 'violet' | 'emerald' | 'cyan' | 'rose' | 'amber'
    energyLevel: 'medium',
    calendarMode: 'jalali',
    calendarPrimary: 'jalali',
    icalUrls: [],
    geminiProxyUrl: 'https://api.groq.com/openai',
    backupGeminiProxyUrl: '',
    directGeminiApiKey: '',
    aiProvider: 'openai',
    openaiModel: 'llama-3.3-70b-versatile',
    supabaseUrl: '',
    supabaseAnonKey: '',
    notifications: true,
    soundEnabled: true,
    focusDuration: 25,
    shortBreak: 5,
    longBreak: 15,
    language: 'fa',
  }),

  save: (partial) => {
    const current = settingsDb.get();
    write(KEYS.SETTINGS, { ...current, ...partial });
  },
};
