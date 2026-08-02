import { create } from 'zustand';
import { taskDb } from '../lib/db';
import { pbTasks } from '../lib/api';
import { playAdd, playComplete } from '../lib/audio';

const CATEGORIES = ['exam', 'assignment', 'habit', 'personal', 'lecture'];
const PRIORITIES  = ['high', 'medium', 'low'];
const ENERGIES    = ['high', 'medium', 'low'];

const createTask = (data) => ({
  id: crypto.randomUUID(),
  title: '',
  description: '',
  category: 'personal',
  priority: 'medium',
  energyRequired: 'medium',
  estimatedMinutes: 25,
  completed: false,
  completedAt: null,
  dueDate: null,
  scheduledTime: null,
  steps: [],       // micro-steps from AI decomposer
  order: Date.now(),
  source: 'manual',
  ...data,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export const useTaskStore = create((set, get) => ({
  tasks: [],
  isLoading: false,
  energyFilter: null,  // null | 'high' | 'medium' | 'low'
  categoryFilter: null,
  searchQuery: '',

  // ── Load ─────────────────────────────────────────────────────────────
  loadTasks: () => {
    const tasks = taskDb.getAll().sort((a, b) => a.order - b.order);
    set({ tasks });
  },

  // ── CRUD ─────────────────────────────────────────────────────────────
  addTask: (data, { sound = true } = {}) => {
    const task = createTask({ ...data, order: Date.now() });
    taskDb.save(task);
    set((s) => ({ tasks: [...s.tasks, task].sort((a, b) => a.order - b.order) }));
    if (sound) {
      const settings = JSON.parse(localStorage.getItem('adhd_settings') || '{}');
      if (settings.soundEnabled !== false) playAdd();
    }
    // Sync to backend if online
    pbTasks.upsert(task).catch(() => {});
    return task;
  },

  updateTask: (id, data) => {
    set((s) => {
      const tasks = s.tasks.map((t) =>
        t.id === id ? { ...t, ...data, updatedAt: new Date().toISOString() } : t
      );
      const updatedTask = tasks.find((t) => t.id === id);
      if (updatedTask) {
        taskDb.save(updatedTask);
        pbTasks.upsert(updatedTask).catch(() => {});
      }
      return { tasks };
    });
  },

  deleteTask: (id) => {
    taskDb.delete(id);
    pbTasks.delete(id).catch(() => {});
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
  },

  toggleComplete: (id) => {
    const task = get().tasks.find((t) => t.id === id);
    if (!task) return;
    const completed = !task.completed;
    const completedAt = completed ? new Date().toISOString() : null;
    get().updateTask(id, { completed, completedAt });
    if (completed) {
      const settings = JSON.parse(localStorage.getItem('adhd_settings') || '{}');
      if (settings.soundEnabled !== false) playComplete();
    }
  },

  // ── Drag & Drop reorder ────────────────────────────────────────────
  reorderTasks: (activeId, overId) => {
    set((s) => {
      const tasks = [...s.tasks];
      const from = tasks.findIndex((t) => t.id === activeId);
      const to   = tasks.findIndex((t) => t.id === overId);
      if (from === -1 || to === -1) return {};
      const [moved] = tasks.splice(from, 1);
      tasks.splice(to, 0, moved);
      // Reassign order values
      const reordered = tasks.map((t, i) => ({ ...t, order: i }));
      taskDb.reorder(reordered.map((t) => t.id));
      const updates = reordered.map((t) => ({ id: t.id, order: t.order }));
      pbTasks.reorder(updates).catch(() => {});
      return { tasks: reordered };
    });
  },

  // ── Bulk actions ──────────────────────────────────────────────────
  clearCompleted: () => {
    const completed = get().tasks.filter((t) => t.completed);
    completed.forEach((t) => {
      taskDb.delete(t.id);
      supabaseTasks.delete(t.id).catch(() => {});
    });
    set((s) => ({ tasks: s.tasks.filter((t) => !t.completed) }));
  },

  importFromICal: (events) => {
    const existing = new Set(get().tasks.map((t) => t.id));
    const newTasks = events
      .filter((e) => !existing.has(e.id))
      .map((e) => createTask({
        id: e.id,
        title: e.title,
        description: e.description,
        category: e.category,
        dueDate: e.start,
        source: 'ical',
        priority: 'medium',
      }));
    newTasks.forEach((t) => taskDb.save(t));
    set((s) => ({ tasks: [...s.tasks, ...newTasks].sort((a, b) => a.order - b.order) }));
  },

  // ── Filters ───────────────────────────────────────────────────────
  setEnergyFilter: (level) => set({ energyFilter: level }),
  setCategoryFilter: (cat) => set({ categoryFilter: cat }),
  setSearchQuery: (q) => set({ searchQuery: q }),

  // ── Derived selectors ─────────────────────────────────────────────
  getFilteredTasks: () => {
    const { tasks, energyFilter, categoryFilter, searchQuery } = get();
    return tasks.filter((t) => {
      if (energyFilter && t.energyRequired !== energyFilter) return false;
      if (categoryFilter && t.category !== categoryFilter) return false;
      if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  },

  getTodayTasks: () => {
    const today = new Date().toDateString();
    return get().tasks.filter((t) => {
      if (!t.dueDate) return true; // Unscheduled tasks always show
      return new Date(t.dueDate).toDateString() === today;
    });
  },

  getHighestPriorityTask: () => {
    const incomplete = get().tasks.filter((t) => !t.completed);
    const order = { high: 0, medium: 1, low: 2 };
    return incomplete.sort((a, b) => order[a.priority] - order[b.priority])[0] || null;
  },

  CATEGORIES,
  PRIORITIES,
  ENERGIES,
}));
