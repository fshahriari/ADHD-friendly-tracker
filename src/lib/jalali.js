// ── Jalali / Gregorian conversion utilities ───────────────────────────────
// Uses jalaali-js for Jalali conversion and date-fns-jalali for formatting.

import * as jalaali from 'jalaali-js';
import {
  format as jalaliFormat,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isSameDay,
  parseISO,
  getDay,
} from 'date-fns-jalali';

// Persian month names
export const PERSIAN_MONTHS = [
  'فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور',
  'مهر','آبان','آذر','دی','بهمن','اسفند',
];

// Persian weekday names (Saturday first — Iran standard)
export const PERSIAN_WEEKDAYS = ['ش','ی','د','س','چ','پ','ج'];
export const PERSIAN_WEEKDAYS_FULL = ['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'];

// ── Conversion ─────────────────────────────────────────────────────────────

/**
 * Convert a Gregorian Date to Jalali parts { jy, jm, jd }
 */
export function getJalaliParts(date) {
  return jalaali.toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/**
 * Convert Jalali parts back to a Gregorian Date
 */
export function fromJalaliParts(jy, jm, jd) {
  const { gy, gm, gd } = jalaali.toGregorian(jy, jm, jd);
  return new Date(gy, gm - 1, gd);
}

/**
 * Format a Gregorian Date as a Jalali string "yyyy/MM/dd"
 */
export function toJalaliString(date) {
  try {
    const { jy, jm, jd } = getJalaliParts(date);
    return `${jy}/${String(jm).padStart(2,'0')}/${String(jd).padStart(2,'0')}`;
  } catch {
    return '';
  }
}

// ── Calendar Grid ──────────────────────────────────────────────────────────

/**
 * Get the full month grid data for a Jalali calendar.
 * date-fns-jalali treats Dates as Jalali, so this works correctly.
 */
export function getJalaliMonthGrid(date) {
  const start = startOfMonth(date);
  const end   = endOfMonth(date);
  const days  = eachDayOfInterval({ start, end });

  // In date-fns-jalali, getDay() returns 0=Sat, 1=Sun... 6=Fri (Iran week)
  // Actually it returns the standard JS day: 0=Sun...6=Sat
  // We remap so Saturday=0 for the Iran week display
  const dayOfWeek = (d) => (getDay(d) + 1) % 7; // Sun(0)->1, Mon->2, ... Sat(6)->0
  const firstDayOffset = dayOfWeek(start);

  // Get Jalali month/year name using jalaali-js
  const { jy, jm } = getJalaliParts(date);

  return {
    days,
    firstDayOffset,
    month: PERSIAN_MONTHS[jm - 1],
    year: String(jy),
  };
}

// ── Navigation ─────────────────────────────────────────────────────────────
export const jalaliAddMonth = (date, n = 1) => addMonths(date, n);
export const jalaliSubMonth = (date, n = 1) => subMonths(date, n);

// ── Formatting ─────────────────────────────────────────────────────────────

/**
 * Format a Gregorian Date as a Jalali display string.
 * Uses date-fns-jalali's format function which understands Jalali tokens.
 */
export function formatJalali(date, fmt = 'dd MMMM yyyy') {
  try {
    return jalaliFormat(date, fmt);
  } catch {
    return '';
  }
}

/**
 * Check if two Gregorian Dates fall on the same Jalali day.
 * date-fns-jalali's isSameDay compares Jalali days correctly.
 */
export const isSameDayJalali = (a, b) => {
  try { return isSameDay(a, b); }
  catch { return false; }
};

// ── Utilities ───────────────────────────────────────────────────────────────

export const parseDate = (iso) => {
  try { return parseISO(iso); }
  catch { return new Date(); }
};

export const todayJalali = () => toJalaliString(new Date());
