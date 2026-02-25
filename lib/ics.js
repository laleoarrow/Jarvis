/**
 * ICS (iCalendar) generation for todo / reminder items.
 *
 * Generates a VEVENT that users can copy-paste and import
 * into Apple Calendar or Google Calendar.
 */

'use strict';

const crypto = require('crypto');

/**
 * Parse a due string into a Date object.
 *
 * Supports:
 *   - "YYYY-MM-DD HH:mm"
 *   - "YYYY-MM-DD" (defaults to 09:00)
 *   - "明天 HH:mm" / "后天 HH:mm"
 *   - "明天" / "后天" (defaults to 09:00)
 *
 * @param {string} text – the raw text to extract a date from
 * @returns {Date|null}
 */
function parseDue(text) {
  if (!text) return null;

  // Try "YYYY-MM-DD HH:mm"
  const full = text.match(/(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})/);
  if (full) return new Date(`${full[1]}T${full[2].padStart(5, '0')}:00+08:00`);

  // Try "YYYY-MM-DD" alone
  const dateOnly = text.match(/(\d{4}-\d{2}-\d{2})/);
  if (dateOnly) return new Date(`${dateOnly[1]}T09:00:00+08:00`);

  // Try relative: 明天/后天
  const relMatch = text.match(/(明天|后天)\s*(\d{1,2}:\d{2})?/);
  if (relMatch) {
    const now = new Date();
    const days = relMatch[1] === '明天' ? 1 : 2;
    now.setDate(now.getDate() + days);
    const time = relMatch[2] || '09:00';
    const [h, m] = time.split(':').map(Number);
    now.setHours(h, m, 0, 0);
    return now;
  }

  return null;
}

/**
 * Extract a due date from free-text content.
 * Returns { due: string|null, dueDate: Date|null }
 */
function extractDue(content) {
  const dueDate = parseDue(content);
  if (!dueDate) return { due: null, dueDate: null };
  return {
    due: formatLocalDateTime(dueDate),
    dueDate,
  };
}

/**
 * Format a Date as "YYYY-MM-DD HH:mm" in local time.
 */
function formatLocalDateTime(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Format a Date as iCalendar UTC timestamp: "YYYYMMDDTHHmmssZ"
 */
function toICSDate(d) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Generate an ICS (VEVENT) string for a given item.
 *
 * @param {object} params
 * @param {string} params.title – event summary
 * @param {Date}   params.dueDate – the due date
 * @param {string} [params.description] – event description
 * @returns {string} complete .ics text
 */
function generateICS({ title, dueDate, description }) {
  const uid = crypto.randomUUID();
  const now = toICSDate(new Date());
  const dtEnd = toICSDate(dueDate);

  // Start 1 hour before due
  const dtStart = toICSDate(new Date(dueDate.getTime() - 60 * 60 * 1000));

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Jarvis//WeCom Secretary//CN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${(description || title).replace(/\n/g, '\\n')}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    `DESCRIPTION:Jarvis 提醒: ${title}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

module.exports = { parseDue, extractDue, generateICS, formatLocalDateTime };
