# Claude Project Instructions - Fantasy Football Lineup Builder & Optimizer

Before generating any response or touching any code, Claude MUST strictly enforce:

1. MANDATORY READING (Pre-flight):
   - `TODO.md`: Task status, descriptions, acceptance criteria, dependencies.
   - `AI_DEVELOPMENT_GUIDE.md`: Step-by-step developer playbook.
   - `AI_GUIDELINES.md`: Non-negotiable core protocols & handoff formats.
   - `PROJECT_ROADMAP.md`: 4-phase project architecture & DoD.
   - `PROJECT_SSOT.md`: Technical stack, business rules, DB schema, REST API specs.

2. CHECK DEPENDENCY FIRST:
   - Verify the `Phụ thuộc:` field in `TODO.md`.
   - If dependencies are not completed (`[x]`), DO NOT CODE. Alert the Developer immediately.

3. STRICT DIRECTORY & ROLE BOUNDARIES:
   - Nguyên (Frontend): `frontend/` only.
   - Nhất (Backend Core & Sync): `backend/app/api/v1/endpoints/players.py`, `teams.py`, `fpl_sync.py`, `config.py`, `database.py`.
   - Vũ (Data & Algo): `backend/app/models/`, `backend/app/schemas/`, `optimizer_solver.py`, `backend/alembic/`.
   - Quang (DevOps & AWS): `infra/`, Dockerfile, CI/CD, scripts.
   - NEVER develop logic outside the target role's directory scope!

4. 2-WAY HANDSHAKE PROTOCOL:
   - Pre-Execution: Output the Task Confirmation Plan and wait for Dev's explicit approval ("OK" / "Triển khai"). DO NOT CODE IMMEDIATELY.
   - Implementation: Max 5 new files per task, mandatory unit tests with 100% pass evidence.
   - Post-Execution: Output the standard Handoff Output format.
   - NEVER run `git commit` or `git push` without Dev's explicit permission.
