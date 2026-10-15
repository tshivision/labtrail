// Reads lab reports / scans with Claude. Nothing from the request is stored or logged.
const { redis, hasRedis, day, ip } = require('./_lib');

const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5-5';
const DAILY_CAP = Number(process.env.DAILY_CAP || 600); // Claude calls per day, all users
const IP_LIMIT = Number(process.env.IP_LIMIT || 20); // Claude calls per day, per visitor IP
// ACCESS_CODES="friend1,friend2:100,vip" (optional ":limit" = Claude calls per day for that code).
const CODES = Object.fromEntries(String(process.env.ACCESS_CODES || '').split(',').map((s) => s.trim()).filter(Boolean).map((s) => { const [c, l] = s.split(':'); return [c, Number(l || process.env.CODE_LIMIT || 60)]; }));
const NEED_CODE = Object.keys(CODES).length > 0;
const ALLOW_UNLIMITED = process.env.ALLOW_UNLIMITED === '1'; // only for local testing

const fail = (res, status, code, message) => res.status(status).json({ code, message });

module.exports = async (req, res) => {
  if (req.method !== 'POST') return fail(res, 405, 'failed', 'POST only');
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return fail(res, 500, 'failed', 'Server is not configured');

  const { prompt, images } = req.body || {};
  if (typeof prompt !== 'string' || !prompt.startsWith('You are reading') || prompt.length > 9000)
    return fail(res, 400, 'failed', 'Bad request');
  if (!Array.isArray(images) || images.length < 1 || images.length > 3)
    return fail(res, 400, 'failed', 'Bad request');
  for (const im of images) {
    if (!im || !/^image\/(jpeg|png|webp|gif)$/.test(im.media_type) || typeof im.data !== 'string' || im.data.length > 2_200_000)
      return fail(res, 400, 'image_rejected', 'Bad image');
  }

  const given = String(req.headers['x-access-code'] || '').trim();
  if (NEED_CODE && !Object.prototype.hasOwnProperty.call(CODES, given)) return fail(res, 401, 'need_code', 'Access code required');
  const d = day();
  const capKey = `cap:${d}`;
  const ipKey = NEED_CODE ? `code:${d}:${given}` : `ip:${d}:${ip(req)}`;
  const myLimit = NEED_CODE ? CODES[given] : IP_LIMIT;
  let counted = false;
  if (hasRedis()) {
    try {
      const [cap, mine] = await redis([['INCR', capKey], ['INCR', ipKey], ['EXPIRE', capKey, 172800], ['EXPIRE', ipKey, 172800]]);
      counted = true;
      if (cap > DAILY_CAP || mine > myLimit) {
        await redis([['DECR', capKey], ['DECR', ipKey], ['INCR', `stat:${d}:limited`]]);
        return fail(res, 429, 'limit', 'Daily limit reached');
      }
    } catch (e) {
      return fail(res, 503, 'too_busy', 'Limiter unavailable');
    }
  } else if (!ALLOW_UNLIMITED) {
    return fail(res, 503, 'too_busy', 'Usage limiter is not set up');
  }

  const refund = async (stat) => {
    if (!hasRedis()) return;
    try {
      const cmds = [['INCR', `stat:${d}:${stat}`]];
      if (counted && stat === 'error') cmds.push(['DECR', capKey], ['DECR', ipKey]);
      await redis(cmds);
    } catch (e) {}
  };

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      signal: AbortSignal.timeout(55000),
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 6000,
        messages: [{
          role: 'user',
          content: [
            ...images.map((im) => ({ type: 'image', source: { type: 'base64', media_type: im.media_type, data: im.data } })),
            { type: 'text', text: prompt },
          ],
        }],
      }),
    });
    if (!r.ok) {
      await refund('error');
      if (r.status === 429 || r.status === 529) return fail(res, 503, 'too_busy', 'Busy');
      if (r.status === 400) return fail(res, 400, 'image_rejected', 'Image rejected');
      return fail(res, 502, 'failed', 'Upstream error');
    }
    const j = await r.json();
    const text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
    const m = text.match(/\{[\s\S]*\}/);
    let result = null;
    try { result = m && JSON.parse(m[0]); } catch (e) {}
    if (!result) { await refund('error'); return fail(res, 502, 'invalid_json', 'Unreadable result'); }
    if (hasRedis()) {
      try { await redis([['INCR', `stat:${d}:ok`], ['INCRBY', `stat:${d}:images`, images.length]].concat(NEED_CODE ? [['INCR', `stat:${d}:code:${given}`]] : [])); } catch (e) {}
    }
    return res.status(200).json({ result });
  } catch (e) {
    await refund('error');
    return fail(res, 504, 'failed', 'Timed out');
  }
};
