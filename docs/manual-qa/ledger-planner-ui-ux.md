# Ledger Planner UI/UX QA

## Scope

Use this checklist when validating `/projects/[projectId]/ledger/new` after UI or copy changes.

## Viewports

- Desktop: `1440 x 900`
- Tablet: `1024 x 768`
- Mobile phone: `390 x 844`

## Core Flow

1. Open the ledger planner page from a project dashboard.
2. Confirm the page shows one support card above the form with:
   - `Open transaction guide`
   - `Manage tags`
3. Confirm the planner form starts immediately after that support card.
4. Switch entry family between `Business` and `Correction`.
5. Change entry type and verify helper copy updates.
6. Fill amount, date, description, and member selections.
7. Save a preview.
8. If the project is live-enabled, create a live entry.

## Desktop Expectations

- The support card actions should sit on one row when there is enough width.
- The planner form and the summary/status cards should render as a two-column layout on large screens.
- There should be no duplicate guide/tag CTA block inside the form card.
- The primary form actions at the bottom should stay easy to scan and not wrap awkwardly.

## Mobile Expectations

- The support card buttons should stack cleanly and span full width.
- The form should stay single-column with no clipped labels or horizontal page scroll.
- The bottom `Save preview` and `Create live entry` actions should each span full width.
- The summary and save-status cards should fall below the form, not beside it.
- Checkbox cards for allocation members should stay tappable without overlap.

## Functional Checks

- Pending members can appear in allocation and capital-owner controls.
- Pending members do not appear in cash payer/receiver dropdowns.
- The tag editor link still exists in the tags section even though top-level tag navigation moved to the support card.
- Validation messages remain visible after switching entry family or entry type.

## Regression Notes

- Do not reintroduce a second `Open transaction guide` / `Manage tags` block inside the planner card.
- Keep the planner description short; guide and tag navigation belong in the page-level support card.
