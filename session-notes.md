# Session Notes — BillFlow (Project 3)

## Task 3.1 & Task 3.2 — Backend Financial Engine, Dual-Auth & Rate Limiting

- **Architectural Decision Made**: Implemented a unified Dual-Auth pipeline in `middleware/authGuard.js` that inspects the `Bearer` credential prefix to route `sec_live_` tokens through SHA-256 hash lookup (`ApiKey` collection with explicit `select: false` on `keyHash`) and standard tokens through stateless JWT verification, normalizing downstream authorization via `req.apiKeyScopes` (`['*']` for JWTs, explicit scope array for API keys) and per-identity fixed-window rate limiting (`req.apiKeyHash` or `req.user._id`).
- **Friction Point / Bug Encountered**: In Mongoose 9 (`^9.12.0`), schema `pre('save')` and `pre('validate')` hooks no longer pass a `next()` callback to async/synchronous hook functions by default, and setting `select: false` on `ApiKey.keyHash` requires explicitly chaining `.select('+keyHash')` inside the authentication guard query while keeping `GET /api/keys` guaranteed free of hash leakage.
