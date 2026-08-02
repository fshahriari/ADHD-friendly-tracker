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

export default function App() {
  const { load, theme, accentColor } = useSettingsStore();
  const { loadTasks, tasks } = useTaskStore();
  const { loadEvents, events } = useEventStore();
  const { user } = useAuthStore();

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

    // Fetch iCal on app open
    const settings = JSON.parse(localStorage.getItem('adhd_settings') || '{}');
    if (settings.icalUrls?.length) {
      import('./lib/ical').then(({ fetchAndParseICal }) => {
        import('./lib/db').then(({ icalDb }) => {
          settings.icalUrls.forEach((url) =>
            fetchAndParseICal(url).then((events) => icalDb.saveAll(events)).catch(() => {})
          );
        });
      });
    }

    return () => reminderService.stop();
  }, [user]);

  // Synchronize document theme and accent color
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme || 'dark');
    document.documentElement.setAttribute('data-accent', accentColor || 'violet');
  }, [theme, accentColor]);

  return (
    <BrowserRouter>
      <ToastContainer />
      {!user ? (
        <AuthPage />
      ) : (
        <AppShell>
          <Routes>
            <Route path="/"           element={<Dashboard />} />
            <Route path="/brain-dump" element={<BrainDumpPage />} />
            <Route path="/focus"      element={<FocusPage />} />
            <Route path="/calendar"   element={<CalendarPage />} />
            <Route path="/settings"   element={<SettingsPage />} />
          </Routes>
        </AppShell>
      )}
    </BrowserRouter>
  );
}
