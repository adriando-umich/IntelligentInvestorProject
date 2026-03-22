# Issues and Resolutions

## Open Issues

- The new `20260322101500_project_bootstrap.sql` migration has not yet been executed against the live Supabase database.
- The live Supabase path has not yet been validated end-to-end against a real project with real auth/session data.
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

## Repeated Pitfalls / Prevention Notes

- Split large file edits into smaller `apply_patch` operations to avoid Windows path/length errors.
- Read `docs/ai/*` first every session and update all three files before finishing.
- Follow App Router server/client boundaries carefully; keep data-loading in server components where possible.
- Avoid importing non-component utilities from client modules into server pages.
- With `react-hook-form` plus `z.coerce`, keep input and output types explicit to satisfy production type checking.
- For live Supabase writes that span ledger entries plus allocations, prefer one SQL RPC over multiple client-side inserts.
- When deploying from local with the Vercel CLI, ensure `.vercelignore` excludes `.env*` so local tokens are not uploaded as source files.
- Production UI should not surface deployment/env readiness details; keep setup guidance in docs and operator notes instead.

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
