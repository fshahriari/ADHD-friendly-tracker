import { connectedCalendarsDb, icalDb, eventsDb } from './db';
import { fetchCalendarDetails, parseICalText, normalizeCalendarUrl, detectCalendarProvider } from './ical';
import { useEventStore } from '../store/useEventStore';
import { useSettingsStore } from '../store/useSettingsStore';

const PROVIDER_COLORS = {
  google: '#4285F4',
  apple: '#999999',
  samsung: '#034ea2',
  moodle: '#f59e0b',
  outlook: '#0078D4',
  ical: '#8b5cf6',
};

class CalendarSyncService {
  constructor() {
    this.timerId = null;
    this.isSyncing = false;
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach((fn) => {
      try { fn(); } catch (e) { console.error(e); }
    });
  }

  getCalendars() {
    let calendars = connectedCalendarsDb.getAll();

    // Migrate legacy icalUrls from settings if connectedCalendars is empty
    if (!calendars.length) {
      const settings = useSettingsStore.getState();
      const legacyUrls = settings.icalUrls || [];
      if (legacyUrls.length > 0) {
        calendars = legacyUrls.map((url, idx) => {
          const provider = detectCalendarProvider(url);
          return {
            id: `legacy-${idx}-${Date.now()}`,
            name: provider === 'google' ? 'Google Calendar' : (provider === 'moodle' ? 'تقویم دانشگاه (مودل)' : `تقویم ${idx + 1}`),
            url: normalizeCalendarUrl(url),
            provider,
            color: PROVIDER_COLORS[provider] || '#8b5cf6',
            enabled: true,
            lastSync: null,
            eventCount: 0,
            error: null,
          };
        });
        connectedCalendarsDb.saveAll(calendars);
      }
    }

    return calendars;
  }

  async addCalendar({ url, name, provider: customProvider, color }) {
    const cleanUrl = normalizeCalendarUrl(url);
    const provider = customProvider || detectCalendarProvider(cleanUrl);

    // Initial test sync to fetch real calendar name & event count
    let calendarTitle = name;
    let initialEvents = [];
    let initialError = null;

    try {
      const details = await fetchCalendarDetails(cleanUrl);
      initialEvents = details.events || [];
      if (!calendarTitle && details.calendarTitle) {
        calendarTitle = details.calendarTitle;
      }
    } catch (err) {
      console.warn('[CalendarSync] Initial fetch failed:', err.message);
      initialError = err.message;
    }

    const newCalendar = {
      id: crypto.randomUUID(),
      name: calendarTitle || (provider === 'google' ? 'تقویم گوگل' : (provider === 'apple' ? 'تقویم اپل' : 'تقویم من')),
      url: cleanUrl,
      provider,
      color: color || PROVIDER_COLORS[provider] || '#8b5cf6',
      enabled: true,
      lastSync: initialError ? null : new Date().toISOString(),
      eventCount: initialEvents.length,
      error: initialError,
      createdAt: new Date().toISOString(),
    };

    connectedCalendarsDb.add(newCalendar);

    // If events were fetched, save and apply
    if (initialEvents.length > 0) {
      await this.saveCalendarEvents(newCalendar.id, initialEvents, newCalendar);
    }

    this.notify();
    return { calendar: newCalendar, events: initialEvents, error: initialError };
  }

  async importFromIcsText(icsText, name = 'تقویم وارد شده', provider = 'google') {
    const details = parseICalText(icsText, provider);
    const events = details.events || [];

    const newCalendar = {
      id: crypto.randomUUID(),
      name: name || details.calendarTitle || 'فایل تقویم',
      url: '',
      provider,
      isFile: true,
      color: PROVIDER_COLORS[provider] || '#8b5cf6',
      enabled: true,
      lastSync: new Date().toISOString(),
      eventCount: events.length,
      error: null,
      createdAt: new Date().toISOString(),
    };

    connectedCalendarsDb.add(newCalendar);
    await this.saveCalendarEvents(newCalendar.id, events, newCalendar);
    this.notify();
    return { calendar: newCalendar, events };
  }

  removeCalendar(id) {
    connectedCalendarsDb.remove(id);

    // Remove associated events
    const allIcalEvents = icalDb.getAll();
    const remaining = allIcalEvents.filter((e) => e.calendarId !== id);
    icalDb.saveAll(remaining);

    // Also remove from useEventStore
    const { events } = useEventStore.getState();
    const filteredEvents = events.filter((e) => e.calendarId !== id);
    useEventStore.setState({ events: filteredEvents });
    eventsDb.saveAll(filteredEvents);

    this.notify();
  }

  toggleCalendar(id, enabled) {
    connectedCalendarsDb.update(id, { enabled });
    this.notify();
  }

  async syncCalendar(calendar) {
    if (!calendar.url) return []; // file imports have no URL to re-fetch
    try {
      const details = await fetchCalendarDetails(calendar.url);
      const events = details.events || [];

      connectedCalendarsDb.update(calendar.id, {
        lastSync: new Date().toISOString(),
        eventCount: events.length,
        error: null,
      });

      await this.saveCalendarEvents(calendar.id, events, calendar);
      return events;
    } catch (err) {
      connectedCalendarsDb.update(calendar.id, {
        error: err.message,
      });
      throw err;
    }
  }

  async syncAll() {
    if (this.isSyncing) return;
    this.isSyncing = true;
    this.notify();

    const calendars = this.getCalendars().filter((c) => c.enabled && !c.isFile);
    let totalEvents = 0;
    const errors = [];

    for (const cal of calendars) {
      try {
        const evts = await this.syncCalendar(cal);
        totalEvents += evts.length;
      } catch (err) {
        errors.push(`${cal.name}: ${err.message}`);
      }
    }

    this.isSyncing = false;
    this.notify();
    return { totalEvents, errors };
  }

  async saveCalendarEvents(calendarId, rawEvents, calendar) {
    // Tag each event with calendar metadata
    const taggedEvents = rawEvents.map((e) => ({
      ...e,
      calendarId,
      calendarName: calendar.name,
      calendarColor: calendar.color,
      source: calendar.provider || 'google',
    }));

    // Update icalDb
    const currentIcal = icalDb.getAll().filter((e) => e.calendarId !== calendarId);
    const updatedIcal = [...currentIcal, ...taggedEvents];
    icalDb.saveAll(updatedIcal);

    // Synchronize into useEventStore
    const currentStoreEvents = useEventStore.getState().events.filter((e) => e.calendarId !== calendarId);
    const mergedStoreEvents = [...currentStoreEvents, ...taggedEvents];
    useEventStore.setState({ events: mergedStoreEvents });
    eventsDb.saveAll(mergedStoreEvents);
  }

  startBackgroundSync(intervalMinutes = 15) {
    if (this.timerId) return;

    // Run initial sync after a short delay
    setTimeout(() => {
      this.syncAll().catch(() => {});
    }, 3000);

    // Periodic sync
    this.timerId = setInterval(() => {
      this.syncAll().catch(() => {});
    }, intervalMinutes * 60 * 1000);
  }

  stopBackgroundSync() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }
}

export const calendarSyncService = new CalendarSyncService();
export { PROVIDER_COLORS };
