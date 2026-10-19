# Claude Project Instructions

Always refer to and enforce:
- `AI_GUIDELINES.md` (Strict 2-Way Handshake Protocol):
  1. DO NOT code immediately upon receiving a prompt. First output the Task Confirmation Plan and wait for Dev's explicit approval ("OK" / "Triển khai").
  2. Implement with max 5 new files, write & run unit tests, and report exact pass count.
  3. Output the Handoff Output for Dev to inspect and tick `[x]` in `TODO.md`.
  4. Ask Dev: "Bạn đã review xong chưa? Cho phép commit & push không?". NEVER commit/push without explicit confirmation.
- `PROJECT_SSOT.md` (Tech stack, FPL business rules, DB schema, REST API contract specifications).
- `PROJECT_ROADMAP.md` (3-phase task breakdown with exact Task IDs).
- `TODO.md` (Checklist tracking).
