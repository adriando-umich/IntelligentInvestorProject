# Backlog

## Now

- Validate the new SQL migration plus RPC against a live Supabase project
- Add real update/create flows for reconciliation submissions and profit distributions
- Add seed data or onboarding flow for the first real workspace
- Connect GitHub auto-deploy integration in Vercel if push-triggered deployments are desired

## Next

- Add richer settlement recording UX from the suggestions page beyond the current planner-prefill flow
- Add reconciliation manager actions and member submission forms
- Add profit distribution preview/post action backed by live balances
- Add richer allocation editing for shared income and expense lines

## Blocked

- No hard blocker right now
- Live backend validation still depends on a real Supabase project and env configuration

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
- Moved the remaining work to backend validation, reconciliation write flows, and profit-distribution write flows.
