# Project Current

Project Current is a project-based finance tracker built to feel friendly for non-accountants. It is intentionally closer to Splitwise in workflow, but the underlying model is different: the app tracks project cash custody, shared-expense settlement, capital ownership, operating P&L, and profit distributions as separate concepts.

The current workspace is mock-data-first. The UI works from local demo datasets when Supabase is not configured, so you can explore the product before wiring a live backend.

## What It Tracks

- `Project cash custody`: who is currently holding project money.
- `Expense reimbursement`: who owes whom for shared operating expenses, Splitwise-style.
- `Capital balance`: how much each member has invested for profit sharing.
- `Operating P&L`: analytical income and expense allocation inside the project.
- `Profit received`: actual profit distributions already paid out.

Those numbers are intentionally kept separate in the UI so a user does not have to understand accounting jargon to follow the dashboard.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase for auth, database, and row-level security
- Demo data fallback for local development and first-run exploration

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000` after the server starts.

Useful checks:

```bash
npm run lint
npm run build
```

## Environment Variables

Create a local `.env.local` for live Supabase mode.

Required for live Supabase:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Optional server-only secret:

```bash
SUPABASE_SERVICE_ROLE_KEY=
```

If the public Supabase variables are missing, the app stays in demo mode and uses the mock datasets baked into the repository.

## Demo Mode

Demo mode is the fastest way to understand the product:

- Sign-in can fall back to demo access.
- The dashboard shows realistic projects, members, settlements, and reconciliation states.
- The finance engine still computes balances, profit weights, and settlement suggestions from the demo data, so the UX reflects the actual logic.

## Supabase Migration

The SQL sidecar lives in `supabase/migrations/20260321153000_finance_app_schema.sql`.

It includes:

- tables for profiles, projects, project members, ledger entries, allocations, profit runs, and reconciliation
- enums, constraints, indexes, triggers, and row-level security policies
- auth-user profile bootstrap for live sign-up flows

Apply it with your normal Supabase workflow, for example through the dashboard SQL editor or the CLI migration flow.

## Google OAuth Setup

The app now includes a `Continue with Google` flow on `/sign-in`.

To make it work in Supabase:

1. Create a Google OAuth client for a Web application in Google Cloud.
2. Add your app origins under Authorized JavaScript origins:
   - `http://localhost:3000`
   - your production domain such as `https://intelligent-investor-project.vercel.app`
3. In Supabase Auth, enable the Google provider and paste the Google client ID and client secret.
4. Add your app callback route to Supabase redirect URLs:
   - `http://localhost:3000/auth/callback`
   - `https://intelligent-investor-project.vercel.app/auth/callback`
5. Make sure `NEXT_PUBLIC_APP_URL` matches the live app URL in each deployment environment.

If the provider is not configured yet, the button will still appear but Supabase will reject the Google sign-in attempt.

## Deploy Path

1. Create a Supabase project.
2. Apply the migration in `supabase/migrations/`.
3. Set the three public env vars in Vercel.
4. Add `SUPABASE_SERVICE_ROLE_KEY` only if you need server-side admin actions later.
5. Deploy the Next.js app to Vercel.
6. Verify sign-in, project dashboard, settlement suggestions, and reconciliation screens in preview.

## Product Notes

- Shared-expense settlement is separate from profit distribution.
- Profit sharing is based only on capital contributed.
- Operating expenses can be split across selected members without affecting capital ownership.
- Customer cash inflows increase project cash and project profit, but they do not automatically create member debt.

## Current Implementation

The app currently ships with:

- a clean shadcn/ui dashboard
- a friendly sign-in screen
- demo project datasets
- a finance calculation engine for project summaries, member statements, settlements, and profit previews
- Supabase-backed project reads when env and session are available
- live ledger-entry create for capital, operating income, operating expense, cash handover, and expense-settlement payment

Current limitation:

- profit distribution still needs a dedicated live posting flow, so that entry type remains preview-only in the planner

The live Supabase schema is ready to be used alongside that mock-data-first UI once env vars are configured.
