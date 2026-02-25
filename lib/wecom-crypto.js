/**
 * WeCom (企业微信) callback message crypto utilities.
 *
 * Implements verify-URL / decrypt / encrypt fully with
 * Node.js built-in `crypto` — no third-party wecom packages.
 *
 * References:
 *   https://developer.work.weixin.qq.com/document/path/90238
 *   https://developer.work.weixin.qq.com/document/path/90307
 */

'use strict';

const crypto = require('crypto');

/* ─── helpers ─────────────────────────────────────────────── */

/**
 * Decode the 43-char Base64-encoded EncodingAESKey to a 32-byte Buffer.
 */
function decodeAESKey(encodingAESKey) {
  return Buffer.from(encodingAESKey + '=', 'base64');
}

/**
 * PKCS#7 padding (block size = 32 for WeCom).
 */
function pkcs7Pad(buf) {
  const BLOCK = 32;
  const pad = BLOCK - (buf.length % BLOCK);
  return Buffer.concat([buf, Buffer.alloc(pad, pad)]);
}

/**
 * PKCS#7 unpadding.
 */
function pkcs7Unpad(buf) {
  const pad = buf[buf.length - 1];
  if (pad < 1 || pad > 32) return buf;
  return buf.slice(0, buf.length - pad);
}

/* ─── signature ───────────────────────────────────────────── */

/**
 * Compute the WeCom SHA-1 signature.
 * sort(token, timestamp, nonce, encrypt) → SHA1
 */
function getSignature(token, timestamp, nonce, encrypt) {
  const items = [token, timestamp, nonce, encrypt].sort();
  return crypto.createHash('sha1').update(items.join('')).digest('hex');
}

/* ─── decrypt ─────────────────────────────────────────────── */

/**
 * Decrypt an encrypted message (Base64 string) sent by WeCom.
 *
 * @param {string} encrypt   – Base64-encoded cipher text
 * @param {string} aesKeyB64 – 43-char EncodingAESKey
 * @returns {{ message: string, corpId: string }}
 */
function decrypt(encrypt, aesKeyB64) {
  const aesKey = decodeAESKey(aesKeyB64);
  const iv     = aesKey.slice(0, 16);

  const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);
  decipher.setAutoPadding(false);

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypt, 'base64')),
    decipher.final(),
  ]);

  const unpadded = pkcs7Unpad(decrypted);

  // Layout: 16-byte random + 4-byte msgLen (BE) + msg + corpId
  const msgLen = unpadded.readUInt32BE(16);
  const message = unpadded.slice(20, 20 + msgLen).toString('utf8');
  const corpId  = unpadded.slice(20 + msgLen).toString('utf8');

  return { message, corpId };
}

/* ─── encrypt ─────────────────────────────────────────────── */

/**
 * Encrypt a reply XML string for WeCom.
 *
 * @param {string} replyMsg   – plain XML to encrypt
 * @param {string} aesKeyB64  – 43-char EncodingAESKey
 * @param {string} corpId     – CorpID
 * @returns {string} Base64-encoded cipher text
 */
function encrypt(replyMsg, aesKeyB64, corpId) {
  const aesKey = decodeAESKey(aesKeyB64);
  const iv     = aesKey.slice(0, 16);

  const random  = crypto.randomBytes(16);
  const msgBuf  = Buffer.from(replyMsg, 'utf8');
  const lenBuf  = Buffer.alloc(4);
  lenBuf.writeUInt32BE(msgBuf.length, 0);
  const corpBuf = Buffer.from(corpId, 'utf8');

  const plain = pkcs7Pad(Buffer.concat([random, lenBuf, msgBuf, corpBuf]));

  const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, iv);
  cipher.setAutoPadding(false);

  return Buffer.concat([cipher.update(plain), cipher.final()]).toString('base64');
}

/* ─── high-level helpers ──────────────────────────────────── */

/**
 * Build the encrypted XML envelope to reply to WeCom.
 */
function encryptReplyXml(replyMsg, token, aesKeyB64, corpId) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce     = String(Math.floor(Math.random() * 1e10));

  const encryptedMsg = encrypt(replyMsg, aesKeyB64, corpId);
  const signature    = getSignature(token, timestamp, nonce, encryptedMsg);

  return `<xml>
<Encrypt><![CDATA[${encryptedMsg}]]></Encrypt>
<MsgSignature><![CDATA[${signature}]]></MsgSignature>
<TimeStamp>${timestamp}</TimeStamp>
<Nonce><![CDATA[${nonce}]]></Nonce>
</xml>`;
}

module.exports = {
  getSignature,
  decrypt,
  encrypt,
  encryptReplyXml,
};
