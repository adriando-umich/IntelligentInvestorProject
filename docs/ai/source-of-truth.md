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

- Status: live-ready onboarding plus database-backed transaction entry implemented
- Runtime mode today: live Supabase when a real user signs in, with sample-workspace fallback through the demo cookie
- Target stack: Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Supabase
- Current data source:
  - live Supabase reads for signed-in users
  - live ledger-entry create on supported transaction types
  - local sample datasets when demo mode is chosen
- Current auth behavior:
  - Demo/sample mode still works without live auth
  - Supabase sign-in is wired
  - Supabase self-service sign-up is wired
  - Google OAuth client flow is wired from the sign-in screen
  - The sign-in screen now fetches Supabase public auth settings to reflect live provider availability
  - `/auth/callback` now exchanges the Supabase PKCE code into a cookie-backed session
  - Auth/profile sync now pulls `avatar_url` or `picture` from Google user metadata when available
  - Session refresh is now backed by a root `proxy.ts` plus `src/lib/supabase/proxy.ts`

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
  - Server client factory plus auth-profile sync helper
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
- Tagged inflow and expense rollups
- Live dataset loading from Supabase rows when env/session are available

The live ledger model already supports member-to-member repayment for shared expenses through the `expense_settlement_payment` entry type. The current UI now presents this in plain language as `Member repayment`, with explicit A-paid-for-B / B-pays-A-back guidance in the planner and settlements flow.
The transaction model now also exposes a second classification axis in code: `entryFamily = business | correction`. The persisted DB column is still `entry_type`, but the app now derives family labels and uses them in planner guidance and the transaction helper matrix.
The business-event shortcuts now include `shared_loan_interest_payment`, which behaves like a shared operating cost while staying distinct from shared-loan principal.
The ledger planner now lets users choose the entry family first, then narrows the entry-type picker accordingly. The planner currently supports `reconciliation_adjustment` inside the `correction` family, while `reversal` still remains guide-only until a dedicated original-entry workflow exists.
Project tags now have a dedicated management page for create, rename, and delete, rather than being attach-only from the planner.

## Current Routes

Implemented now and wired:

- `/`
- `/auth/callback`
- `/sign-in`
- `/projects`
- `/projects/new`
- `/projects/[projectId]`
- `/projects/[projectId]/ledger/guide`
- `/projects/[projectId]/ledger/new`
- `/projects/[projectId]/members/[memberId]`
- `/projects/[projectId]/settlements`
- `/projects/[projectId]/reconciliation`
- `/projects/[projectId]/tags`

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
- Additional live onboarding migration: `supabase/migrations/20260322101500_project_bootstrap.sql`
- Additional tags and shared-loan migration: `supabase/migrations/20260322130000_tags_and_shared_loans.sql`
- Additional entry-family and loan-principal migration: `supabase/migrations/20260322190000_entry_families_and_loan_principal.sql`
- Additional profile-avatar migration: `supabase/migrations/20260322213000_profile_avatars.sql`
- Additional shared-loan-interest migration: `supabase/migrations/20260322233000_shared_loan_interest_payment.sql`
- Additional project-tag delete-policy migration: `supabase/migrations/20260322234500_project_tag_delete_policy.sql`
- Additional project-creation-RLS migration: `supabase/migrations/20260322235500_project_creation_security_definer.sql`
- README deploy and env guidance: created
- GitHub remote: configured and pushed
- GitHub repo: `https://github.com/adriando-umich/IntelligentInvestorProject`
- Vercel project: `intelligent-investor-project`
- Production URL: `https://intelligent-investor-project.vercel.app`
- Live Supabase database: migrated through `20260322234500_project_tag_delete_policy.sql`
- Local and Vercel `NEXT_PUBLIC_SUPABASE_URL` were corrected from a bad project-ref typo to `https://rhvtfzrwgqwljhnpwxzj.supabase.co`
- Live Supabase Auth `site_url` is now `https://intelligent-investor-project.vercel.app`
- Live Supabase Auth redirect allow-list now includes:
  - `https://intelligent-investor-project.vercel.app/auth/callback`
  - `http://localhost:3000/auth/callback`
  - `http://127.0.0.1:3000/auth/callback`
- Vercel project access protection: disabled so the production deployment is public
- Verification status:
  - `npm run lint` passed
  - `npm run build` passed
- Public Supabase auth settings verified live:
  - email/password enabled
  - email confirmation required for new accounts (`mailer_autoconfirm = false`)
  - Google provider enabled

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
- Removed the public env/setup snapshot from the sign-in screen and replaced it with production-facing auth UX.
- Added self-service sign-up on `/sign-in`.
- Added live project onboarding through `/projects/new` plus the `create_project_with_owner` SQL function.
- Added Supabase SSR session refresh through `proxy.ts`.
- Added project tags plus entry-tag joins so inflows and expenses can be aggregated by tag.
- Added `shared_loan_drawdown` as a live transaction type for borrowed project cash that should not count as member capital.
- Added Google OAuth on the sign-in screen, backed by a Supabase browser client helper and a PKCE callback route.
- Added operator guidance in `README.md` for Google provider setup in Supabase and Google Cloud.
- Clarified the existing member-to-member repayment transaction in the UI by renaming `expense_settlement_payment` to `Member repayment` in user-facing copy and adding explicit reimbursement examples.
- Added `shared_loan_repayment_principal` as a non-P&L financing outflow for repaying shared loan principal.
- Added a transaction helper matrix on the ledger planner page so users can see, in one place, which cases are business events versus corrections and what each type affects.
- Added avatar sync from Supabase auth metadata and started rendering avatars in the workspace shell plus member-facing project UI.
- Fixed a follow-up regression where `/projects` crashed in demo mode because the server page was calling `buttonVariants()` from the client-only button module; the page now uses server-safe classes there and the avatar UI remains intact.
- Added chart-driven dashboard storytelling with plain-language visuals for cash bridge, capital ownership, cash custody, reimbursement balances, tag mix, profit outlook, and entry-family reporting.
- Added `shared_loan_interest_payment` as a dedicated transaction shortcut plus demo data that exercises shared loan drawdown, interest, and principal repayment.
- Fixed the live Supabase project URL typo in local and Vercel env so auth flows now point at the real project instead of a non-resolving hostname.
- Updated the sign-in screen to read live Supabase public auth settings so Google only appears when enabled and the create-account tab can warn when email confirmation is required.
- Moved the full transaction helper matrix off the planner onto its own `/ledger/guide` page and left compact references on the planner instead.
- Added an explicit `Business event / Correction` family picker to the planner and exposed `reconciliation_adjustment` as the live correction path there.
- Added a dedicated `/tags` page with create, rename, and delete tag management, plus a new additive migration for live delete-policy support.
- Reworked the main cash chart so each movement bar now represents its own amount directly, while `Cash now` remains a separate total bar. The previous cumulative waterfall styling was visually misleading for smaller steps like shared loan principal.
- Fixed the ordering bug in `20260321153000_finance_app_schema.sql` by creating the core tables before helper functions that reference them, then successfully applied the full migration stack to the live Supabase database.
- Enabled Google OAuth in the live Supabase project using the Supabase management API, updated the auth `site_url`, and added the production/local callback allow-list.
- Verified from the public auth settings endpoint that Google is enabled and from the production sign-in page that the `Continue with Google` button now renders live.
- Fixed the live first-project RPC so `create_project_with_owner` now runs as `security definer`, and applied an additive migration to update the real Supabase project.
- Current limitation: profit distribution still needs a dedicated live posting flow; the planner keeps that type preview-only.
- Current limitation: a fully manual end-to-end Google sign-in through the external consent screen has not yet been completed from this workspace.
- Current limitation: the create-project flow should be re-tested in the live UI after the new RLS fix, although the database function has been updated successfully.
