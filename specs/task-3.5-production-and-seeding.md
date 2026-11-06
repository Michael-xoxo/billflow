# SPEC: Task 3.5 - Production Hardening, Database Seeding & Autonomous Sub-Agent Rules

## GOAL
Hardwire the production build and static asset serving in server.js, build a idempotent database seeder script, and document the sub-agent execution harness.

## ACCEPTANCE CRITERIA
1. Server Production Serving (`server.js`):
   - When `NODE_ENV === 'production'`, serves static assets from `path.join(__dirname, 'client/dist')`.
   - Wildcard fallback `app.get('/{*splat}', ...)` sends `client/dist/index.html`.
2. Root Build Script (`package.json`):
   - `"build": "npm install && cd client && npm install --include=dev && npm run build"`
   - `"start": "node server.js"`
   - `"seed": "node scripts/seed.js"`
3. Seed Script (`scripts/seed.js`):
   - Connects to `MONGO_URI`.
   - Seeds a demo contractor account (`demo@billflow.io` / `Password123!`).
   - Seeds 2 Customers ("Starlight AI", "Apex Systems").
   - Seeds 4 Invoices:
     - 1x Paid (Recent, contributes to MRR).
     - 1x Paid (Older than 30 days).
     - 1x Pending.
     - 1x Draft.
   - Idempotent: Can be run multiple times without duplicating data (clears or updates demo records cleanly).
4. Sub-Agent Protocol Scaffolding (`AGENTS.md`):
   - Update `AGENTS.md` with explicit Sub-Agent roles (Agent Alpha: Backend Core, Agent Beta: Frontend UI, Agent Gamma: QA/Security Automator).
5. All automated verification suites pass under `NODE_ENV=production`.

## CONSTRAINTS
- Strict file scope: Update `server.js`, `package.json`, `AGENTS.md`, and create `scripts/seed.js`.
- Adhere to `AGENTS.md` Rules 1–7.

## STOPPING CONDITIONS
- Stop if static file serving intercepts `/api/*` routes.
- Stop if seed script generates floating-point values in database.

## BLAST RADIUS
MEDIUM (Touches production boot configuration).

## VERIFICATION STEPS
1. Run `npm run seed` -> verify script seeds clean demo data and exits 0.
2. Run `npm run build` from root -> verify both root and client build without errors.
3. Launch `NODE_ENV=production node server.js` on port 5000:
   - Request `GET /` -> verify HTTP 200 and HTML containing root div.
   - Request `GET /api/health` or `/api/analytics/summary` -> verify API routes respond correctly.