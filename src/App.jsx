import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import Dashboard from './pages/Dashboard';
import SettingsPage from './pages/SettingsPage';
import BrainDump from './components/brain-dump/BrainDump';
import FocusMode from './components/focus/FocusMode';
import CalendarView from './components/calendar/CalendarView';
import { ToastContainer } from './components/shared';
import { useSettingsStore } from './store/useSettingsStore';
import { useTaskStore } from './store/useTaskStore';
import { useEventStore } from './store/useEventStore';
import { reminderService } from './lib/reminderService';
import { calendarSyncService } from './lib/calendarSyncService';
import { initCapacitor, isNative, setStatusBarStyle } from './lib/capacitor';

function BrainDumpPage() {
  return <div className="page"><BrainDump /></div>;
}
function FocusPage() {
  return <div className="page" style={{ paddingBottom: 16 }}><FocusMode /></div>;
}
function CalendarPage() {
  return <div className="page"><CalendarView /></div>;
}

import AuthPage from './pages/AuthPage';
import { useAuthStore } from './store/useAuthStore';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '60vh', padding: 24, textAlign: 'center', direction: 'rtl'
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⚠️</div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 8, color: '#f1f5f9' }}>
            مشکلی در نمایش این صفحه پیش آمد
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', maxWidth: 440, marginBottom: 16 }}>
            {this.state.error?.message || 'یک خطای غیرمنتظره رخ داده است.'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="btn btn-primary"
            style={{ padding: '8px 20px' }}>
            بارگذاری مجدد صفحه
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const { load, theme, accentColor } = useSettingsStore();
  const { loadTasks, tasks } = useTaskStore();
  const { loadEvents, events } = useEventStore();
  const { user, init, loading: authLoading } = useAuthStore();

  useEffect(() => {
    init();
  }, [init]);

  // Initialize Capacitor native platform (Android)
  useEffect(() => {
    initCapacitor().then(() => {
      if (isNative()) {
        // Dynamically load liquid-glass CSS only on native/mobile
        import('./mobile-glass.css');
      }
    });
  }, []);

  useEffect(() => {
    if (!user) return; // Don't load data if not logged in

    load();
    loadTasks();
    loadEvents();

    // Start background reminder service
    reminderService.start(
      () => useTaskStore.getState().tasks,
      () => useEventStore.getState().events,
      () => useSettingsStore.getState()
    );

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    // Start background calendar sync (Google, Apple, Moodle)
    calendarSyncService.startBackgroundSync(15);

    // Auto-sync when coming online
    const handleOnline = async () => {
      console.log('🔗 Internet reconnected! Syncing local data to Supabase...');
      // Tasks
      const localTasks = useTaskStore.getState().tasks;
      import('./lib/supabase').then(({ supabaseTasks }) => {
        localTasks.forEach(task => {
          supabaseTasks.upsert(task).catch(() => {});
        });
      });
      calendarSyncService.syncAll().catch(() => {});
    };
    window.addEventListener('online', handleOnline);

    return () => {
      reminderService.stop();
      calendarSyncService.stopBackgroundSync();
      window.removeEventListener('online', handleOnline);
    };
  }, [user]);

  // Synchronize document theme and accent color
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme || 'dark');
    document.documentElement.setAttribute('data-accent', accentColor || 'violet');
    // Sync native status bar style with theme
    if (isNative()) {
      setStatusBarStyle(theme === 'light' ? 'DARK' : 'LIGHT');
    }
  }, [theme, accentColor]);

  return (
    <BrowserRouter>
      <ToastContainer />
      {authLoading ? (
        <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
          صبر کنید...
        </div>
      ) : !user ? (
        <AuthPage />
      ) : (
        <AppShell>
          <ErrorBoundary>
            <Routes>
              <Route path="/"           element={<Dashboard />} />
              <Route path="/brain-dump" element={<BrainDumpPage />} />
              <Route path="/focus"      element={<FocusPage />} />
              <Route path="/calendar"   element={<CalendarPage />} />
              <Route path="/settings"   element={<SettingsPage />} />
            </Routes>
          </ErrorBoundary>
        </AppShell>
      )}
    </BrowserRouter>
  );
}
