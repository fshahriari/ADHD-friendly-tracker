// ── iCal parser using ical.js ─────────────────────────────────────────────
// Fetches .ics URLs, parses them, and returns structured event objects.

/**
 * Fetch and parse an iCal (.ics) URL.
 * Returns array of event objects.
 */
export async function fetchAndParseICal(url) {
  // Use a CORS proxy if direct fetch fails (for Moodle URLs)
  let text;
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    text = await resp.text();
  } catch (err) {
    console.warn('[ical] Direct fetch failed, trying CORS proxy:', err.message);
    const corsProxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const resp = await fetch(corsProxy);
    if (!resp.ok) throw new Error(`CORS proxy failed: HTTP ${resp.status}`);
    text = await resp.text();
  }
  return parseICalText(text);
}

/**
 * Parse raw iCal text and return structured events.
 */
export function parseICalText(text) {
  // Minimal iCal parser (no external dep for better reliability in Iran)
  // Unfold lines first (RFC 5545: lines can be folded with \r\n + space)
  const unfolded = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);

  const events = [];
  let current = null;
  let inEvent = false;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = {};
      inEvent = true;
      continue;
    }
    if (line === 'END:VEVENT') {
      if (current) {
        const event = buildEvent(current);
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
      case 'SUMMARY':    current.summary = unescapeIcal(value); break;
      case 'DESCRIPTION': current.description = unescapeIcal(value); break;
      case 'DTSTART':    current.dtstart = parseICalDate(value, params); break;
      case 'DTEND':      current.dtend   = parseICalDate(value, params); break;
      case 'DUE':        current.due     = parseICalDate(value, params); break;
      case 'UID':        current.uid = value; break;
      case 'LOCATION':   current.location = unescapeIcal(value); break;
      case 'CATEGORIES': current.categories = value.split(',').map((s) => s.trim()); break;
      case 'STATUS':     current.status = value; break;
      case 'URL':        current.url = value; break;
    }
  }

  // Sort by start date
  return events.sort((a, b) => (a.start || 0) - (b.start || 0));
}

function buildEvent(raw) {
  if (!raw.summary) return null;
  const start = raw.dtstart || raw.due || null;
  const end   = raw.dtend   || raw.due || null;
  return {
    id: raw.uid || crypto.randomUUID(),
    title: raw.summary,
    description: raw.description || '',
    start: start ? start.toISOString() : null,
    end:   end   ? end.toISOString()   : null,
    location: raw.location || '',
    categories: raw.categories || [],
    status: raw.status || 'CONFIRMED',
    url: raw.url || '',
    source: 'ical',
    syncedAt: new Date().toISOString(),
    category: guessCategory(raw.summary, raw.categories || []),
  };
}

function parseICalDate(value, params = '') {
  // Handle DATE-only values (YYYYMMDD)
  if (value.length === 8 && !value.includes('T')) {
    const y = parseInt(value.slice(0, 4));
    const m = parseInt(value.slice(4, 6)) - 1;
    const d = parseInt(value.slice(6, 8));
    return new Date(y, m, d);
  }
  // Handle YYYYMMDDTHHMMSS[Z]
  if (value.includes('T')) {
    const y  = parseInt(value.slice(0, 4));
    const mo = parseInt(value.slice(4, 6)) - 1;
    const d  = parseInt(value.slice(6, 8));
    const h  = parseInt(value.slice(9, 11));
    const mi = parseInt(value.slice(11, 13));
    const s  = parseInt(value.slice(13, 15));
    const isUTC = value.endsWith('Z') || params.includes('TZID');
    return isUTC ? new Date(Date.UTC(y, mo, d, h, mi, s)) : new Date(y, mo, d, h, mi, s);
  }
  return null;
}

function unescapeIcal(str) {
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
  if (/lecture|class|درس|کلاس|session/.test(t + c)) return 'lecture';
  return 'personal';
}
