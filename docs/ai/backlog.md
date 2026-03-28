# Backlog

## Now

- Validate the full live flow end-to-end:
  - sign up
  - sign in
  - sign in with Google
  - verify Google avatar appears in the shell after callback/login
  - re-test create first project after the `create_project_with_owner` RLS fix
  - regression-test reusable invites versus targeted pending-member invites from `/members`
  - confirm pending-member UI rules in live data:
    pending members can be chosen in all person-related fields before join
    pre-join cash and capital records still stay on the same `project_member_id` after invite acceptance
  - create live transaction
  - create tagged transaction
  - create shared loan drawdown
  - create shared loan principal repayment
  - create shared loan interest payment
  - create, rename, and delete tags from the new tag manager page
  - verify the new dashboard charts and family filters with live data
- Verify the new full reconciliation workflow with a real signed-in project:
  - manager opens a run
  - member submits reported cash
  - manager accepts a variance
  - manager posts a reconciliation adjustment
  - manager closes the run
- Add the real live posting flow for profit distributions
- Add the remaining richer member management after invite acceptance:
  - manager/member role changes
  - invite resend UX
  - browser-level QA for the new ownership-transfer and remove-member flows
- Run a focused language QA pass in both English and Vietnamese on the live app:
  - check for any remaining English-only strings in less-frequent dashboard/chart states
  - tighten Vietnamese wording where it still sounds too literal or overly technical
  - confirm emoji flag rendering on Windows, macOS, iOS, and Android
- Run a live production QA pass on the new table toolbars:
  - transactions search/filter/sort
  - transaction guide search/filter/sort
  - members and invites search/filter/sort
  - tags search/filter/sort
  - settlements and reconciliation table search/filter/sort
- Run one live regression pass on order-sensitive same-day ledgers:
  - capital contribution, loan drawdown, and operating expense entered on the same date
  - confirm overview and settlements stay stable after refresh and on production
- Run one live regression pass on the new land-purchase model:
  - create a `land_purchase` entry from the planner
  - confirm `Estimated profit today` no longer drops for asset deployment
  - confirm `Team owes you / You owe team` only reflects liquid cash claims, not land already bought
  - export the audit workbook and verify the new asset-basis parity columns stay at 0
- Run one browser/device QA pass on the updated ledger planner using `docs/manual-qa/ledger-planner-ui-ux.md`:
  - desktop web
  - tablet
  - mobile phone
- Run one browser/device QA pass on the new Splitwise x Apple theme:
  - desktop dashboard, project list, and sign-in
  - iPhone-width sign-in, ledger planner, and members screens
  - contrast/readability check on mint accents, pills, and glass surfaces

## Next

- Add richer settlement recording UX from the suggestions page beyond the current planner-prefill flow
- Add reconciliation manager actions and member submission forms
- Add profit distribution preview/post action backed by live balances
- Add richer allocation editing for shared income and expense lines
- Add a dedicated reversal flow that lets a user choose the original entry instead of keeping reversal guide-only
- Decide whether tag analytics should support multi-tag faceting only or one strict reporting category plus optional tags
- Repair or replace the Vercel git-based deployment path; current git-source API deploy attempts fail with `git_info_fail`, while uploaded-file API deploys work
- Add a small scripted release helper around the new deployment runbook so exact-commit deploys and clean deploy worktrees become harder to skip

## Blocked

- End-to-end Google sign-in validation still depends on completing one real consent/login round-trip with a live Google account

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
- Added `SUPABASE_ACCESS_TOKEN`, enabled Google in live Supabase Auth, switched the auth `site_url` to production, and added the production/local callback allow-list.
- Confirmed through the public auth settings endpoint and the live sign-in page that Google auth is now exposed correctly in production.
- Fixed the live `create_project_with_owner` RPC by switching it to `security definer` in an additive migration after the UI hit `new row violates row-level security policy for table "projects"` during project creation.
- Added a persistent project-section nav layout and a new `/members` route so project navigation no longer disappears when opening subpages like reconciliation.
- Added live invite-link creation, revoke, and self-join acceptance flow backed by the new `project_invites` table and RPCs.
- Added a stable pending-member flow for targeted invites so cost allocations can be assigned before acceptance and still land on the same `project_member_id` after join.
- Applied the pending-member migration to the live Supabase project, backfilled existing targeted invites, and verified the real `Vinh Truong` plus `Nha Trang 02` projects now link old invite tokens to the correct per-project pending member rows.
- Verified on the live database with a disposable test project that a pending member can receive an expense allocation before join and then accept the invite later without changing the allocation's `project_member_id`.
- Pushed the pending-member flow commit to both `main` and `master`, then shipped production successfully through the Vercel uploaded-file deployment API after git-source deploy attempts failed with `git_info_fail`.
- Updated auth forms so email sign-in/sign-up preserve `next` redirects for invite acceptance and other deep links.
- Added a first-pass EN/VI localization layer with a global language switcher, locale cookie, and locale-aware formatting helpers.
- Localized the main route headers plus key finance surfaces including sign-in, projects, create-project, member statements, tags, invite acceptance, ledger guide/planner, settlements, reconciliation, and much of the dashboard/chart storytelling.
- Added reusable table search/filter/sort toolbars and wider table shells across the main finance tables, then QAed them locally on a production `next start` build.
- Added accent-insensitive search normalization for the new toolbar pattern so Vietnamese queries without diacritics still match intended rows.
- Kept follow-up bilingual UX polish on the backlog by extending the transaction-guide search index across both EN/VI copy at once, reducing the chance that a user must change locale before search works.
- Implemented the full reconciliation workflow in app code and SQL:
  - open run
  - member submit
  - manager accept variance
  - manager post ledger adjustment
  - close run
- Applied the new reconciliation workflow migration to the live Supabase project and confirmed a dry run shows the remote database is up to date.
- Simplified the dashboard header actions so they no longer duplicate the section navigation tabs.
- Trimmed the dashboard action row one step further so tag browsing also stays in the main section nav instead of appearing as a second pseudo-tab.
- Trimmed duplicate guide/tag CTAs from the ledger planner, left one support card above the form, and made the support + submit actions friendlier on mobile widths.
- Added `docs/manual-qa/ledger-planner-ui-ux.md` so future planner UI work has one stable desktop/mobile regression checklist.
- Tightened the planner so only relevant cash-leg fields show for each entry type, especially around capital contribution vs capital return.
- Added a project-member-backed cash-leg migration so pending members can now be selected in every person-related field, not just allocations and capital ownership, and verified that those rows still map to the same member after invite acceptance.
- Added owner-only project ownership transfer in the members screen, applied the live Supabase migration for it, and verified the RPC on a disposable live project.
- Added remove-member/deactivation support for active joined members, limited project-card counts and new-entry selectors to active memberships, verified the new RPC on a disposable live project, and promoted production deployment `dpl_5juQXS6xBRXnUThwdjvi1WKFp8z6`.
- Moved the remaining work to end-to-end real-user validation, the rest of member management, profit-distribution write flows, and deeper tag-reporting decisions.
- Refreshed the shared visual system toward a lighter Splitwise/Apple direction across the shell, auth, navigation, and top-level project surfaces, then re-ran `next build` successfully.
- Pushed the theme refresh commit `ffb036c`, then shipped it to production through a Vercel uploaded-files deployment after confirming the git-source deployment path still fails with `git_info_fail`.
- Added canonical deployment docs in `docs/operations/deployment-runbook.md` and `docs/operations/release-checklist.md`, then linked them from `README.md` so future releases know exactly what to deploy, in what order, and from which clean worktree.
- Added `land_purchase` as a separate business event, updated claim math so land/assets reduce liquid capital instead of operating profit, patched the audit workbook to track asset basis and shared-loan interest separately, and applied/backfilled the live Supabase changes for the obvious land-purchase rows.
