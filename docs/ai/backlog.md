# Backlog

## Now

- Apply the new `20260322101500_project_bootstrap.sql` migration to the live Supabase project
- Validate the full live flow end-to-end:
  - sign up
  - sign in
  - create first project
  - create live transaction
- Add real update/create flows for reconciliation submissions and profit distributions
- Add member-management flow after project creation so teams can collaborate beyond the owner account

## Next

- Add richer settlement recording UX from the suggestions page beyond the current planner-prefill flow
- Add reconciliation manager actions and member submission forms
- Add profit distribution preview/post action backed by live balances
- Add richer allocation editing for shared income and expense lines
- Confirm GitHub-triggered auto-deploy integration in Vercel if push-triggered deployments are desired

## Blocked

- No hard blocker right now
- End-to-end validation still depends on the latest SQL migration being applied in the live Supabase project

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
- Moved the remaining work to live migration validation, member management, reconciliation write flows, and profit-distribution write flows.
