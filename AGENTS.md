# SYSTEM RULES & SUB-AGENT TOPOLOGY

RULE 1 — SPECIFICATION-DRIVEN ISOLATION
All tasks must follow an explicit spec in `/specs/`. Sub-agents are strictly isolated to their declared directory domains. Cross-domain alterations are forbidden.

RULE 2 — CONTRACT CONVERGENCE
Backend and Frontend interact solely through verified data schemas defined in `/specs/contracts/`.

RULE 3 — RED ZONE HALT
Halt and request user clearance before executing changes touching payment/webhook validation logic, financial calculations, database schemas, or secret key parsing.

RULE 4 — INTEGER-ONLY CURRENCY INVARIANT
All currency representations within the database and API payloads must be whole integers representing the smallest currency unit (e.g., cents: $50.00 = 5000). Floating-point values are prohibited in persistence and computation.

RULE 5 — IDEMPOTENCY BY DEFAULT
All incoming webhook events and charge mutations must check against an idempotency ledger before execution to guarantee zero duplicate state changes on network retries.

RULE 6 — EVIDENCE-BASED COMPLETION
A task is verified only through executable proof: exact files modified, diff summary, and execution command outputs demonstrating success and failure handling.

RULE 7 — SESSION LESSONS LOG
At session wrap-up, append to session-notes.md:
- One architectural decision made
- One friction point / bug encountered