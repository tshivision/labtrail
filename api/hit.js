// Counts one visit per browser session. Stores a number, nothing about the visitor.
const { redis, hasRedis, day } = require('./_lib');
module.exports = async (req, res) => {
  if (req.method === 'POST' && hasRedis()) {
    try { await redis([['INCR', `stat:${day()}:visits`]]); } catch (e) {}
  }
  res.status(204).end();
};
