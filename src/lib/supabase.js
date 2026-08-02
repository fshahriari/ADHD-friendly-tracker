import { createClient } from '@supabase/supabase-js';
import { settingsDb } from './db';

let _client = null;

/**
 * Lazily create the Supabase client using runtime settings.
 * Falls back gracefully if credentials aren't configured.
 */
export function getSupabaseClient() {
  if (_client) return _client;
  const settings = settingsDb.get();
  const url = settings.supabaseUrl || import.meta.env.VITE_SUPABASE_URL;
  const key = settings.supabaseAnonKey || import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  _client = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true },
    realtime: { params: { eventsPerSecond: 2 } },
  });
  return _client;
}

export function resetSupabaseClient() {
  _client = null;
}

// ── Supabase sync helpers ─────────────────────────────────────────────────
// All functions return { data, error } — callers should handle error gracefully.

export const supabaseTasks = {
  getAll: async (userId) => {
    const supabase = getSupabaseClient();
    if (!supabase) return { data: null, error: 'No Supabase client' };
    return supabase.from('tasks').select('*').eq('user_id', userId).order('order', { ascending: true });
  },

  upsert: async (task) => {
    const supabase = getSupabaseClient();
    if (!supabase) return { data: null, error: 'No Supabase client' };
    return supabase.from('tasks').upsert(task, { onConflict: 'id' });
  },

  delete: async (id) => {
    const supabase = getSupabaseClient();
    if (!supabase) return { data: null, error: 'No Supabase client' };
    return supabase.from('tasks').delete().eq('id', id);
  },

  reorder: async (updates) => {
    const supabase = getSupabaseClient();
    if (!supabase) return { data: null, error: 'No Supabase client' };
    // Batch update order values
    return supabase.from('tasks').upsert(updates, { onConflict: 'id' });
  },
};

export const supabaseAuth = {
  signIn: async (email, password) => {
    const supabase = getSupabaseClient();
    if (!supabase) return { data: null, error: 'No Supabase client' };
    return supabase.auth.signInWithPassword({ email, password });
  },

  signUp: async (email, password) => {
    const supabase = getSupabaseClient();
    if (!supabase) return { data: null, error: 'No Supabase client' };
    return supabase.auth.signUp({ email, password });
  },

  signOut: async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    return supabase.auth.signOut();
  },

  getSession: async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data?.session || null;
  },
};
