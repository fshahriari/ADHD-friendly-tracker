import { create } from 'zustand';
import { settingsDb } from '../lib/db';

export const useSettingsStore = create((set, get) => ({
  ...settingsDb.get(),

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
    set(saved);
    document.documentElement.setAttribute('data-theme', saved.theme || 'dark');
    document.documentElement.setAttribute('data-accent', saved.accentColor || 'violet');
  },
}));
