/**
 * Scope Permission Middleware Factory
 * Allows request if caller holds wildcard '*' (JWT) or the required scope.
 */

function requireScope(requiredScope) {
  return function scopeMiddleware(req, res, next) {
    const scopes = Array.isArray(req.apiKeyScopes) ? req.apiKeyScopes : [];

    if (scopes.includes('*') || scopes.includes(requiredScope)) {
      return next();
    }

    return res.status(403).json({
      error: `Forbidden: missing required scope '${requiredScope}'`,
      message: `Forbidden: missing required scope '${requiredScope}'`
    });
  };
}

module.exports = requireScope;
module.exports.requireScope = requireScope;
