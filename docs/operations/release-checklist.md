# Release Checklist

Use this checklist before any production release.

## Identify the Release

- Exact commit SHA selected from `main`
- Short human description of the release
- Confirmed whether `supabase/migrations/` changed

## Prepare

- Code changes are committed
- Code changes are pushed
- Release is being packaged from a clean deploy worktree, not the main dirty worktree
- No one is editing the deploy worktree

## Validate Locally

- `tsc --noEmit`
- `next build` if feasible in the main repo worktree
- If finance logic changed, checked at least one real project scenario mentally or with live data

## Database

- If no migration is needed, mark `N/A`
- If migration is needed:
  - identified exact migration filenames
  - applied them to the live Supabase project
  - confirmed the remote database is up to date

## Deploy

- Deployment created from the intended commit only
- Deployment method recorded
- Vercel deployment reached `READY`
- Vercel deployment reached `PROMOTED`
- Promoted deployment metadata matches the intended commit SHA

## Smoke Test

- [sign-in](https://intelligent-investor-project.vercel.app/sign-in) returns `200`
- `/projects` loads for a signed-in user
- At least one real project overview loads

If finance or ledger changed:

- `Vĩnh Trường` checked
- `Nha Trang 02` checked
- overview numbers checked
- ledger form checked
- transaction create or edit flow checked
- settlements tab checked

## Record the Release

- Commit SHA recorded
- Migration filenames recorded
- Deployment id recorded
- Verification notes recorded
