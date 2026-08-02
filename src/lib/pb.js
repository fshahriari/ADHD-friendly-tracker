import PocketBase from 'pocketbase';

// Fallback to localhost if no env variable is provided (useful for local dev)
const PB_URL = import.meta.env.VITE_PB_URL || 'http://127.0.0.1:8090';

const pb = new PocketBase(PB_URL);

// Auto-cancellation of duplicate requests is useful, but we can disable it globally if it causes issues:
pb.autoCancellation(false);

export default pb;
