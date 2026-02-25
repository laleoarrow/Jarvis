/**
 * Message classifier – determines message type and tags.
 *
 * type:  text | link | mp_article
 * tags:  major_tag / minor_tag
 */

'use strict';

/* ─── type detection ──────────────────────────────────────── */

/**
 * Detect message type from WeCom MsgType and content.
 *   - WeCom MsgType "link" → link
 *   - content contains mp.weixin.qq.com or weixin.qq.com article URL → mp_article
 *   - otherwise → text
 */
function detectType(wecomMsgType, content) {
  if (wecomMsgType === 'link') return 'link';

  // Check for WeChat public account article links
  const mpPattern = /https?:\/\/mp\.weixin\.qq\.com\/s[\w?=&#/%-]*/i;
  const wxPattern = /https?:\/\/weixin\.qq\.com\/[\w?=&#/%-]*/i;
  if (mpPattern.test(content) || wxPattern.test(content)) return 'mp_article';

  // Check for general URLs in text
  const urlPattern = /https?:\/\/[^\s]+/i;
  if (urlPattern.test(content)) return 'link';

  return 'text';
}

/* ─── tag detection ───────────────────────────────────────── */

const BIO_KEYWORDS = /医学|临床|基因|蛋白/;
const AI_KEYWORDS = /AI|大模型|LLM|Agent/i;
const TODO_KEYWORDS = /提交|完成|安排|任务/;
const REMIND_KEYWORDS = /截止|DDL|之前|到期/i;

// Date/time patterns: YYYY-MM-DD, 明天, 后天, 下周X, etc.
const DATE_PATTERN = /\d{4}-\d{2}-\d{2}|明天|后天|下周/;

/**
 * Classify a message into { major_tag, minor_tag }.
 */
function classify(content) {
  // ── action tags first (higher priority) ──
  if (TODO_KEYWORDS.test(content)) {
    return { major_tag: 'action', minor_tag: 'todo' };
  }
  if (REMIND_KEYWORDS.test(content) || DATE_PATTERN.test(content)) {
    return { major_tag: 'action', minor_tag: 'reminder' };
  }

  // ── content tags ──
  if (BIO_KEYWORDS.test(content)) {
    return { major_tag: 'content', minor_tag: 'bio' };
  }
  if (AI_KEYWORDS.test(content)) {
    return { major_tag: 'content', minor_tag: 'ai' };
  }

  // ── fallback: short text → note, long text → other ──
  if (content.length <= 100) {
    return { major_tag: 'action', minor_tag: 'note' };
  }

  return { major_tag: 'content', minor_tag: 'other' };
}

module.exports = { detectType, classify };
