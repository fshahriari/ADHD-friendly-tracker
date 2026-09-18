import { playAdd } from './audio';

class ReminderService {
  constructor() {
    this.intervalId = null;
    this.notifiedSet = new Set(); // Prevent double notification in memory session
  }

  start(getTasks, getEvents, getSettings) {
    if (this.intervalId) return;

    // Request notification permission if needed
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Check every 20 seconds
    this.intervalId = setInterval(() => {
      this.checkReminders(getTasks(), getEvents(), getSettings());
    }, 20000);

    // Initial run immediately
    setTimeout(() => this.checkReminders(getTasks(), getEvents(), getSettings()), 1000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  checkReminders(tasks = [], events = [], settings = {}) {
    if (settings.notifications === false) return;
    const now = new Date().getTime();

    // Check Tasks with due dates
    tasks.forEach((task) => {
      if (task.completed || !task.dueDate) return;
      const dueTime = new Date(task.dueDate).getTime();
      const diffMinutes = Math.round((dueTime - now) / (1000 * 60));

      // Reminders at 1 day (1440m), 2 hrs (120m), 1 hr (60m), 15 min (15m), and due now (0m)
      const offsets = [1440, 120, 60, 15, 0];
      offsets.forEach((offset) => {
        if (diffMinutes >= offset - 1 && diffMinutes <= offset + 1) {
          const key = `task-${task.id}-${offset}`;
          if (!this.notifiedSet.has(key)) {
            this.notifiedSet.add(key);
            const label = offset === 0 ? 'هم‌اکنون ددلاین است!' : `${this.formatOffset(offset)} دیگر`;
            this.sendNotification(`⏰ یادآوری وظیفه: ${task.title}`, {
              body: `ددلاین: ${label}`,
              icon: '/icons/icon-192.png',
            }, settings);
          }
        }
      });
    });

    // Check Calendar Events
    events.forEach((evt) => {
      if (!evt.startDate) return;
      const startTime = new Date(evt.startDate).getTime();
      const diffMinutes = Math.round((startTime - now) / (1000 * 60));

      const reminders = evt.reminders || [60, 15, 0];
      reminders.forEach((offset) => {
        if (diffMinutes >= offset - 1 && diffMinutes <= offset + 1) {
          const key = `evt-${evt.id}-${offset}`;
          if (!this.notifiedSet.has(key)) {
            this.notifiedSet.add(key);
            const label = offset === 0 ? 'شروع شد!' : `${this.formatOffset(offset)} دیگر`;
            this.sendNotification(`📅 یادآوری رویداد: ${evt.title}`, {
              body: `زمان شروع: ${label}`,
              icon: '/icons/icon-192.png',
            }, settings);
          }
        }
      });
    });
  }

  formatOffset(minutes) {
    if (minutes >= 1440) return `${Math.round(minutes / 1440)} روز`;
    if (minutes >= 60) return `${Math.round(minutes / 60)} ساعت`;
    return `${minutes} دقیقه`;
  }

  sendNotification(title, options, settings) {
    if (settings.soundEnabled !== false) {
      try { playAdd(); } catch {}
    }

    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, options);
      } catch (err) {
        console.warn('[ReminderService] Notification error:', err);
      }
    }
  }
}

export const reminderService = new ReminderService();
