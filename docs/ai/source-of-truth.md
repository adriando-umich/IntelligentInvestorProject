# Source of Truth

## Purpose

Project Current is a plain-language finance workspace for project teams. It tracks:

- Project cash custody by member
- Shared-expense reimbursement balances between members
- Capital invested by member
- Operating P&L share by member
- Profit already distributed

The app must keep those concepts separate in both data and UI.

## Current State

- Status: demo-first vertical slice implemented
- Runtime mode today: demo-first with mock datasets in repo, plus Supabase schema prepared
- Target stack: Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Supabase
- Current data source: local demo repository in `src/lib/data/`
- Current auth behavior:
  - Demo mode works without Supabase env
  - Supabase password auth is wired for later use

## Current Architecture

- `src/app/`
  - App Router entrypoints and server actions
- `src/components/app/`
  - Shell, sign-in, page-level framing
- `src/components/finance/`
  - Finance dashboard and statement UI
- `src/lib/finance/`
  - Domain types and derived-balance engine
- `src/lib/data/`
  - Demo datasets, repository layer, and Supabase-backed dataset loader
- `src/lib/supabase/`
  - Server client factory
- `supabase/migrations/`
  - SQL schema for live backend bootstrap
- `vercel.json`
  - Forces the Vercel project to use the Next.js framework preset
- `.vercelignore`
  - Prevents local `.env*` files and bulky local artifacts from being uploaded during CLI deploys

## Current Data Model In Code

- Projects
- Project members
- Ledger entries
- Ledger allocations
- Profit distribution runs and lines
- Reconciliation runs and checks

The finance engine already derives:

- `projectCashCustody`
- `expenseReimbursementBalance`
- `capitalBalance`
- `operatingPnlShare`
- `profitReceivedTotal`
- `undistributedProfit`
- Splitwise-style settlement suggestions
- Live dataset loading from Supabase rows when env/session are available

## Current Routes

Implemented now and wired:

- `/`
- `/sign-in`
- `/projects`
- `/projects/[projectId]`
- `/projects/[projectId]/ledger/new`
- `/projects/[projectId]/members/[memberId]`
- `/projects/[projectId]/settlements`
- `/projects/[projectId]/reconciliation`

## Current Env Contract

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Only `.env.example` should be committed.

## Deployment State

- GitHub-safe env template: created
- Supabase runtime wiring: partial but now supports live reads plus live create on main ledger entry types
- Supabase SQL migration: created at `supabase/migrations/20260321153000_finance_app_schema.sql`
- README deploy and env guidance: created
- GitHub remote: configured and pushed
- GitHub repo: `https://github.com/adriando-umich/IntelligentInvestorProject`
- Vercel project: `intelligent-investor-project`
- Production URL: `https://intelligent-investor-project.vercel.app`
- Vercel project access protection: disabled so the production deployment is public
- Verification status:
  - `npm run lint` passed
  - `npm run build` passed

## Product Guardrails

- Never merge cash custody, reimbursement, capital, P&L share, and profit paid into one unexplained number.
- Settlement UI must be labeled as shared-expense settlement.
- Default dashboard language must be non-accounting-first.

## Latest Session Delta

- Created the required `docs/ai/*` memory files and enforced the workflow in `AGENTS.md`.
- Implemented the route tree for sign-in, projects, project dashboard, member statement, ledger planner, settlements, and reconciliation.
- Implemented plain-language finance UI with shadcn/ui cards, tables, tabs, and responsive shell.
- Added server-side session gating with demo-cookie fallback and Supabase session support.
- Added `not-found` UX and refreshed layout/global theming for the finance app.
- Added Supabase migration and refreshed `README.md`.
- Verified that lint and production build both pass.
- Added Supabase-backed dataset loading in the repository layer when live env/session are present.
- Added a transactional RPC-based live create flow for ledger entries from the planner.
- Pushed the repo to GitHub.
- Created and linked a Vercel project, deployed production, set public envs, set `NEXT_PUBLIC_APP_URL`, and redeployed.
- Fixed Vercel serving issues by disabling project SSO protection, adding `.vercelignore`, and forcing `framework: \"nextjs\"` in `vercel.json`.
- Current limitation: profit distribution still needs a dedicated live posting flow; the planner keeps that type preview-only.
