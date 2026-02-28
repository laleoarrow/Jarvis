/**
 * AI Provider – pluggable text generation for Jarvis replies.
 *
 * Supported providers (via AI_PROVIDER env var):
 *   "github"  – GitHub Models / Copilot (requires GITHUB_TOKEN)
 *   "openai"  – Any OpenAI-compatible API (requires OPENAI_API_KEY)
 *   "none"    – Rule-based fallback (no external API)
 *
 * When the configured provider is unavailable or errors out,
 * Jarvis automatically falls back to the rule-based template.
 */

'use strict';

const PROVIDER_ENV = (process.env.AI_PROVIDER || 'none').toLowerCase();

/**
 * Generate a summary / reply for the given message context.
 *
 * @param {object} ctx
 * @param {string} ctx.content  – raw message
 * @param {string} ctx.type     – text|link|mp_article
 * @param {string} ctx.major_tag
 * @param {string} ctx.minor_tag
 * @returns {Promise<string>} – 1-3 line summary
 */
async function generateSummary(ctx) {
  let provider = PROVIDER_ENV;

  // Auto-upgrade to GitHub Copilot (AI) for complex texts/links if available
  if (provider === 'none' && (ctx.content.length > 100 || ctx.type === 'link' || ctx.type === 'mp_article')) {
    if (process.env.GITHUB_TOKEN) {
      provider = 'github';
    }
  }

  if (provider === 'github') {
    try {
      return await callGitHub(ctx);
    } catch (err) {
      console.error('[provider] GitHub Models error, falling back:', err.message);
    }
  }

  if (provider === 'openai') {
    try {
      return await callOpenAI(ctx);
    } catch (err) {
      console.error('[provider] OpenAI error, falling back:', err.message);
    }
  }

  return fallback(ctx);
}

/* ─── GitHub Models ───────────────────────────────────────── */

async function callGitHub(ctx) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN not set');

  const body = {
    model: 'openai/gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt() },
      { role: 'user', content: ctx.content },
    ],
    max_tokens: 200,
  };

  const res = await fetch('https://models.inference.ai.azure.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`GitHub Models ${res.status}`);
  const json = await res.json();
  return json.choices?.[0]?.message?.content?.trim() || fallback(ctx);
}

/* ─── OpenAI-compatible ───────────────────────────────────── */

async function callOpenAI(ctx) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt() },
      { role: 'user', content: ctx.content },
    ],
    max_tokens: 200,
  };

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`OpenAI API ${res.status}`);
  const json = await res.json();
  return json.choices?.[0]?.message?.content?.trim() || fallback(ctx);
}

/* ─── Fallback (rule-based) ───────────────────────────────── */

function fallback(ctx) {
  const tagLabel = `${ctx.major_tag}/${ctx.minor_tag}`;
  const snippet = ctx.content.slice(0, 60).replace(/\n/g, ' ');
  return `已收录 [${tagLabel}]：${snippet}`;
}

/* ─── System prompt ───────────────────────────────────────── */

function systemPrompt() {
  return `你是 Jarvis，一个高效的个人秘书 AI。用户会发送消息或任务给你。
请用 1-3 行中文简要概括消息内容。如果是任务/待办，提炼关键行动。
不要使用 markdown。保持简练。`;
}

module.exports = { generateSummary };
