# Deployment Runbook

This is the canonical deploy path for Project Current.

If a release changes both app code and the ledger database model, use this file first.

## Golden Rules

- Only deploy a committed Git commit. Never deploy from uncommitted local edits.
- Always record the exact commit SHA that is being deployed.
- Do product work in the main repo working tree only.
- Create a separate clean deploy worktree from the exact commit being released.
- Never edit code inside the deploy worktree. It is release packaging only.
- If the release depends on new Supabase schema or RPC behavior, apply migrations before promoting the web app.
- After deploy, verify the promoted Vercel deployment is serving the same commit SHA you intended.

## Canonical Sources

- Main repo for development:
  - repo root
- Ledger schema and additive DB upgrades:
  - `supabase/migrations/`
- Vercel upload exclusions:
  - `.vercelignore`

## Pre-Deploy Checklist

Before any deploy:

1. Confirm the exact Git commit to release from `main`.
2. Confirm whether the release includes any file changes under `supabase/migrations/`.
3. Confirm the release was tested locally at least with:
   - `tsc --noEmit`
   - `next build` when feasible in the main repo worktree
4. Confirm the working tree used for development is not the same folder that will be uploaded for deploy.
5. Write down:
   - commit SHA
   - expected migration files, if any
   - expected user-facing change to verify after deploy

## Decide What Must Be Released

### App-only release

Use this when the change is only in:

- `src/`
- `public/`
- docs or styling
- Vercel/runtime config that does not require new DB objects

In this case:

- No Supabase migration is required.
- Deploy the web app only.

### Ledger / database release

Use this when the change touches:

- `supabase/migrations/`
- server actions or reads that expect new DB columns/functions/policies
- any transaction flow that depends on new `entry_type`, allocation rules, invite/member mapping, or reconciliation logic

In this case:

1. Apply the new migration(s) first.
2. Verify the remote DB is up to date.
3. Then deploy the web app commit that expects those DB changes.

## Safe Release Flow

### 1. Work in the main repo

Do all implementation here:

- repo root working tree

Commit and push first.

### 2. Create a clean deploy worktree from the exact commit

Example shape:

- `IntelligentInvestorProject-deploy-<shortsha>`

Why:

- avoids uploading accidental local changes
- avoids deploying the wrong branch head
- keeps the release folder immutable for that commit

### 3. Apply Supabase migrations when required

Check the newest files in `supabase/migrations/`.

For any ledger-related release:

1. identify the new migration filenames included in the release
2. apply them to the live Supabase project
3. verify remote schema is current before promoting the app

For this repo, additive migrations are the standard. Do not rewrite old migration files after they have already been applied to production.

### 4. Deploy from the clean worktree only

Current reliable production path:

- Vercel uploaded-files API from the clean worktree

Current unreliable path:

- Vercel git-source API deploys can fail with `git_info_fail`

That means:

- do not assume a Git push alone created the production release
- verify the actual promoted deployment and its `gitCommitSha`

### 5. Verify the promoted deployment

After deploy:

1. check the newest Vercel deployment is `READY`
2. check `readySubstate = PROMOTED`
3. confirm the deployment metadata `gitCommitSha` matches the intended commit
4. confirm the production alias responds
5. smoke-test the user-facing area changed by the release

## Required Smoke Tests

Every production release:

- sign-in page loads
- projects list loads
- one real project overview loads

If the release touches ledger or balances:

- open `/projects/[projectId]`
- open `/projects/[projectId]/ledger/new`
- verify one transaction flow or edit flow affected by the release
- verify overview numbers on at least one real project

Recommended live projects for finance regression:

- `Vĩnh Trường`
- `Nha Trang 02`

## Finance-Specific Verification

If the release changes balances, cash custody, capital, profit, settlements, or invites:

verify all of these explicitly:

- pending members still map to the same `project_member_id`
- transaction create/update/void still works
- overview numbers match the intended finance meaning
- settlements tab still means shared-expense settlement only
- overview cash-claim widgets do not silently reuse settlements-tab logic unless that is intentional

## Release Notes Template

Capture these four lines in the session or release note:

- `Commit:` exact SHA
- `DB migrations:` filenames applied, or `none`
- `Deployment:` Vercel deployment id
- `Verification:` exact pages/projects checked

## What To Avoid

- deploying from a dirty repo
- deploying from a ZIP snapshot
- deploying from a backup folder
- editing code in the deploy worktree and forgetting to commit it back to the main repo
- shipping app code that expects a migration that has not been applied yet
- verifying only `/sign-in` while the release actually changed ledger math or project dashboards
