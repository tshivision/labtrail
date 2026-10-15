// Private usage numbers. Open /api/stats?token=YOUR_ADMIN_TOKEN (add &html=1 for a table).
const { redis, hasRedis, day } = require('./_lib');
const FIELDS = ['visits', 'ok', 'error', 'limited', 'images'];
module.exports = async (req, res) => {
  const token = process.env.ADMIN_TOKEN;
  const given = req.query.token || (req.headers.authorization || '').replace(/^Bearer /, '');
  if (!token || given !== token) return res.status(401).json({ error: 'unauthorized' });
  if (!hasRedis()) return res.status(200).json({ error: 'Redis is not connected yet' });
  const days = Array.from({ length: 14 }, (_, i) => day(i));
  const codes = String(process.env.ACCESS_CODES || '').split(',').map((x) => x.trim().split(':')[0]).filter(Boolean);
  const cout = codes.length ? await redis(codes.flatMap((c) => days.map((d) => ['GET', `stat:${d}:code:${c}`]))) : [];
  const byCode = Object.fromEntries(codes.map((c, ci) => [c, days.reduce((a, _, di) => a + Number(cout[ci * days.length + di] || 0), 0)]));
  const out = await redis(days.flatMap((d) => FIELDS.map((f) => ['GET', `stat:${d}:${f}`])));
  const rows = days.map((d, i) => {
    const o = { day: d };
    FIELDS.forEach((f, j) => (o[f] = Number(out[i * FIELDS.length + j] || 0)));
    return o;
  });
  const total = rows.reduce((a, r) => { FIELDS.forEach((f) => (a[f] = (a[f] || 0) + r[f])); return a; }, {});
  if (req.query.html) {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    return res.status(200).send(`<!doctype html><meta name=viewport content="width=device-width"><title>Labtrail stats</title><style>body{font:15px system-ui;margin:24px}td,th{padding:6px 12px;text-align:right}th:first-child,td:first-child{text-align:left}</style><h1>Labtrail usage, last 14 days</h1><table><tr><th>Day<th>Visits<th>Reports read<th>Errors<th>Hit limit<th>Pages read</tr>${rows.map((r) => `<tr><td>${r.day}<td>${r.visits}<td>${r.ok}<td>${r.error}<td>${r.limited}<td>${r.images}</tr>`).join('')}<tr><th>Total<th>${total.visits}<th>${total.ok}<th>${total.error}<th>${total.limited}<th>${total.images}</tr></table><p>Reports read by access code (14 days): ${Object.entries(byCode).map(([c, n]) => `${c}: ${n}`).join(", ") || "none"}</p><p>"Reports read" counts Claude calls (up to 3 pages each).`);
  }
  res.status(200).json({ total, byCode, days: rows });
};
