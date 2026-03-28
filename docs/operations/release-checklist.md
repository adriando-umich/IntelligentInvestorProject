# Release Checklist

Use this checklist before every production release.

Treat current production as the baseline, not local memory.

## Capture Live Baseline First

- Current production Vercel deployment id recorded
- Current Vercel `state` recorded
- Current Vercel `readySubstate` recorded when surfaced; otherwise `N/A` recorded explicitly
- Current Vercel `gitCommitSha` recorded when surfaced; otherwise `N/A` recorded explicitly
- Current production URL recorded
- Current live Supabase migration baseline recorded
- Relevant auth/env baseline recorded when the change touches auth, redirects, or Supabase wiring

## Identify the Release

- Exact commit SHA selected from `main`
- Short human description of the release
- Confirmed whether `supabase/migrations/` changed
- Explicit release scope chosen:
  - app only
  - migration plus app
  - migration only
  - env/auth only
  - rollback

## Prepare Clean Source

- `git branch --show-current` checked
- `git status --short` checked
- `git rev-parse HEAD` recorded
- `git diff --stat` reviewed
- Code changes are committed
- Code changes are pushed
- Release is being packaged from a clean deploy worktree, not the main working tree
- No one is editing the deploy worktree

## Validate Locally

- `./node_modules/.bin/tsc --noEmit`
- `npm run build`
- If finance logic changed, checked at least one real project scenario mentally, locally, or against live data

## Database And Auth

- If no migration or auth change is needed, mark `N/A`
- If migration is needed:
  - exact migration filenames identified
  - migrations applied to the live Supabase project
  - remote database confirmed up to date
- If auth or environment config is needed:
  - old values captured
  - new values recorded
  - manual production steps documented

## Deploy

- Deployment created from the intended clean commit only
- Deployment method recorded
- Newest Vercel deployment reached `READY`
- If Vercel surfaces `readySubstate`, it reached `PROMOTED`; otherwise `N/A` was recorded and the production alias was checked against the inspected deployment
- If Vercel surfaces `gitCommitSha`, it matches the intended commit SHA; otherwise `N/A` was recorded and the clean deploy-worktree SHA was logged
- Production alias resolves from that promoted deployment

## Smoke Test

- [sign-in](https://intelligent-investor-project.vercel.app/sign-in) returns `200`
- `/projects` loads for a signed-in user
- At least one real project overview loads

If finance, ledger, or member-governance changed:

- `Vĩnh Trường` checked
- `Nha Trang 02` checked
- overview numbers checked
- `/projects/[projectId]/members` checked
- ledger form checked
- changed create/edit/remove/transfer flow checked
- settlements tab checked

## Record The Release

- Commit SHA recorded
- Migration filenames recorded
- Deployment id recorded
- Rollback target recorded
- Verification notes recorded
- New ledger entry appended in `docs/operations/deployment-runbook.md`
