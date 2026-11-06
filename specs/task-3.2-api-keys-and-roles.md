# SPEC: Task 3.2 - Programmatic API Key Management, Rate Limiting & Dual-Auth Guard

## GOAL
Implement an ApiKey model with SHA-256 hashed storage, build a dual-auth middleware that accepts either JWTs or live API keys, implement rate limiting, and enforce role/scope permissions.

## ACCEPTANCE CRITERIA
1. API Key Schema (`models/ApiKey.js`):
   - `user`: ObjectId (ref 'User', required)
   - `name`: String (required, e.g. "Zapier Integration")
   - `keyHash`: String (required, unique index, SHA-256 hash of secret key)
   - `prefix`: String (first 8 characters of key for display/identification)
   - `scopes`: Array of Strings (enum: ['invoices:read', 'invoices:write', 'customers:read', 'customers:write'], default: all)
   - `lastUsedAt`: Date
   - `timestamps`: true
2. Dual-Auth Middleware (`middleware/authGuard.js`):
   - Inspects `Authorization: Bearer <token>`.
   - If token starts with `sec_live_`:
     - Hashes token via `crypto.createHash('sha256').update(token).digest('hex')`.
     - Queries `ApiKey` collection. If found, updates `lastUsedAt` asynchronously and attaches `req.user` and `req.apiKeyScopes`.
     - If not found, returns HTTP 401.
   - If token is a standard JWT:
     - Verifies signature via `JWT_SECRET`, attaches `req.user`, and assigns wildcard scopes `['*']`.
   - Replaces or wraps `authMiddleware.js`.
3. API Key Generation & Management Controller (`controllers/apiKeyController.js` & `routes/apiKeyRoutes.js`):
   - `POST /api/keys`: Generates a random 32-byte secret prefixed with `sec_live_`, saves SHA-256 hash to database, and returns HTTP 201 with `{ _id, name, prefix, rawKey, scopes }`. Note: `rawKey` is returned only in this response.
   - `GET /api/keys`: Returns 200 with all keys for `req.user._id` displaying `_id`, `name`, `prefix`, `scopes`, and `createdAt` (never returning `keyHash`).
   - `DELETE /api/keys/:id`: Revokes an API key owned by `req.user._id`.
4. Rate Limiting Middleware (`middleware/rateLimiter.js`):
   - Tracks request count per identity (`req.user._id` or `keyHash`) over a 1-minute window.
   - Configurable default: 60 requests per minute.
   - When exceeded, returns HTTP 429 with `{ error: "Rate limit exceeded. Try again in X seconds." }` and attaches `Retry-After` header.
5. Scope Permission Middleware (`middleware/requireScope.js`):
   - Middleware factory: `requireScope('invoices:write')`.
   - Allows request if caller has `*` or the specific scope; returns HTTP 403 Forbidden if missing.

## CONSTRAINTS
- Strict backend scope: Modify only files in `models/`, `controllers/`, `routes/`, `middleware/`, and `server.js`.
- Plaintext API keys must never be saved to the database.
- Adhere to `AGENTS.md` Rules 1–7.

## STOPPING CONDITIONS
- Stop if SHA-256 hashes are reversible or logged in plaintext.
- Stop if rate limiter crashes on concurrent bursts.

## BLAST RADIUS
MEDIUM (Modifies the primary authorization pipeline for all protected routes).

## ADVERSARIAL VERIFICATION STEPS
1. User logs in via JWT and calls `POST /api/keys` to generate key "Prod CLI" -> verify response includes `rawKey` starting with `sec_live_`.
2. Inspect MongoDB -> verify only `keyHash` exists and `rawKey` is not stored in plaintext.
3. Access `GET /api/invoices` using `Authorization: Bearer <rawKey>` -> verify HTTP 200 and successful data retrieval.
4. Attempt to mutate invoice (`POST /api/invoices`) using a key provisioned with only `['invoices:read']` -> verify HTTP 403 Forbidden.
5. Fire 65 rapid requests within 5 seconds using the API key -> verify request 61+ returns HTTP 429 Too Many Requests with `Retry-After` header.
6. Delete/revoke key via `DELETE /api/keys/:id` -> verify subsequent calls with that key immediately return HTTP 401 Unauthorized.