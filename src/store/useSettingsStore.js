import { create } from 'zustand';
import { settingsDb, DEFAULT_CATEGORIES } from '../lib/db';

export const useSettingsStore = create((set, get) => ({
  ...settingsDb.get(),
  customCategories: settingsDb.get().customCategories || DEFAULT_CATEGORIES,

  update: (partial) => {
    set(partial);
    settingsDb.save(partial);
    if (partial.theme) {
      document.documentElement.setAttribute('data-theme', partial.theme);
    }
    if (partial.accentColor) {
      document.documentElement.setAttribute('data-accent', partial.accentColor);
    }
  },

  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    get().update({ theme: next });
  },

  setAccentColor: (color) => {
    get().update({ accentColor: color });
  },

  setEnergyLevel: (level) => get().update({ energyLevel: level }),

  setOpenaiModel: (model) => get().update({ openaiModel: model }),

  // ── Category Management ────────────────────────────────────────────────
  updateCategory: (value, partial) => {
    const list = (get().customCategories || DEFAULT_CATEGORIES).map((c) =>
      c.value === value ? { ...c, ...partial } : c
    );
    get().update({ customCategories: list });
  },

  addCategory: ({ label, icon = '📌', color = '#8b5cf6' }) => {
    if (!label || !label.trim()) return null;
    const value = 'cat_' + Date.now();
    const newCat = { value, label: label.trim(), icon: icon || '📌', color: color || '#8b5cf6' };
    const list = [...(get().customCategories || DEFAULT_CATEGORIES), newCat];
    get().update({ customCategories: list });
    return newCat;
  },

  deleteCategory: (value) => {
    const current = get().customCategories || DEFAULT_CATEGORIES;
    if (current.length <= 1) return;
    const list = current.filter((c) => c.value !== value);
    get().update({ customCategories: list });
  },

  resetCategories: () => {
    get().update({ customCategories: DEFAULT_CATEGORIES });
  },

  addIcalUrl: (url) => {
    const urls = [...(get().icalUrls || [])];
    if (!urls.includes(url)) urls.push(url);
    get().update({ icalUrls: urls });
  },

  removeIcalUrl: (url) => {
    get().update({ icalUrls: (get().icalUrls || []).filter((u) => u !== url) });
  },

  load: () => {
    const saved = settingsDb.get();
    set({
      ...saved,
      customCategories: saved.customCategories || DEFAULT_CATEGORIES,
    });
    document.documentElement.setAttribute('data-theme', saved.theme || 'dark');
    document.documentElement.setAttribute('data-accent', saved.accentColor || 'violet');
  },
}));
