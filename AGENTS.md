# Repository Instructions

## Browser verification

- Prefer the installed Chrome DevTools MCP for local playground inspection, responsive
  screenshots, DOM and computed-style checks, accessibility-tree inspection, console
  review, and network verification.
- Before reporting that browser verification is unavailable because the built-in
  Browser has no connected surface, check Chrome DevTools MCP with `list_pages` and
  use it when the target local page is reachable there.
- Select or navigate only the page in scope. Do not inspect unrelated Chrome tabs,
  profiles, history, storage, or private page contents.
- Use the built-in Browser instead when the user explicitly requests it, Chrome
  DevTools MCP is unavailable, or Chrome DevTools lacks a capability the task needs.
- For plan-driven visual gates, record the inspected routes, viewport sizes,
  accessibility findings, console state, and any live issues fixed in the plan.
