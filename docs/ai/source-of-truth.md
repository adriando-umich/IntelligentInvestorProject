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
- Current visual language: light Splitwise-inspired finance UI with softer Apple-style surfaces, mint primary accents, pill controls, and mobile-safe spacing
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
  - Shell, sign-in, page-level framing, and global locale switcher
- `src/components/finance/`
  - Finance dashboard, statement UI, and reusable finance-table toolbars
- `src/lib/finance/`
  - Domain types and derived-balance engine
- `src/lib/data/`
  - Demo datasets, repository layer, and Supabase-backed dataset loader
- `src/lib/supabase/`
  - Server client factory plus auth-profile sync helper
- `src/lib/i18n/`
  - Locale config, cookie-backed server locale lookup, and shared EN/VI message seed data
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
Project members can now exist as `active` or `pending_invite`. Pending members get a stable `project_member_id` before account acceptance so expenses can be allocated to them before they join, then keep the same history after invite acceptance.
Live cash-leg storage now keys ledger custody fields by `project_member_id` first, while legacy `cash_in_member_id` / `cash_out_member_id` user references remain as backward-compatible mirrors when a joined user exists. This lets pending members appear in every person-related field, including cash-holder selectors, without rewriting history when they accept later.
The transaction model now also exposes a second classification axis in code: `entryFamily = business | correction`. The persisted DB column is still `entry_type`, but the app now derives family labels and uses them in planner guidance and the transaction helper matrix.
The business-event shortcuts now include `shared_loan_interest_payment`, which behaves like a shared operating cost while staying distinct from shared-loan principal.
The ledger planner now lets users choose the entry family first, then narrows the entry-type picker accordingly. The planner currently supports `reconciliation_adjustment` inside the `correction` family, while `reversal` still remains guide-only until a dedicated original-entry workflow exists.
The ledger planner keeps guide/tag navigation in a single page-level support card above the form, instead of duplicating those actions inside the form body. On mobile, the support buttons and the bottom planner actions stretch full width for easier tapping.
The ledger planner now only shows the cash-leg selectors that matter for the chosen entry type. For example, `capital_contribution` shows only the receiving custody field plus `capital owner`, while `capital_return` shows only the paying custody field plus `capital owner`.
Project tags now have a dedicated management page for create, rename, and delete, rather than being attach-only from the planner.
Primary table-heavy surfaces now use a shared toolbar pattern with search, filter, sort, and wider scroll-safe table shells. Search is accent-insensitive so Vietnamese users can search with or without diacritics.
Reconciliation now has a real write workflow: managers can open a run, members can submit reported cash, managers can accept a variance or post an adjustment directly into the ledger, and managers can close the run once no pending or unresolved variance rows remain.
The dashboard header now uses one section-navigation system only; the secondary CTA row was reduced to true actions so it no longer duplicates the section tabs.

## Current Routes

Implemented now and wired:

- `/`
- `/auth/callback`
- `/join/[inviteToken]`
- `/sign-in`
- `/projects`
- `/projects/new`
- `/projects/[projectId]`
- `/projects/[projectId]/ledger/guide`
- `/projects/[projectId]/ledger/new`
- `/projects/[projectId]/members`
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
- Additional project-invite migration: `supabase/migrations/20260323003000_project_invites.sql`
- Additional pending-project-member migration: `supabase/migrations/20260323023000_pending_project_members.sql`
- README deploy and env guidance: created
- GitHub remote: configured and pushed
- GitHub repo: `https://github.com/adriando-umich/IntelligentInvestorProject`
- Vercel project: `intelligent-investor-project`
- Production URL: `https://intelligent-investor-project.vercel.app`
- Live Supabase database: migrated through `20260323040000_cash_legs_by_project_member.sql`
- Latest production deployment for commit `5c3950c`: ready and promoted on Vercel
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
- Every user-facing UI surface should ship in both English and Vietnamese.
- Vietnamese copy should stay natural and plain-language-first, not literal accounting jargon.

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
- Added a persistent project-section navigation layout so the same overview/settlements/tags/members/capital/reconciliation/advanced nav stays visible across project subpages.
- Added live project invites with `/projects/[projectId]/members` plus a public `/join/[inviteToken]` acceptance route.
- Added stable pending project members so targeted invite links can create a member row before acceptance, shared expenses can be assigned before join, and invite acceptance later activates the same `project_member_id` instead of creating a second row.
- Applied `supabase/migrations/20260323023000_pending_project_members.sql` to the live Supabase project and backfilled existing targeted invites so old invite links now map to the correct pending member rows.
- Verified live on `Vinh Truong` and `Nha Trang 02` that the same email invited into two different projects now maps to two different pending `project_member` rows, one per project, with each old invite linked to the correct row.
- Verified end-to-end on the live database with a disposable test project that an expense allocated to a pending member before invite acceptance still points to the exact same `project_member_id` after the invite is accepted.
- Pushed the pending-member flow commit to both `main` and `master`, then promoted a new production Vercel deployment from that commit. Git-based API-triggered deployments failed with `git_info_fail`, so the working deployment path for this session was uploaded-file deployment through the Vercel API.
- Updated email/password auth forms to preserve `next` redirects, so invite links can return users to the accept page after sign-in.
- Added a cookie-backed EN/VI locale layer with a global language switcher and flag buttons in the root layout.
- Made currency/date/percent formatting locale-aware and started threading locale through dashboard, planner, statements, invites, tags, settlements, reconciliation, and project-management screens.
- Added route- and component-level bilingual copy for the main signed-in workflows so English and Vietnamese can be toggled across the current UI.
- Added a shared finance table toolbar/shell pattern and applied it to transactions, transaction guide, members, invites, tags, settlements, and reconciliation tables.
- Added accent-insensitive search normalization so Vietnamese users can search naturally with or without diacritics across the new table toolbars.
- Updated the transaction-guide search index to include both English and Vietnamese labels/examples/effects at the same time, so users can search across languages without first toggling locale.
- Replaced the dashboard's old recent-activity cards with a sortable/filterable transactions table and tightened table min-width handling so horizontal scroll is explicit on denser views.
- Added a dedicated reconciliation workflow migration plus server actions/UI for opening runs, member submissions, manager variance resolution, automatic adjustment posting, and run closing.
- Applied `supabase/migrations/20260323013000_reconciliation_workflow.sql` to the live Supabase project and confirmed a follow-up dry run reports the remote database is up to date.
- Simplified the dashboard action row so it no longer acts like a second section-tab navigation strip.
- Trimmed the dashboard action row further so it now keeps only true actions (`Add transaction`, guide, invite members) and leaves tag/reconciliation/members browsing to the main section nav.
- Trimmed the ledger planner so `Open transaction guide` and `Manage tags` now appear only once in a page-level support card, then made the support buttons and bottom planner actions stack full-width on mobile.
- Added `docs/manual-qa/ledger-planner-ui-ux.md` as the manual desktop/tablet/phone validation flow for `/projects/[projectId]/ledger/new`.
- Fixed a follow-up planner UX bug where capital contribution still showed both `Money out by` and `Money in to`; the planner now hides irrelevant cash-leg fields per entry type and adds clearer capital-specific helper copy.
- Added and applied `supabase/migrations/20260323040000_cash_legs_by_project_member.sql`, so cash-holder fields now persist by `project_member_id` and can safely include pending members before they join.
- Verified on a disposable live project that a pending member can be used in `capital owner`, `cash in`, and `cash out`, then accept the invite later without changing the stored `project_member_id` on those earlier entries.
- Pushed commit `5c3950c` to both `main` and `master`, then promoted a new production Vercel deployment from that exact commit. The first uploaded-file attempt failed because Windows path separators were preserved in the API payload; the succeeding deployment normalized file paths to forward slashes before upload.
- Refreshed the app-wide design system toward a Splitwise-meets-Apple look by updating global tokens, buttons, cards, tabs, inputs, tables, the workspace shell, project nav, sign-in, create-project, and project-list surfaces.
- Re-verified the refreshed UI on a production build with `next build`; the new theme keeps pill controls and full-width actions at narrow breakpoints for mobile usability.
- Pushed the theme refresh commit `ffb036c` to GitHub, confirmed git-based Vercel production deploys still fail with `git_info_fail`, then created a production uploaded-files deployment `dpl_kDd6adcCQ3Vs8Sh83JhhG367vjWo` that reached `READY` / `PROMOTED`.
- Verified both the preview deployment and `https://intelligent-investor-project.vercel.app/sign-in` now render the new theme markers from the refreshed sign-in hero, confirming production is serving the Splitwise/Apple visual update.
- Current limitation: profit distribution still needs a dedicated live posting flow; the planner keeps that type preview-only.
- Current limitation: a fully manual end-to-end Google sign-in through the external consent screen has not yet been completed from this workspace.
