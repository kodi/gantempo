# Lane Properties Trigger Polish Plan

Status: Complete and verified
Date: 2026-07-31
Milestone: Post-M4 default-surface refinement

## Summary

Make the built-in lane-properties trigger look and feel like an intentional part of
the existing default chrome. Replace the tightly tracked text dots and zero-padding
box with the package's existing Lucide icon language, balanced spacing, and complete
button states without changing the properties, focus-return, or customization
contracts.

## Decision

- Keep the existing package-owned, low-specificity default chrome. Do not introduce
  shadcn/Tailwind for this focused control.
- Reuse the package's existing `lucide-react` dependency and preserve the trigger's
  accessible lane-specific name and stable `data-gt-part`.
- Keep sizing owned by the default stylesheet so consumers can continue to override
  the low-specificity class hook.

## Scope

In scope:

- lane-properties trigger markup and default styles;
- focused DOM/style regression coverage;
- live `/interactive` desktop and narrow visual/accessibility verification;
- synchronized plan and roadmap evidence.

Out of scope:

- a general button primitive or public icon API;
- shadcn, Tailwind, or another component-system migration;
- properties dialog, command, selection, focus-return, or overlay behavior changes.

## Slice 1: Replace the text glyph and balance the control

Status: `[x]` Done

- render the existing Lucide ellipsis icon as decorative content;
- add explicit border-box sizing and horizontal padding;
- retain hover and focus-visible behavior, with a pressed state consistent with the
  existing theme tokens;
- add focused regression coverage.

Verification:

- focused properties DOM and stylesheet tests;
- repository formatting, lint, and type checking.

Dependencies: completed M4 item-properties appendix and default-surface modernization.

## Slice 2: Live visual and accessibility gate

Status: `[x]` Done

- inspect `/interactive` at desktop and narrow widths;
- confirm balanced icon geometry, lane-label clearance, accessible naming, focus
  visibility, no page overflow, and clean application console/network state;
- run the complete repository and playground build gates.

Verification:

- `mise run ci`
- `mise run build-playground`
- Chrome DevTools `/interactive` checks
- `git diff --check`

Dependencies: Slice 1.

## Slice 2.1: De-emphasize the occasional action

Status: `[x]` Done

- replace the horizontal ellipsis with the conventional vertical overflow icon;
- shrink the control and its dedicated column without returning to content overlap;
- make the resting state transparent and quiet while preserving a clear hover,
  focus-visible, and coarse-pointer affordance;
- repeat focused tests and live desktop/narrow geometry, accessibility, focus, and
  overflow checks.

Verification:

- focused properties DOM and stylesheet tests;
- `mise run ci`
- `mise run build-playground`
- live `/interactive` desktop and narrow checks;
- `git diff --check`.

Dependencies: Slices 1–2 and the verified dedicated control-column correction.

## Working Notes

### 2026-07-31 baseline

- The reported trigger renders a text `•••` glyph at 8px with letter spacing inside
  a 32px-wide button whose padding is explicitly zero.
- `lucide-react` is already a package dependency and supplies the surrounding default
  menu/editor iconography, so no dependency or UI-system migration is needed.
- The existing lane-specific accessible name, click behavior, focus-return query,
  and `data-gt-part="lane-properties-trigger"` hook can remain unchanged.

### 2026-07-31 final-column overlap deviation

- The first desktop browser measurement confirmed the polished trigger itself was
  balanced at 36 × 30px with an 18px icon and 8px inline padding, but widening the
  existing absolute overlay exposed that it shared space with the final `Code`
  column.
- The old `:last-of-type` padding attempted to reserve overlay space inside the
  final data column. A 72px code column cannot hold 62px of left/right padding plus
  useful content, and custom cell content is not covered by the default title
  truncation rule.
- Reserve a dedicated 52px visual control column only when properties are enabled.
  Keep the accessible trigger outside the `aria-hidden` visual lane rows, positioned
  over that reserved column, so the public grid semantics and focus behavior remain
  unchanged.

### 2026-07-31 implementation and focused verification

- Replaced the text dots with the existing decorative Lucide `Ellipsis`, kept the
  lane-specific accessible name, and added explicit 36px border-box width, 8px
  horizontal padding, 18px icon geometry, pressed feedback, and reduced-motion
  handling.
- The enabled properties surface now adds a 52px visual control column after the
  consumer columns. The accessible buttons remain siblings of the `aria-hidden`
  visual lanes, so the focus-return and treegrid contracts do not change.
- Focused properties and stylesheet verification passed 2 files / 13 tests.
  Path-scoped `vp check` passed formatting for all four changed source files and
  lint/type checking for the three applicable files.

### 2026-07-31 live and final verification

- Chrome DevTools could not list pages because its dedicated profile was already
  locked by another browser instance. No browser process was terminated; the
  repository-authorized built-in Browser fallback verified `/interactive`.
- At 1,440 × 900, the first trigger measured 36 × 30px around an 18 × 18px icon with
  8px computed horizontal padding. The 72px code cell ended 7px before the button,
  `DIS` had 48.74px of visible clearance, the dedicated 52px cell held 7px/9px left
  and right insets, and page/chart horizontal overflow were both zero.
- At 390 × 844, the chart measured 345px wide and retained the same code, control
  cell, inset, and clearance geometry. All four lane-specific button names remained
  in the accessibility snapshot, the decorative icon stayed hidden, and page/chart
  horizontal overflow were both zero.
- Opening and closing Discovery properties returned focus to its trigger with the
  expected 2px solid focus outline and 2px offset. The application warning/error
  console was empty.
- The Browser fallback does not expose a request ledger, so no live per-request
  status claim is made. The route loaded successfully and the production build gate
  completed.
- `mise run ci` passed 158-file formatting, 147-file lint/type checking, 67 test
  files / 347 tests, and all four package artifacts. `mise run build-playground`
  transformed 1,918 modules and emitted the production assets. `git diff --check`
  passed.

### 2026-07-31 prominence follow-up

- User review found the 36 × 30px bordered horizontal-ellipsis control too prominent
  for an occasional lane-properties action.
- Use Lucide's vertical ellipsis, reduce the visual control and reserved column, and
  keep the resting surface transparent. Hover and keyboard focus may reveal the
  bordered surface; coarse-pointer users must retain a visible, direct affordance.
- This is a visual-priority correction only. The dedicated-column ownership,
  accessible name, properties command path, focus return, and public customization
  hook remain unchanged.

### 2026-07-31 Slice 2.1 completion

- Replaced `Ellipsis` with `EllipsisVertical`, reduced the control from 36 × 30px to
  28 × 28px, reduced the icon from 18px to 16px, and reduced the dedicated visual
  column from 52px to 44px.
- The resting state now uses transparent border/background and `0.64` opacity.
  Hover and focus-visible restore full opacity, foreground, border, and surface;
  focus-visible keeps the existing 2px outline. The coarse-pointer media rule raises
  resting opacity to `0.82` without restoring the prominent card treatment.
- Focused properties and stylesheet verification passed 2 files / 13 tests, and the
  path-scoped format/lint/type gate passed.
- Built-in Browser fallback verified `/interactive` at 1,440 × 900 and 390 × 844.
  Both sizes measured a 28 × 28px trigger, 16 × 16px vertical icon, 44px reserved
  column, 7px/9px control insets, 48.74px `DIS`-to-button clearance, and zero
  page/chart horizontal overflow. All four lane-specific accessible names remained,
  and the icon stayed decorative.
- Closing the lane dialog returned focus to the trigger. Its focused state measured
  full opacity, visible surface/border, and the expected 2px outline with 2px offset.
  The application warning/error console was empty.
- Chrome DevTools remained profile-locked; no process was terminated and no live
  request-ledger claim is made. `mise run ci` passed 158-file formatting, 147-file
  lint/type checking, 67 test files / 347 tests, and all four package artifacts.
  `mise run build-playground` transformed 1,918 modules, and `git diff --check`
  passed.

## Next Slice

Resume the pending narrow live verification in Slice 5 of
`2026-07-31-persistence-entity-change-projection-plan.md`; this polish plan has no
remaining slice.
