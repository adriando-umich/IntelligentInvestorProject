<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes - APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project Memory Workflow

Every AI working in this repository must read these files first, in order:

1. `docs/ai/source-of-truth.md`
2. `docs/ai/backlog.md`
3. `docs/ai/issues-and-resolutions.md`

If any file is missing, recreate it before continuing with other work.

After any session that changes code, config, schema, documentation, or product decisions, update all three files before ending the session.

If a file has no material change, still update its `Latest session delta` section with `No material change this session.`.

# Compression Policy

When any AI memory file grows beyond roughly `2000` lines:

- Compress it back toward `1300-1600` lines.
- Preserve current architecture, current env contract, active blockers, and open issues in full detail.
- Preserve the latest `10-15` sessions in the highest detail.
- Summarize older resolved history into dated rollups.

# Product Guardrails

- Do not merge `project cash custody`, `expense reimbursement`, `capital balance`, `operating P&L share`, and `profit received` into one unexplained number.
- Keep dashboard language plain and non-accounting-first.
- Any settlement suggestion UI must be labeled as shared-expense settlement, not profit distribution or capital return.
