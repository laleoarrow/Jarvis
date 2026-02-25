/**
 * In-memory data store for Jarvis MVP.
 *
 * ⚠️  Data is lost when the process restarts.
 * Future: swap this module for SQLite / external DB.
 */

'use strict';

let _nextId = 1;

/** @type {Map<number, object>} */
const items = new Map();

/**
 * Add an item to the store.
 * @returns {object} the saved item (with id)
 */
function addItem({ content, type, major_tag, minor_tag, title, due, ics }) {
  const id = _nextId++;
  const item = {
    id,
    content,
    type,
    major_tag,
    minor_tag,
    title: title || content.slice(0, 40),
    due: due || null,
    ics: ics || null,
    done: false,
    createdAt: new Date().toISOString(),
  };
  items.set(id, item);
  return item;
}

/**
 * Get all incomplete todo/reminder items.
 */
function getTodos() {
  const result = [];
  for (const item of items.values()) {
    if (item.major_tag === 'action' &&
      (item.minor_tag === 'todo' || item.minor_tag === 'reminder') &&
      !item.done) {
      result.push(item);
    }
  }
  return result;
}

/**
 * Mark an item as done by id.
 * @returns {object|null}
 */
function markDone(id) {
  const item = items.get(id);
  if (!item) return null;
  item.done = true;
  return item;
}

/**
 * Update an item's due date.
 * @returns {object|null}
 */
function updateDue(id, newDue) {
  const item = items.get(id);
  if (!item) return null;
  item.due = newDue;
  return item;
}

/**
 * Get an item by id.
 */
function getItem(id) {
  return items.get(id) || null;
}

/**
 * Get all items (for debugging).
 */
function getAll() {
  return [...items.values()];
}

module.exports = { addItem, getTodos, markDone, updateDue, getItem, getAll };
