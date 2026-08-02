import { create } from 'zustand';
import { eventsDb, coachRulesDb } from '../lib/db';
import { pbEvents } from '../lib/api';
import pb from '../lib/pb';

export const useEventStore = create((set, get) => ({
  events: [],
  coachRules: [],
  loading: false,

  loadEvents: async () => {
    set({ loading: true });
    let local = eventsDb.getAll();
    let rules = coachRulesDb.getAll();

    const user = pb.authStore.model;
    if (user) {
      try {
        const remoteEvents = await pbEvents.getAll(user.id);
        if (remoteEvents) {
          local = remoteEvents;
          eventsDb.saveAll(local);
        }
      } catch (err) {
        console.warn('Failed to fetch events from PocketBase', err);
      }
    }

    set({ events: local, coachRules: rules, loading: false });
  },

  addEvent: async (eventData) => {
    const newEvent = {
      id: crypto.randomUUID(),
      title: eventData.title || 'رویداد جدید',
      description: eventData.description || '',
      category: eventData.category || 'lecture', // lecture | exam | assignment | personal
      startDate: eventData.startDate || new Date().toISOString(),
      endDate: eventData.endDate || null,
      reminders: eventData.reminders || [1440, 60], // Offset in minutes before event: e.g. 1440 (1 day), 60 (1 hr)
      location: eventData.location || '',
      createdAt: new Date().toISOString(),
    };

    eventsDb.save(newEvent);
    set((state) => ({ events: [...state.events, newEvent] }));

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('events').insert(newEvent);
      } catch (e) {
        console.warn('[useEventStore] Supabase insert failed', e);
      }
    }

    return newEvent;
  },

  updateEvent: async (id, partial) => {
    const updated = eventsDb.save({ id, ...partial });
    set((state) => ({
      events: state.events.map((e) => (e.id === id ? { ...e, ...partial } : e)),
    }));

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('events').update(partial).eq('id', id);
      } catch (e) {
        console.warn('[useEventStore] Supabase update failed', e);
      }
    }
  },

  deleteEvent: async (id) => {
    eventsDb.delete(id);
    set((state) => ({
      events: state.events.filter((e) => e.id !== id),
    }));

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('events').delete().eq('id', id);
      } catch (e) {
        console.warn('[useEventStore] Supabase delete failed', e);
      }
    }
  },

  // ── Coach Rules ───────────────────────────────────────────────────────
  addCoachRule: (ruleText) => {
    if (!ruleText.trim()) return;
    const rule = coachRulesDb.save(ruleText.trim());
    set((state) => ({ coachRules: [...state.coachRules, rule] }));
  },

  deleteCoachRule: (id) => {
    coachRulesDb.delete(id);
    set((state) => ({ coachRules: state.coachRules.filter((r) => r.id !== id) }));
  },
}));
