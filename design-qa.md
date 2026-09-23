# API Key compact usage table QA

final result: passed

## Scope and evidence

- Selected visual target: `/Users/linlay/.codex/generated_images/01a0ccb7-b17f-73f1-8a66-c9a90f884816/exec-dfa1b650-edc4-4ca2-bf72-d789fc6af0ea.png` (2000 × 786 concept image).
- Implementation: `http://localhost:4187/api-keys`, production build served with isolated sample API responses. No live account or production writes.
- Screenshot directory: `/Users/linlay/.codex/visualizations/2026/09/23/01a0ccb7-b17f-73f1-8a66-c9a90f884816/`.
- `api-keys-1440.png`: 1440 × 900 CSS viewport, left side of the table.
- `api-keys-right.png`: same 1440 × 900 viewport, horizontally scrolled right, all usage dimensions, reset and actions visible.
- `api-keys-desktop.png`: 1920 × 1000 CSS viewport; capture backend cropped the right edge to 1649 pixels, so it is supplementary evidence only. Complete right-side evidence is in the preceding screenshot.
- Source and implementation were inspected together in a single comparison input. Comparison is of the table's hierarchy, shared baselines and states, not a pixel overlay: the source is an image-only table concept, while implementation retains existing sidebar, filter toolbar, localized labels and production typography. No raster stretching was used.
- Sample rows cover normal, near-limit, exhausted, unconfigured and unavailable usage. Reset timestamps are sample countdowns, not the mock's static timestamps or actual production quotas.

## Comparison history

1. P2: the existing fixed-width table squeezed the unassigned Models column after adding usage columns. Fixed by giving Models an explicit width, assigning widths to metric columns and removing the page's previous maximum width only on API Keys.
2. Post-fix browser evidence: the 1440 left capture shows readable truncated model text and its details button; the right capture shows aligned 28px period lines, warning/exhausted values and actions. DOM measurements at 1920: document width 1920, table width 1586, wrapper width 1586; no page overflow. At 1440 the 1580px table scrolls inside its 1106px wrapper. At 390 the wrapper is 320px and document width remains 390.

## Fidelity surfaces

- Typography: retained production sans-serif fonts and existing identity text; 13px tabular figures and 28px period line height make the three-row group compact. Smaller hints distinguish units and caps.
- Spacing: one shared period column; separate spent/limit columns; six synchronized usage stacks. Three-period key group about 112px including cell padding. One-period keys remain compact.
- Colors: existing light/dark tokens retained; amber at 80%, red at exhaustion with textual state. Unknown values use an em dash, not a zero.
- Images: concept contains no raster assets to implement; existing application icons retained.
- Content: all configured periods are shown in duration order, not only 5h and 7d. Header says time until reset. Requests/Tokens sorting remains by cumulative values and the button title states this.

## Checks

- `npm run build`: passed (existing large-chunk advisory remains).
- Server `go test ./...`: passed, including new list usage and unavailable-usage regression tests.
- Browser: cumulative ascending/descending/reset sorting, select-all (five keys), cancel selection, search empty state, locale switch, unlimited key, missing window usage, cost warning and cost exhaustion.
- Browser console: no errors from the preview origin. Prior errors from another localhost application were excluded.
- No production deployment, destructive actions, or changes to existing billing rules.

## Remaining limits

- Browser data is a fixture; backend behavior was separately verified by HTTP handler tests using real test stores and usage counters.
- Full accessibility audit, real long-running rollover observation and production data verification were not performed.
- The existing application shell is intentionally retained; the design concept's large title and explanatory mock-data caption were not added to production UI.

## Follow-up: compact desktop columns and Edit

- User requested narrower Period, Limit and Reset columns, hover details for Requests/Tokens, and an Edit menu action.
- Latest implementation screenshot: `/Users/linlay/.codex/visualizations/2026/09/23/01a0ccb7-b17f-73f1-8a66-c9a90f884816/api-keys-compact-edit.png`.
- At 1366 × 900 CSS pixels, document width is 1366 and both table and wrapper are 1032px. All columns and row actions are visible without horizontal scrolling.
- Requests/Tokens show compact usage. Browser verified native title `5 hours: 90 / 500`; focusable values carry full accessible labels and preserve warning colors.
- Edit is the first menu item. Clicking it reached `/api-keys/preview1#api-key-settings`; the name input was focused and settings appeared in the viewport (top 185.5px). No mutation was submitted.
- `npm run build` passed. No errors from the preview origin. Existing pricing edits remained untouched.
- This follow-up supersedes the earlier 1580px minimum table width. New minimum is 1000px.
- final result: passed
