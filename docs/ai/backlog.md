# Backlog

## Now

- Add `SUPABASE_ACCESS_TOKEN` so project-level auth/provider config can be pushed from this workspace
- Enable the Google provider in Supabase Auth and add the Google OAuth client ID/secret plus redirect URLs
- Validate the full live flow end-to-end:
  - sign up
  - sign in
  - sign in with Google
  - verify Google avatar appears in the shell after callback/login
  - create first project
  - create live transaction
  - create tagged transaction
  - create shared loan drawdown
  - create shared loan principal repayment
  - create shared loan interest payment
  - create, rename, and delete tags from the new tag manager page
  - verify the new dashboard charts and family filters with live data
- Add real update/create flows for reconciliation submissions and profit distributions
- Add member-management flow after project creation so teams can collaborate beyond the owner account

## Next

- Add richer settlement recording UX from the suggestions page beyond the current planner-prefill flow
- Add reconciliation manager actions and member submission forms
- Add profit distribution preview/post action backed by live balances
- Add richer allocation editing for shared income and expense lines
- Add a dedicated reversal flow that lets a user choose the original entry instead of keeping reversal guide-only
- Decide whether tag analytics should support multi-tag faceting only or one strict reporting category plus optional tags
- Confirm GitHub-triggered auto-deploy integration in Vercel if push-triggered deployments are desired

## Blocked

- Supabase management auth is still missing locally, so provider configuration cannot yet be executed from this workspace
- End-to-end Google sign-in validation still depends on the provider being enabled upstream in Supabase Auth

## Deferred

- Bank CSV import
- Global cross-project dashboard
- Multi-currency projects
- Automatic profit payout

## Latest Session Delta

- Completed the demo-first vertical slice requested in this session:
  - route tree
  - dashboard
  - member statement
  - ledger planner preview and live create on supported entry types
  - settlements page
  - reconciliation page
  - SQL migration
  - README
- Added live Supabase reads in the repository layer.
- Pushed code to GitHub and shipped a public Vercel production deployment.
- Added self-service sign-up and a real first-project creation flow.
- Removed public env/setup details from the live web UI.
- Added proxy-based Supabase session refresh for production reliability.
- Added tag creation/attachment in the ledger planner plus dashboard rollups for tagged inflows and expenses.
- Added a shared-loan transaction type for borrowed funds that should not count as capital contribution.
- Added a Google OAuth entry point on the sign-in screen plus the server callback route needed for Supabase SSR auth.
- Clarified that member-to-member reimbursement already exists in the ledger through the live `expense_settlement_payment` path, now presented as `Member repayment` in the UI.
- Added a second transaction-classification axis in code (`business` vs `correction`) and surfaced it through a helper matrix on the ledger planner page.
- Added `shared_loan_repayment_principal` for repaying bank principal without treating it as operating expense or capital return.
- Added avatar sync from Google metadata into profiles plus avatar rendering in the shell and member-facing UI.
- Fixed the `/projects` demo-mode crash after the avatar work by removing a client-only `buttonVariants()` call from the server page.
- Added dashboard visualizations for cash bridge, funding stack, custody, reimbursements, tag mix, profit outlook, and entry-family reporting.
- Added `shared_loan_interest_payment` as a dedicated shortcut and refreshed the sample workspace so those charts have meaningful financing data.
- Fixed the live Supabase URL typo in local + Vercel config and redeployed production so auth points at the real Supabase project.
- Updated the sign-in screen to read live Supabase public settings, hide Google when the provider is disabled, and warn that new accounts currently require email confirmation.
- Confirmed via the public auth settings endpoint that email auth is enabled, email confirmation is required, and Google auth is still disabled upstream in Supabase.
- Moved the bulky planner helper matrix to its own `/ledger/guide` page and left compact references in the planner so the form has more working room.
- Added a true family picker on the planner and surfaced `reconciliation_adjustment` as the current correction-type option there.
- Added a dedicated `/tags` management page and live server actions for create, rename, and delete, plus an additive delete-policy migration for Supabase.
- Reworked the main cash chart so each bar now maps to its own amount instead of a cumulative waterfall height that made smaller movements look larger than capital.
- Fixed the base migration ordering bug, then applied the entire live migration stack successfully to the real Supabase database.
- Confirmed after migration that the remote database is now up to date, while Google auth remains blocked only on the missing `SUPABASE_ACCESS_TOKEN`.
- Moved the remaining work to live auth-provider enablement, end-to-end real-user validation, member management, reconciliation write flows, profit-distribution write flows, and deeper tag-reporting decisions.
