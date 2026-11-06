/**
 * In-Memory Fixed-Window Rate Limiting Middleware
 * Tracks request counts per identity (keyHash or user._id) over a 1-minute window.
 */

const WINDOW_MS = 60 * 1000; // 1 minute
const DEFAULT_LIMIT = 60; // 60 requests per minute

const buckets = new Map();

function createRateLimiter(options = {}) {
  const maxRequests = options.max || DEFAULT_LIMIT;
  const windowMs = options.windowMs || WINDOW_MS;

  return function rateLimiter(req, res, next) {
    const now = Date.now();
    const identity =
      req.apiKeyHash ||
      (req.user && req.user._id ? String(req.user._id) : null) ||
      req.ip ||
      'anonymous';

    let entry = buckets.get(identity);
    if (!entry || now >= entry.resetAt) {
      entry = {
        count: 0,
        resetAt: now + windowMs
      };
      buckets.set(identity, entry);
    }

    entry.count += 1;

    const remainingSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));

    if (entry.count > maxRequests) {
      res.set('Retry-After', String(remainingSeconds));
      return res.status(429).json({
        error: `Rate limit exceeded. Try again in ${remainingSeconds} seconds.`
      });
    }

    return next();
  };
}

const defaultRateLimiter = createRateLimiter();
defaultRateLimiter.createRateLimiter = createRateLimiter;
defaultRateLimiter.resetBuckets = () => buckets.clear();

module.exports = defaultRateLimiter;
