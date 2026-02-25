/**
 * Command router – handles instruction-style messages.
 *
 * Passive-trigger commands:
 *   "1" / "今日待办"         → list todos
 *   "完成 3" / "完成3"       → mark done
 *   "延期 3 YYYY-MM-DD HH:mm" → update due
 *
 * Everything else → new item.
 */

'use strict';

const store = require('./store');
const { formatTodoList, formatDone, formatPostpone } = require('./formatter');

/**
 * Try to match and execute a command.
 *
 * @param {string} content – trimmed message text
 * @returns {{ handled: boolean, reply?: string }}
 */
function tryCommand(content) {
  // ── list todos ──
  if (content === '1' || content === '今日待办') {
    const todos = store.getTodos();
    return { handled: true, reply: formatTodoList(todos) };
  }

  // ── mark done: "完成 3" or "完成3" ──
  const doneMatch = content.match(/^完成\s*(\d+)$/);
  if (doneMatch) {
    const id = Number(doneMatch[1]);
    const item = store.markDone(id);
    if (!item) return { handled: true, reply: `❌ 未找到待办 #${id}` };
    return { handled: true, reply: formatDone(item) };
  }

  // ── postpone: "延期 3 2026-03-01 18:00" ──
  const postponeMatch = content.match(
    /^延期\s*(\d+)\s+(\d{4}-\d{2}-\d{2}(?:\s+\d{1,2}:\d{2})?)$/
  );
  if (postponeMatch) {
    const id = Number(postponeMatch[1]);
    const newDue = postponeMatch[2];
    const item = store.updateDue(id, newDue);
    if (!item) return { handled: true, reply: `❌ 未找到待办 #${id}` };
    return { handled: true, reply: formatPostpone(item) };
  }

  return { handled: false };
}

module.exports = { tryCommand };
