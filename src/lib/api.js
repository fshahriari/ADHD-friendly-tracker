import pb from './pb';

// ── PocketBase sync helpers ─────────────────────────────────────────────────
// All functions return { data, error } — callers should handle error gracefully.

export const pbTasks = {
  getAll: async (userId) => {
    try {
      const records = await pb.collection('tasks').getFullList({
        filter: `user_id = "${userId}"`,
        sort: 'order',
      });
      return { data: records, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  },

  upsert: async (task) => {
    try {
      // Check if task exists to decide between create or update
      // In a real scenario, it's safer to catch 404s
      let record;
      try {
        record = await pb.collection('tasks').getOne(task.id);
      } catch (e) {
        // Not found, will create
      }

      if (record) {
        const updated = await pb.collection('tasks').update(task.id, task);
        return { data: updated, error: null };
      } else {
        const created = await pb.collection('tasks').create({ ...task, user_id: pb.authStore.model?.id });
        return { data: created, error: null };
      }
    } catch (error) {
      return { data: null, error: error.message };
    }
  },

  delete: async (id) => {
    try {
      await pb.collection('tasks').delete(id);
      return { data: true, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  },

  reorder: async (updates) => {
    try {
      // PocketBase doesn't support batch updates natively in the client SDK
      // We loop over updates sequentially
      for (const update of updates) {
        await pb.collection('tasks').update(update.id, update);
      }
      return { data: true, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  },
};

export const pbEvents = {
  getAll: async (userId) => {
    try {
      if (!userId) return { data: null, error: 'No user ID' };
      const records = await pb.collection('events').getFullList({
        filter: `user_id = "${userId}"`,
      });
      return { data: records, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  }
};
