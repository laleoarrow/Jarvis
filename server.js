/**
 * Jarvis – WeCom (企业微信) Personal Secretary
 *
 * Express.js callback server that receives messages from WeCom,
 * classifies them, manages todo items, and returns structured replies.
 */

'use strict';

const express = require('express');
const { parseStringPromise } = require('xml2js');

const wecomCrypto = require('./lib/wecom-crypto');
const { detectType, classify } = require('./lib/classifier');
const { tryCommand } = require('./lib/commands');
const { extractDue, generateICS } = require('./lib/ics');
const store = require('./lib/store');
const { formatReply } = require('./lib/formatter');
const { generateSummary } = require('./lib/provider');

/* ─── config ──────────────────────────────────────────────── */

const PORT = process.env.PORT || 3000;
const CORP_ID = process.env.WECOM_CORP_ID || '';
const TOKEN = process.env.WECOM_TOKEN || '';
const AES_KEY = process.env.WECOM_AES_KEY || '';

const app = express();

// WeCom sends application/xml
app.use('/wecom/callback', express.text({ type: ['text/xml', 'application/xml'] }));

/* ─── health check (also used to wake Render free instance) ─ */

app.get('/', (_req, res) => {
  res.send('ok – Jarvis is alive 🤖');
});

/* ─── debug: view all items in memory ─────────────────────── */

app.get('/debug/items', (_req, res) => {
  res.json(store.getAll());
});

/* ═════════════════════════════════════════════════════════════
   WeCom Callback – GET  (URL verification)
   ═════════════════════════════════════════════════════════════ */

app.get('/wecom/callback', (req, res) => {
  const { msg_signature, timestamp, nonce, echostr } = req.query;

  if (!msg_signature || !timestamp || !nonce || !echostr) {
    return res.status(400).send('missing params');
  }

  // Verify signature
  const computedSig = wecomCrypto.getSignature(TOKEN, timestamp, nonce, echostr);
  if (computedSig !== msg_signature) {
    console.error('[verify] signature mismatch', { computedSig, msg_signature });
    return res.status(403).send('signature mismatch');
  }

  // Decrypt echostr → return plain text for URL verification
  try {
    const { message } = wecomCrypto.decrypt(echostr, AES_KEY);
    console.log('[verify] URL verification OK, echostr decrypted');
    res.send(message);
  } catch (err) {
    console.error('[verify] decrypt failed:', err.message);
    res.status(500).send('decrypt error');
  }
});

/* ═════════════════════════════════════════════════════════════
   WeCom Callback – POST (receive message)
   ═════════════════════════════════════════════════════════════ */

app.post('/wecom/callback', async (req, res) => {
  const { msg_signature, timestamp, nonce } = req.query;
  const rawXml = req.body;

  if (!rawXml) {
    return res.status(400).send('empty body');
  }

  try {
    /* 1 — Parse outer XML to get <Encrypt> */
    const outerXml = await parseStringPromise(rawXml, { explicitArray: false });
    const encryptedText = outerXml.xml.Encrypt;

    /* 2 — Verify signature */
    const computedSig = wecomCrypto.getSignature(TOKEN, timestamp, nonce, encryptedText);
    if (computedSig !== msg_signature) {
      console.error('[msg] signature mismatch');
      return res.status(403).send('signature mismatch');
    }

    /* 3 — Decrypt → inner XML */
    const { message: innerXmlStr, corpId } = wecomCrypto.decrypt(encryptedText, AES_KEY);

    if (corpId !== CORP_ID) {
      console.error('[msg] corpId mismatch', { expected: CORP_ID, got: corpId });
      return res.status(403).send('corp id mismatch');
    }

    /* 4 — Parse inner XML → extract message fields */
    const innerXml = await parseStringPromise(innerXmlStr, { explicitArray: false });
    const msg = innerXml.xml;

    const msgType = msg.MsgType || 'text';
    const content = (msg.Content || msg.Title || msg.Description || '').trim();
    const fromUser = msg.FromUserName || 'unknown';
    const toUser = msg.ToUserName || '';

    console.log(`[msg] from=${fromUser} type=${msgType} content=${content.slice(0, 60)}`);

    /* 5 — Process: command or new item */
    let replyText;

    const cmd = tryCommand(content);
    if (cmd.handled) {
      replyText = cmd.reply;
    } else {
      replyText = await processNewItem(content, msgType);
    }

    /* 6 — Build reply XML, encrypt, respond */
    const replyXml = buildReplyXml(toUser, fromUser, replyText);
    const encryptedReply = wecomCrypto.encryptReplyXml(replyXml, TOKEN, AES_KEY, CORP_ID);

    res.set('Content-Type', 'application/xml');
    res.send(encryptedReply);

  } catch (err) {
    console.error('[msg] processing error:', err);
    res.status(500).send('internal error');
  }
});

/* ─── process a non-command message ───────────────────────── */

async function processNewItem(content, wecomMsgType) {
  // Classify
  const type = detectType(wecomMsgType, content);
  const { major_tag, minor_tag } = classify(content);

  // Extract due date (for action/todo or action/reminder)
  let due = null;
  let dueDate = null;
  let icsText = null;

  if (major_tag === 'action' && (minor_tag === 'todo' || minor_tag === 'reminder')) {
    const extracted = extractDue(content);
    due = extracted.due;
    dueDate = extracted.dueDate;

    if (dueDate) {
      icsText = generateICS({
        title: content.slice(0, 40),
        dueDate,
        description: content,
      });
    }
  }

  // Store
  const title = content.slice(0, 40);
  const item = store.addItem({
    content,
    type,
    major_tag,
    minor_tag,
    title,
    due,
    ics: icsText,
  });

  // Generate summary via AI provider (or fallback)
  const summary = await generateSummary({ content, type, major_tag, minor_tag });

  // Build standardised reply
  return formatReply({
    type,
    major_tag,
    minor_tag,
    title,
    due,
    todoId: item.id,
    ics: icsText,
    summary,
    next: major_tag === 'action'
      ? `回复 完成 ${item.id} / 延期 ${item.id} YYYY-MM-DD HH:mm / 1`
      : '回复 1 查看今日待办',
  });
}

/* ─── build plain-text reply XML ──────────────────────────── */

function buildReplyXml(toUser, fromUser, textContent) {
  const ts = Math.floor(Date.now() / 1000);
  return `<xml>
<ToUserName><![CDATA[${toUser}]]></ToUserName>
<FromUserName><![CDATA[${fromUser}]]></FromUserName>
<CreateTime>${ts}</CreateTime>
<MsgType><![CDATA[text]]></MsgType>
<Content><![CDATA[${textContent}]]></Content>
</xml>`;
}

/* ─── start ───────────────────────────────────────────────── */

// Only listen when running directly (not on Vercel serverless)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n🤖 Jarvis is live on port ${PORT}`);
    console.log(`   Health:   http://localhost:${PORT}/`);
    console.log(`   Callback: http://localhost:${PORT}/wecom/callback`);
    console.log(`   Debug:    http://localhost:${PORT}/debug/items\n`);
    console.log(`   AI Provider: ${process.env.AI_PROVIDER || 'none (rule-based fallback)'}`);
    console.log(`   CorpID: ${CORP_ID ? CORP_ID.slice(0, 6) + '***' : '⚠️  NOT SET'}\n`);
  });
}

// Export for Vercel serverless & Render
module.exports = app;
