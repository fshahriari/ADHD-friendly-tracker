// ── iCal Parser & Calendar Sync Engine ────────────────────────────────────
// Supports Google Calendar, Apple Calendar (iCloud), Outlook, Moodle, and standard ICS.

/**
 * Normalizes calendar URLs (e.g. converts webcal:// to https://, trims spaces).
 */
export function normalizeCalendarUrl(rawUrl = '') {
  let url = rawUrl.trim();
  if (url.startsWith('webcal://')) {
    url = 'https://' + url.slice(9);
  } else if (url.startsWith('http://calendar.google.com')) {
    url = 'https://' + url.slice(7);
  }
  return url;
}

/**
 * Detects the calendar provider from URL.
 */
export function detectCalendarProvider(url = '') {
  const lower = url.toLowerCase();
  if (lower.includes('calendar.google.com') || lower.includes('google.com/calendar')) {
    return 'google';
  }
  if (lower.includes('icloud.com') || lower.includes('apple.com')) {
    return 'apple';
  }
  if (lower.includes('outlook.') || lower.includes('live.com') || lower.includes('office365.com')) {
    return 'outlook';
  }
  if (lower.includes('samsung')) {
    return 'samsung';
  }
  if (lower.includes('moodle') || lower.includes('edu') || lower.includes('univ')) {
    return 'moodle';
  }
  return 'ical';
}

/**
 * Fetch with timeout helper.
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { ...options, credentials: 'omit', signal: controller.signal });
    clearTimeout(id);
    return resp;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

/**
 * Fetch raw iCal content trying multiple proxy strategies.
 */
export async function fetchICalText(rawUrl) {
  const url = normalizeCalendarUrl(rawUrl);
  const workerProxyUrl = import.meta.env?.VITE_GEMINI_PROXY_URL;
  const isLocalDev = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.startsWith('192.168.')
  );

  const attempts = [];

  // 1. Local Vite proxy in development
  if (isLocalDev) {
    attempts.push({
      name: 'Vite Dev Proxy',
      fetcher: () => fetchWithTimeout(`/api/calendar-proxy?url=${encodeURIComponent(url)}`, {}, 7000),
    });
  }

  // 2. Cloudflare Worker proxy if configured
  if (workerProxyUrl) {
    const base = workerProxyUrl.replace(/\/+$/, '');
    attempts.push({
      name: 'Cloudflare Worker Proxy',
      fetcher: () => fetchWithTimeout(`${base}/api/calendar-proxy?url=${encodeURIComponent(url)}`, {}, 9000),
    });
  }

  // 3. Direct fetch (works if CORS is allowed on host)
  attempts.push({
    name: 'Direct Fetch',
    fetcher: () => fetchWithTimeout(url, { headers: { 'Accept': 'text/calendar, text/plain, */*' } }, 6000),
  });

  // 4. Public CORS proxies as fallbacks
  attempts.push({
    name: 'AllOrigins CORS Proxy',
    fetcher: () => fetchWithTimeout(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, {}, 10000),
  });

  let lastError = null;
  for (const attempt of attempts) {
    try {
      const resp = await attempt.fetcher();
      if (resp.ok) {
        const text = await resp.text();
        if (text && (text.includes('BEGIN:VCALENDAR') || text.includes('BEGIN:VEVENT'))) {
          return text;
        }
      }
    } catch (err) {
      lastError = err;
      console.warn(`[calendar] ${attempt.name} failed:`, err.message);
    }
  }

  throw new Error(lastError?.message || 'امکان برقراری ارتباط با سرور تقویم میسر نشد. لطفاً از اتصال اینترنت و صحت لینک اطمینان حاصل فرمایید.');
}

/**
 * Fetch and parse an iCal URL.
 * Returns { events: Event[], calendarTitle: string, provider: string }
 */
export async function fetchAndParseICal(rawUrl) {
  const url = normalizeCalendarUrl(rawUrl);
  const provider = detectCalendarProvider(url);
  const text = await fetchICalText(url);
  const result = parseICalText(text, provider);
  return result.events;
}

/**
 * Fetch and parse full calendar details (including calendar title).
 */
export async function fetchCalendarDetails(rawUrl) {
  const url = normalizeCalendarUrl(rawUrl);
  const provider = detectCalendarProvider(url);
  const text = await fetchICalText(url);
  return parseICalText(text, provider);
}

/**
 * Parse raw iCal text and return structured events & calendar metadata.
 */
export function parseICalText(text, defaultProvider = 'ical') {
  // Unfold lines (RFC 5545: lines can be folded with \r\n + whitespace)
  const unfolded = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);

  const events = [];
  let current = null;
  let inEvent = false;
  let calendarTitle = '';

  for (const line of lines) {
    if (!inEvent && line.startsWith('X-WR-CALNAME:')) {
      calendarTitle = unescapeIcal(line.slice('X-WR-CALNAME:'.length).trim());
    }

    if (line === 'BEGIN:VEVENT') {
      current = {};
      inEvent = true;
      continue;
    }
    if (line === 'END:VEVENT') {
      if (current) {
        const event = buildEvent(current, defaultProvider);
        if (event) events.push(event);
      }
      current = null;
      inEvent = false;
      continue;
    }
    if (!inEvent || !current) continue;

    // Parse property: NAME;PARAM=val:VALUE
    const colonIdx = line.indexOf(':');
    if (colonIdx < 0) continue;
    const propFull = line.slice(0, colonIdx);
    const value = line.slice(colonIdx + 1).trim();
    const propName = propFull.split(';')[0].toUpperCase();
    const params = propFull.includes(';') ? propFull.slice(propFull.indexOf(';') + 1) : '';

    switch (propName) {
      case 'SUMMARY':     current.summary = unescapeIcal(value); break;
      case 'DESCRIPTION': current.description = unescapeIcal(value); break;
      case 'DTSTART':     current.dtstart = parseICalDate(value, params); break;
      case 'DTEND':       current.dtend   = parseICalDate(value, params); break;
      case 'DUE':         current.due     = parseICalDate(value, params); break;
      case 'UID':         current.uid = value; break;
      case 'LOCATION':    current.location = unescapeIcal(value); break;
      case 'CATEGORIES':  current.categories = value.split(',').map((s) => s.trim()); break;
      case 'STATUS':      current.status = value; break;
      case 'URL':         current.url = value; break;
    }
  }

  // Sort chronologically
  events.sort((a, b) => new Date(a.startDate || 0) - new Date(b.startDate || 0));

  return {
    calendarTitle: calendarTitle || (defaultProvider === 'google' ? 'Google Calendar' : 'تقویم'),
    events,
    provider: defaultProvider,
  };
}

function buildEvent(raw, provider = 'ical') {
  if (!raw.summary) return null;
  const start = raw.dtstart || raw.due || null;
  const end   = raw.dtend   || raw.due || null;

  const desc = raw.description || '';
  const loc = raw.location || '';

  // Extract online meeting URL (Google Meet, Zoom, Teams, etc.)
  const meetingMatch = (desc + ' ' + loc + ' ' + (raw.url || '')).match(
    /https:\/\/(meet\.google\.com\/[a-z0-9-]+|zoom\.us\/j\/[0-9]+|teams\.microsoft\.com\/[^\s]+|webex\.com\/[^\s]+)/i
  );
  const meetingUrl = meetingMatch ? meetingMatch[0] : (raw.url && raw.url.startsWith('http') ? raw.url : '');

  // Detect if event is all-day
  const isAllDay = raw.dtstart?.isAllDay || false;

  return {
    id: raw.uid || crypto.randomUUID(),
    title: raw.summary,
    description: desc,
    startDate: start ? start.toISOString() : null,
    endDate:   end   ? end.toISOString()   : null,
    isAllDay,
    location: loc,
    meetingUrl,
    categories: raw.categories || [],
    status: raw.status || 'CONFIRMED',
    url: raw.url || '',
    source: provider, // 'google' | 'apple' | 'moodle' | 'ical'
    syncedAt: new Date().toISOString(),
    category: guessCategory(raw.summary, raw.categories || []),
  };
}

function parseICalDate(value, params = '') {
  if (!value) return null;
  // Handle DATE-only values (YYYYMMDD)
  if (value.length === 8 && !value.includes('T')) {
    const y = parseInt(value.slice(0, 4));
    const m = parseInt(value.slice(4, 6)) - 1;
    const d = parseInt(value.slice(6, 8));
    const date = new Date(y, m, d);
    date.isAllDay = true;
    return date;
  }
  // Handle YYYYMMDDTHHMMSS[Z]
  if (value.includes('T')) {
    const y  = parseInt(value.slice(0, 4));
    const mo = parseInt(value.slice(4, 6)) - 1;
    const d  = parseInt(value.slice(6, 8));
    const h  = parseInt(value.slice(9, 11));
    const mi = parseInt(value.slice(11, 13));
    const s  = parseInt(value.slice(13, 15) || '0');
    const isUTC = value.endsWith('Z') || params.includes('TZID');
    const date = isUTC ? new Date(Date.UTC(y, mo, d, h, mi, s)) : new Date(y, mo, d, h, mi, s);
    date.isAllDay = false;
    return date;
  }
  return null;
}

function unescapeIcal(str) {
  if (!str) return '';
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

function guessCategory(title = '', categories = []) {
  const t = title.toLowerCase();
  const c = categories.join(' ').toLowerCase();
  if (/exam|آزمون|امتحان|quiz|midterm|final/.test(t + c)) return 'exam';
  if (/assign|تکلیف|homework|project|پروژه|submit/.test(t + c)) return 'assignment';
  if (/lecture|class|درس|کلاس|session|جلسه|میتینگ|meet/.test(t + c)) return 'lecture';
  return 'personal';
}
