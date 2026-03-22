# Issues and Resolutions

## Open Issues

- The local and production app had been pointed at a mistyped Supabase hostname until the March 22 fix; auth should now use the correct project URL, but pending live flows still need revalidation against the real database.
- The live Supabase path has not yet been validated end-to-end against a real project with real auth/session data.
- A full manual Google sign-in round-trip with a real user account has not yet been completed from this workspace after enabling the provider.
- The new invite flow still needs one live end-to-end pass covering create invite, sign in from deep link, and accept invite.
- Profit distribution still has no dedicated live post flow.
- Large single `apply_patch` payloads can fail on Windows with command-length limits.
- GitHub-triggered auto deploy is not confirmed yet; the current working deployment path is Vercel CLI plus linked project
- Live sign-up/login behavior can still vary based on Supabase Auth settings such as email confirmation requirements.

## Resolved Issues

- AI memory workflow is now defined in root `AGENTS.md`.
- Public env contract is now documented via `.env.example`.
- Demo auth path is available when Supabase env is absent.
- The main route tree and dashboard screens are now implemented.
- The plain-language dashboard now keeps custody, reimbursement, capital, P&L share, and profit separate.
- Production verification passed with both `npm run lint` and `npm run build`.
- The repository layer can now read from Supabase when live env and session are available.
- The ledger planner can now save supported entry types through a transactional SQL RPC instead of previewing only.
- Initial Vercel deploy was unintentionally seeing local `.env` during build; resolved by adding `.vercelignore`.
- Vercel returned `401` because project SSO protection was enabled; resolved by clearing `ssoProtection` through the Vercel API.
- Vercel returned `404` on public routes while the project was treated as `Other`; resolved by forcing `framework: \"nextjs\"` in `vercel.json` and redeploying.
- The public sign-in UI was exposing setup-oriented env/readiness information; resolved by replacing it with production-facing auth and product messaging.
- Live users had no self-serve onboarding path after sign-in; resolved by adding sign-up plus first-project creation flow.
- Supabase SSR session refresh was not following the current proxy-based guidance; resolved by adding `proxy.ts` and `src/lib/supabase/proxy.ts`.
- The app had no structured way to aggregate inflows and expenses by tag; resolved by adding project tags, entry-tag joins, planner support, and dashboard rollups.
- Borrowed project cash from a shared bank loan was being forced into the wrong mental bucket; resolved by adding `shared_loan_drawdown` as a non-capital cash-in transaction type.
- Password auth was the only live sign-in path in the app UI; resolved by adding a Google OAuth button and PKCE callback route compatible with the current Supabase SSR setup.
- The reimbursement payment flow existed but was hidden behind overly technical wording; resolved by renaming the user-facing transaction copy to `Member repayment` and adding A/B payback examples in the planner and settlements page.
- The transaction enum was too flat to explain clearly to users; resolved in app code by adding a shared family classification (`business` vs `correction`) and a helper matrix on the planner page.
- Shared loan drawdown existed without an equally explicit principal-paydown type; resolved by adding `shared_loan_repayment_principal`.
- Google sign-in could succeed without the app persisting profile photos into workspace profiles; resolved in code by syncing avatar metadata and rendering avatars with a fallback.
- `/projects` started returning `500` in demo mode after the avatar rollout; resolved by removing a server-side call to `buttonVariants()` from the client-only button module.
- The dashboard was still table-heavy and hard to scan at a glance; resolved by adding plain-language charts for cash bridge, capital share, custody, reimbursements, tags, profit outlook, and entry-family reporting.
- Shared loan interest had to be forced through generic operating expense wording; resolved by adding `shared_loan_interest_payment` as its own business-event shortcut.
- The public sign-in screen could promise Google login even when the provider was disabled upstream; resolved by reading the Supabase public auth settings endpoint and only showing Google when it is actually enabled.
- The app had been configured with a Supabase project-ref typo that pointed auth at a non-resolving hostname; resolved by correcting `NEXT_PUBLIC_SUPABASE_URL` locally and in Vercel, then redeploying production.
- The helper matrix was taking too much vertical space inside the planner; resolved by moving it to a dedicated guide page and leaving only compact references in the planner.
- Tags existed only as planner attachments without a real management surface; resolved by adding a dedicated tag CRUD page plus server actions.
- The planner derived `business/correction` in code but did not let the user choose that axis first; resolved by adding a family picker and exposing `reconciliation_adjustment` directly from the planner.
- The main cash chart used cumulative waterfall positioning that made smaller steps like shared loan principal look taller than much larger funding amounts; resolved by switching the chart to direct movement bars plus a separate `Cash now` total bar.
- The base finance migration created helper functions before the tables they referenced, so the first live `db push` failed on `public.project_members`; resolved by moving the core table definitions earlier in `20260321153000_finance_app_schema.sql` and re-running the migration stack successfully.
- The live Supabase database had been missing all additive migrations for onboarding, tags, shared loans, entry families, avatars, shared loan interest, and tag delete policies; resolved by applying the full migration stack through `20260322234500_project_tag_delete_policy.sql`.
- Google OAuth had been wired in app code but disabled in the live Supabase project and still pointed at localhost for auth site URL; resolved by using the Supabase management API to enable Google, set `site_url` to production, and add the production/local callback allow-list.
- Creating the first project could fail live with `new row violates row-level security policy for table "projects"` because `create_project_with_owner` still ran as `security invoker`; resolved by shipping `20260322235500_project_creation_security_definer.sql` to replace the function as `security definer` and applying it to the live database.
- Project navigation tabs disappeared when users left the main dashboard for routes like `/reconciliation`; resolved by moving the project-section nav into a shared `[projectId]/layout.tsx` wrapper.
- There was no real way to add members after creating a project; resolved by adding `project_invites`, manager-created share links, email-restricted invites, revoke support, and a public `/join/[inviteToken]` accept page.
- Deep links like invite accept could lose their destination after email/password auth because server actions always redirected to `/projects`; resolved by adding hidden `nextPath` propagation through sign-in and sign-up actions.

## Repeated Pitfalls / Prevention Notes

- Split large file edits into smaller `apply_patch` operations to avoid Windows path/length errors.
- Read `docs/ai/*` first every session and update all three files before finishing.
- Follow App Router server/client boundaries carefully; keep data-loading in server components where possible.
- Avoid importing non-component utilities from client modules into server pages.
- With `react-hook-form` plus `z.coerce`, keep input and output types explicit to satisfy production type checking.
- For live Supabase writes that span ledger entries plus allocations, prefer one SQL RPC over multiple client-side inserts.
- When deploying from local with the Vercel CLI, ensure `.vercelignore` excludes `.env*` so local tokens are not uploaded as source files.
- Production UI should not surface deployment/env readiness details; keep setup guidance in docs and operator notes instead.
- When adding new live ledger capabilities, prefer additive SQL migrations over rewriting the original base schema so already-deployed Supabase projects can upgrade safely.
- For social auth on Supabase SSR, start OAuth from a browser client and finish the PKCE code exchange in a route handler that can persist auth cookies.
- When the ledger model is still stored as one enum in SQL, add a shared classification helper in app code instead of forcing a breaking schema rewrite mid-project.
- When social-auth metadata should survive beyond the current session, sync it into the app's profile table and gracefully tolerate older databases that have not received the new column yet.
- If a route is a server page, do not call styling helpers exported from client components; keep shared class builders server-safe or inline the classes on that page.
- When adding dashboard visuals, keep each chart tied to exactly one finance concept so the UI never collapses custody, reimbursement, capital, and profit into one ambiguous story.
- When live auth behavior matters, probe the Supabase public `/auth/v1/settings` endpoint before assuming providers or email-confirmation behavior from code alone.
- When a helper becomes reference-heavy, move it to its own route and leave just a clear link in the main workflow so the primary form stays spacious.
- If a finance chart is meant for plain-language reading, the visible bar height should map directly to the labeled amount unless the UI makes cumulative positioning unmistakably obvious.
- For first-time remote bootstrap migrations, sanity-check function/table ordering before assuming the CLI failure is an environment problem.
- When Supabase social auth looks wired in code but absent in production, check both the public `/auth/v1/settings` endpoint and the project-level auth config (`site_url`, provider enabled flag, callback allow-list).
- When a workflow depends on returning to a deep link after auth, preserve the `next` path consistently across OAuth, password sign-in, and sign-up.

## Latest Session Delta

- Logged and fixed several build-time integration issues:
  - RSC-safe imports for server pages
  - JSX quote/apostrophe escaping required by lint rules
  - `react-hook-form` and Zod type mismatch around `z.coerce.number()`
- Confirmed the repo now builds successfully after those fixes.
- Added Supabase-backed repository reads with demo fallback.
- Added `create_project_ledger_entry` RPC in the migration and wired the planner to call it for supported entry types.
- Pushed the repo to GitHub, created the Vercel project, set production env vars, deployed production, and verified the public sign-in route responds correctly.
- Added self-service sign-up, first-project creation, and proxy-based session refresh.
- Removed the public env/setup card from the sign-in screen so the live app no longer communicates internal env expectations on the web UI.
- Added a tag system for ledger entries and a shared-loan entry type that keeps borrowed money out of capital contribution.
- Added Google OAuth UI plus a Supabase callback handler, while logging the remaining external provider setup needed outside the repo.
- Clarified the existing member-to-member repayment flow so users can more easily record one teammate paying another teammate back.
- Added `shared_loan_repayment_principal`, a derived `business/correction` transaction family, and a planner helper matrix that explains which type to use and what each type affects.
- Added Google-avatar sync and UI rendering while logging that the new `profiles.avatar_url` column still needs its live migration applied.
- Fixed the resulting `/projects` server crash and re-verified the page in demo mode locally with the avatar shell still rendering fallback initials.
- Added visualization-driven dashboard analytics plus a live-save path for `shared_loan_interest_payment`, and logged the new migration requirement for production databases.
- Corrected the Supabase project URL typo in local and Vercel config after DNS verification showed the previously configured hostname did not resolve.
- Verified live Supabase public auth settings from the real project:
  - email/password enabled
  - `mailer_autoconfirm = false`
  - Google provider disabled
- Updated the sign-in screen so production no longer advertises Google auth unless the provider is actually enabled, and so the create-account flow warns that confirmation email is required.
- Logged that the remaining migration and Google-provider tasks are blocked on missing Supabase admin credentials rather than missing app code.
- Moved the planner helper matrix to a dedicated `/ledger/guide` route and kept only compact guide/tag references on the planner page.
- Added an explicit `Business event / Correction` picker to the planner and exposed `reconciliation_adjustment` as the current live correction option there.
- Added a dedicated `/tags` CRUD page, live tag-management server actions, and a new additive Supabase migration for project-tag delete policy.
- Reworked the main cash chart after user review showed the cumulative waterfall styling was visually misleading for shared loan vs capital.
- Applied the full migration stack to the live Supabase database and verified a follow-up `supabase db push --dry-run` now reports the remote database is up to date.
- Added `SUPABASE_ACCESS_TOKEN`, patched the live Supabase auth config, and verified that the public auth settings endpoint now reports Google enabled.
- Verified that the live production sign-in page now renders the `Continue with Google` button after the provider was enabled upstream.
- Investigated the live create-project failure from the UI screenshot, traced it to RLS being enforced inside `create_project_with_owner`, and applied a new live migration that changes the function to `security definer`.
- Added a shared project layout with persistent section navigation, then introduced a `/members` page and invite-backed self-join flow with a new live Supabase migration.
