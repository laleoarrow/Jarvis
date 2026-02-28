/**
 * Standardised output formatter for Jarvis replies.
 *
 * All replies use a fixed plain-text structure so that
 * downstream agents / scripts can easily parse them.
 */

'use strict';

/**
 * Format a standard Jarvis reply.
 */
function formatReply({
  type,
  major_tag,
  minor_tag,
  title,
  due,
  todoId,
  ics,
  summary,
  next,
}) {
  const lines = [
    `TYPE: ${type}`,
    `TAGS: ${major_tag}/${minor_tag}`,
    `TITLE: ${title}`,
    `DUE: ${due || ''}`,
    `TODO_ID: ${todoId != null ? todoId : ''}`,
  ];

  if (ics) {
    lines.push(`ICS:\n${ics}`);
  } else {
    lines.push('ICS:');
  }

  lines.push(`SUMMARY: ${summary}`);
  lines.push(`NEXT: ${next || '回复 1 查看今日待办'}`);

  return lines.join('\n');
}

/**
 * Format a todo list for display.
 */
function formatTodoList(todos) {
  if (todos.length === 0) {
    return '📋 当前没有未完成的待办事项。\n\nNEXT: 发送任意文本新建待办';
  }

  const header = `📋 待办列表（共 ${todos.length} 项）\n${'─'.repeat(24)}`;
  const lines = todos.map((t) => {
    const dueStr = t.due ? ` ⏰ ${t.due}` : '';
    return `[ ] ${t.id}. ${t.title}${dueStr}`;
  });

  return [header, ...lines, '─'.repeat(24),
    'NEXT: 完成 <id> | 延期 <id> YYYY-MM-DD HH:mm | 发送新任务',
  ].join('\n');
}

/**
 * Format a "done" confirmation.
 */
function formatDone(item) {
  return `✅ 已完成: #${item.id} ${item.title}\n\nNEXT: 回复 1 查看待办`;
}

/**
 * Format a "postpone" confirmation.
 */
function formatPostpone(item) {
  return `📅 已延期: #${item.id} ${item.title}\n新截止: ${item.due}\n\nNEXT: 回复 1 查看待办`;
}

module.exports = { formatReply, formatTodoList, formatDone, formatPostpone };
