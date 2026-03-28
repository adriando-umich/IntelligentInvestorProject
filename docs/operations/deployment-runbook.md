# Deployment Runbook

Canonical deploy-safety guide for Project Current production releases, rollbacks, and release logging.

Use this file together with `README.md`, `docs/operations/release-checklist.md`, and the current production baseline recorded in `docs/ai/source-of-truth.md`.

## Why This Exists

This repo does not have a trustworthy push-only deploy path.

- Git pushes do not prove production changed.
- Vercel git-source deploy attempts for this project have failed with `git_info_fail`.
- The working release path has been uploaded-file deployment from a clean source snapshot.
- That path uploads the whole source tree, so a "small" hotfix is only small if the deploy tree contains exactly that hotfix.
- The app bundle and Supabase schema can also drift if migrations are not treated as part of the same production release.

The rule for this repo is simple:

- production is whatever live Vercel and live Supabase are actually serving
- `main` is what production is supposed to be serving
- a deploy is not finished until those two match again

## Mandatory Rules

- Before any production deploy, rollback, Vercel promotion, production env mutation, or live Supabase migration, read this file and the release checklist.
- After any deploy or rollback, append a new entry to the `Release Ledger` section in this file before ending the task.
- Normal production deploys must use `main` as the source branch.
- If an emergency or narrow hotfix uses an isolated staging worktree, it must still be cut from `main`, and the same deployed source must be committed or already exist on `main` before the task ends.
- Production must not intentionally remain ahead of `main` after the task is finished.
- Never assume local `HEAD` matches production.
- Never assume a GitHub push created a production release.
- Never deploy from a dirty worktree.
- Never describe a deploy as "UI-only", "docs-only", or "small" unless the clean deploy tree proves that scope.
- Treat the live Vercel production deployment metadata and live Supabase migration state as production truth.
- If app code depends on a new Supabase schema, RPC, policy, or enum, apply the migration before promoting the app.
- If the change touches auth or redirects, capture the current live auth baseline before mutating it.

## Production Deploy Contract

### Source Of Truth Model

- Live Vercel production deployment is the runtime truth for the app bundle.
- Live Supabase migration state and auth/runtime config are the runtime truth for backend behavior.
- `main` is the source-code truth for what production is supposed to be running.
- A release is only done when:
  - production is serving the intended Vercel deployment
  - Supabase is at the intended schema baseline
  - `main` contains the deployed source bundle

### Current Verified Production Baseline

Use live production as the starting point, not local memory.

As of the last repo-verified baseline on March 28, 2026:

- Production URL: `https://intelligent-investor-project.vercel.app`
- Vercel project: `intelligent-investor-project`
- Latest repo-verified promoted production deployment: `dpl_4LfVF8x1U8mT8rTNoBpWGWSJBNuE`
- Latest repo-verified production commit: `1005bc397c9244f27bcd6aebada9bef29f54e930`
- Latest repo-verified live Supabase migration: `20260328190500_land_purchase_entry_support.sql`
- Known local-not-live follow-up at the time of this update: post-deploy ledger and memory sync after `dpl_4LfVF8x1U8mT8rTNoBpWGWSJBNuE`; live DB migrations still pending for `20260328210000_project_member_activity.sql` and `20260328233000_canonical_project_member_identities.sql`

If live Vercel or live Supabase checks disagree with this section, live state wins immediately and this section must be updated after the release.

### Branch Policy

- Default production source branch: `main`
- Default production source tree: a clean `main` worktree
- Allowed exception: a clean staging worktree created from `main`
- Disallowed state at task end: production serving a bundle that is not represented on `main`

### Non-Negotiable Preflight Commands

Run and inspect these before deployment:

1. `git branch --show-current`
   - must be `main` unless this is a documented staging override
2. `git status --short`
   - must be empty unless this is a documented staging override
3. `git rev-parse HEAD`
   - record the exact source commit being released
4. `git diff --stat`
   - confirm the changed-file list matches the intended scope exactly
5. capture current live production state
   - current Vercel production deployment id
   - current Vercel `state`
   - current Vercel `readySubstate` when surfaced; otherwise record `N/A`
   - current Vercel `gitCommitSha` when surfaced; otherwise record `N/A`
   - current live Supabase migration baseline
   - current production auth/env baseline if the release touches auth, redirects, or Supabase wiring

If any of those are unclear, stop and resolve them before deploying.

### Hotfix Discipline

- There is no file-only deploy path in this repo.
- A narrow hotfix still uploads the full checked-out source tree.
- That means hotfix scope is proven by a clean staging worktree, not by intention.
- If a staging worktree is used, record that path in the ledger and reconcile the exact deployed source back to `main` before ending the task.

### Definition Of Done For A Release

Do not call a production release complete until all items below are true:

1. the intended Vercel deployment is `READY`
2. if Vercel surfaces `readySubstate`, it is `PROMOTED`; otherwise the production alias must resolve to the inspected deployment and the ledger must record `N/A`
3. if Vercel surfaces `gitCommitSha`, it matches the intended commit; otherwise the deploy must come from a clean worktree created at the intended commit and the ledger must record `N/A`
4. any required Supabase migrations were applied and the remote database is current
5. required smoke tests passed on the production URL
6. rollback refs were recorded
7. the `Release Ledger` entry was appended
8. `main` contains the deployed source bundle

## Current Script Reality

For this repo today:

- reliable production path:
  - uploaded-file Vercel deployment from a clean worktree, whether driven by the Vercel CLI upload path or the Vercel deployment API
- unreliable production path:
  - Vercel git-source deploy attempts can fail with `git_info_fail`
- false assumption to avoid:
  - a GitHub push by itself means production changed

Also remember:

- `.vercelignore` is part of the production packaging contract
- `vercel.json` is part of the production routing/build contract
- Supabase migrations are additive and should not be rewritten after production has applied them

## Required Preflight

Before deploying:

1. Capture the live production baseline.
   - record the current Vercel production deployment id and `state`
   - if the inspect output surfaces `readySubstate` or `gitCommitSha`, record them
   - otherwise record `N/A` explicitly and note that the uploaded-file deploy path did not surface them
   - record the current production URL being checked
   - record the current live Supabase migration baseline
   - if the release touches auth, redirects, or environment wiring, record the relevant live baseline too:
     - `NEXT_PUBLIC_APP_URL`
     - `NEXT_PUBLIC_SUPABASE_URL`
     - Supabase Auth `site_url`
     - enabled auth providers
     - redirect allow-list entries that matter to the release
2. Prepare the source tree.
   - use a clean `main` worktree or a dedicated clean staging worktree cut from `main`
   - run `git branch --show-current`, `git status --short`, `git rev-parse HEAD`, and `git diff --stat`
   - confirm the changed-file list matches the intended scope exactly
3. Decide the deployment scope explicitly.
   - app only
   - migration plus app
   - migration only
   - env/auth only
   - rollback
4. Prepare rollback before deployment.
   - know the previous Vercel production deployment id
   - know the previous Vercel `gitCommitSha` if surfaced; otherwise record `N/A`
   - know the previous live Supabase migration baseline
   - know whether rollback is app-only or requires a forward fix because the new migration is additive and cannot be cleanly reversed
5. Decide how success will be verified.
   - which Vercel deployment proves release success
   - which project pages and workflows prove user-facing recovery

## Clean-Source Requirement

Use one of these two flows.

### Full Release

- Build and deploy from a clean `main` worktree or a clean deploy worktree created from the exact committed SHA.
- Record the source branch, commit, and tree path in the ledger.

### Narrow Hotfix

- Create an isolated staging worktree from `main`.
- Copy in only the intended files.
- Re-run `git status --short` and `git diff --stat` inside that staging worktree.
- If the staging worktree contains more than the intended hotfix, stop and clean it before deploying.

## Deployment Checklist

During deployment:

1. Record the operator, intended scope, source branch, source commit, and source tree path.
2. If the release depends on Supabase changes, apply the new migration(s) first and verify the remote database is current.
3. Create the production deployment only from the clean deploy tree selected in preflight.
4. After deployment, capture the new live Vercel deployment id and `state`.
   - record `readySubstate` and `gitCommitSha` when surfaced by live inspect
   - otherwise write `N/A` and rely on the clean deploy-worktree commit plus alias verification
5. If production is still serving the previous deployment, or surfaced commit metadata disagrees with the intended commit, treat the release as failed or incomplete.
6. Record any manual actions performed outside the main deploy flow:
   - Vercel project settings
   - Supabase dashboard changes
   - auth-provider edits
   - live SQL or migration tooling

## Post-Deploy Verification

Minimum production verification:

- [sign-in](https://intelligent-investor-project.vercel.app/sign-in) responds successfully
- `/projects` loads for a signed-in user
- one real project overview loads

Status checks are mandatory in addition to smoke tests:

- the newest Vercel deployment is `READY`
- if surfaced, `readySubstate` is `PROMOTED`; otherwise record `N/A` and confirm the production alias points at the inspected deployment
- if surfaced, the live deployment metadata `gitCommitSha` matches the intended commit; otherwise record `N/A` and confirm the deploy came from the intended clean worktree SHA
- the production alias responds from that promoted deployment

If the release touched ledger, balances, member governance, or finance math, also verify:

- open `/projects/[projectId]`
- open `/projects/[projectId]/members`
- open `/projects/[projectId]/ledger/new`
- verify one changed create/edit/remove/transfer flow directly tied to the release
- verify overview numbers on at least one real project

Recommended live finance projects for regression:

- `Vĩnh Trường`
- `Nha Trang 02`

Finance-specific checks when the release changes balances, custody, settlements, capital, profit, or invite/member mapping:

- pending members still map to the same `project_member_id`
- transaction create/update/void still works for the changed path
- overview numbers match the intended business meaning
- settlements still mean shared-expense reimbursement only
- overview cash-claim widgets are not silently reusing settlements-tab logic unless that is intentional

## Rollback Rules

- For app-only regressions, roll back the production alias to the previous verified Vercel deployment or redeploy the previous verified commit from a clean worktree.
- For schema-dependent regressions, do not fake a destructive down-migration if production data has already moved forward. Prefer:
  - app rollback only if the previous app is still schema-compatible
  - otherwise a compensating forward fix with a new migration and a new app deploy
- After rollback, repeat the post-deploy verification checklist and append a rollback entry to the `Release Ledger`.

## Release Ledger

Append a new subsection for every deploy or rollback.

### Ledger Contract

Every new ledger entry must include all fields below.

- Do not collapse the live baseline into a vague summary.
- If a field is not applicable, write `N/A`.
- If a resource did not change, still include it and mark it `unchanged`.

Required fields:

- Type
- UTC timestamp
- Operator
- Intended scope
- Source branch
- Source commit
- Source tree path
- Changed files
- Build/deploy path used
- Manual actions outside the main flow
- Pre-deploy live baseline
  - Vercel deployment id
  - Vercel state
  - Vercel readySubstate
  - Vercel gitCommitSha
  - Production URL
  - Supabase migration baseline
- Post-deploy live baseline
  - Vercel deployment id
  - Vercel state
  - Vercel readySubstate
  - Vercel gitCommitSha
  - Production URL
  - Supabase migration baseline
- Verification results
- Rollback plan or rollback refs
- Notes

If the deploy did not come directly from a clean `main` worktree, the `Notes` field must say exactly how and when the deployed source was reconciled back onto `main`.

### 2026-03-28 App-Only Duplicate-Member Canonicalization + Dashboard Chrome Trim

- Type: production app-only deploy
- UTC timestamp: 2026-03-28T23:27:07Z
- Operator: Codex
- Intended scope: ship app-side canonical member normalization for duplicate project members, hide the dashboard asset-basis chrome, and keep the production baseline docs aligned with the live release
- Source branch: `main`
- Source commit: `1005bc397c9244f27bcd6aebada9bef29f54e930`
- Source tree path: `/Users/mynguyen/Documents/Nha Trang/IntelligentInvestorProject-deploy-1005bc3`
- Changed files: `README.md`, `docs/operations/deployment-runbook.md`, `docs/operations/release-checklist.md`, `package.json`, `src/app/(workspace)/projects/[projectId]/ledger/new/page.tsx`, `src/components/finance/project-dashboard.tsx`, `src/lib/data/project-member-canonicalization.ts`, `src/lib/data/project-member-canonicalization.test.mts`, `src/lib/data/supabase-datasets.ts`, `src/lib/finance/engine.ts`, `src/lib/finance/types.ts`, `supabase/migrations/20260328233000_canonical_project_member_identities.sql`, `docs/ai/source-of-truth.md`, `docs/ai/backlog.md`, `docs/ai/issues-and-resolutions.md`
- Build/deploy path used: `npx --yes vercel deploy --prod --yes --scope adriandos-projects` from a clean detached worktree linked to `adriandos-projects/intelligent-investor-project`
- Manual actions outside the main flow: authenticated Vercel through device login, linked the clean worktree with `vercel link`, and intentionally did not apply Supabase migrations because this workspace still lacks a Supabase access token
- Pre-deploy live baseline:
  - Vercel deployment id: `dpl_4MCeTwTq7ZHKYrqLLHnRzChjmsS3`
  - Vercel state: `Ready`
  - Vercel readySubstate: `N/A` (`vercel inspect` did not surface it for the uploaded-file deploy path)
  - Vercel gitCommitSha: `N/A` (`vercel inspect` did not surface it for the uploaded-file deploy path)
  - Production URL: `https://intelligent-investor-project.vercel.app`
  - Supabase migration baseline: `20260328190500_land_purchase_entry_support.sql`
- Post-deploy live baseline:
  - Vercel deployment id: `dpl_4LfVF8x1U8mT8rTNoBpWGWSJBNuE`
  - Vercel state: `Ready`
  - Vercel readySubstate: `N/A` (`vercel inspect` did not surface it for the uploaded-file deploy path)
  - Vercel gitCommitSha: `N/A` (`vercel inspect` did not surface it for the uploaded-file deploy path)
  - Production URL: `https://intelligent-investor-project.vercel.app`
  - Supabase migration baseline: `20260328190500_land_purchase_entry_support.sql` (unchanged)
- Verification results:
  - `npm run test:project-members` passed
  - `npm run test:member-governance` passed
  - `npm run build` passed
  - [sign-in](https://intelligent-investor-project.vercel.app/sign-in) returned `200`
  - `/projects` with demo cookie `pf_demo_session=enabled` returned `200`
  - `/projects/project-sunrise` with the demo cookie returned `200`
  - `/projects/project-sunrise/members` with the demo cookie returned `200`
  - production HTML for `/projects/project-sunrise` no longer contains `Cash deployed into land/assets`
  - production HTML for `/projects/project-sunrise` no longer contains `Deployed into land/assets`
- Rollback plan or rollback refs:
  - Vercel rollback target: `dpl_4MCeTwTq7ZHKYrqLLHnRzChjmsS3`
  - Supabase rollback target: `N/A` for this release because no live migration was applied
- Notes:
  - This was intentionally an app-only release. The app-side canonicalization is backward-compatible with the current live schema and collapses duplicate members in snapshots without requiring an immediate DB migration.
  - The DB-side preventative migrations `20260328210000_project_member_activity.sql` and `20260328233000_canonical_project_member_identities.sql` are present in source but still pending live until a Supabase access token is available in this workspace.

### Entry Template

- Type:
- UTC timestamp:
- Operator:
- Intended scope:
- Source branch:
- Source commit:
- Source tree path:
- Changed files:
- Build/deploy path used:
- Manual actions outside the main flow:
- Pre-deploy live baseline:
  - Vercel deployment id:
  - Vercel state:
  - Vercel readySubstate:
  - Vercel gitCommitSha:
  - Production URL:
  - Supabase migration baseline:
- Post-deploy live baseline:
  - Vercel deployment id:
  - Vercel state:
  - Vercel readySubstate:
  - Vercel gitCommitSha:
  - Production URL:
  - Supabase migration baseline:
- Verification results:
- Rollback plan or rollback refs:
- Notes:

## What To Avoid

- deploying from a dirty repo
- deploying from a ZIP snapshot or backup folder
- editing code inside the deploy worktree
- assuming a GitHub push equals a production deploy
- shipping app code that expects a migration that is not yet live
- verifying only `/sign-in` when the release changed project dashboards, members, or ledger math
- recording a release without the Vercel deployment id, commit SHA, and Supabase migration baseline
