# Task 5 Report — HTML Preview Templates

## Status

Implemented the selected HTML preview directions without changing template catalog keys,
PDF/DOCX templates, export services, or server behavior.

## TDD Evidence

### RED

- Added `server/test/template-contract.test.mjs` before production changes.
- Ran:
  `cd server && node --test --test-name-pattern="preview templates" test/*.test.mjs`
- The new test failed on the first missing contract assertion:
  `Expected /tpl-editorial/`.
- The broad name-pattern command also exposed an unrelated pre-existing
  `api-contract.test.mjs` teardown error when that file's tests were skipped. This was
  not the Task 5 failure and did not change the implementation.

### GREEN

- Ran the focused new file directly:
  `cd server && node --test --test-name-pattern="preview templates" test/template-contract.test.mjs`
- Result: 1 test passed, 0 failed.
- Ran the complete server suite with the worktree write permission required by
  `config-env.test.mjs`.
- Result: 79 tests passed, 0 failed.
- Ran `npm run build`.
- Result: Vite build completed successfully. The existing large-chunk warning remains;
  it is not introduced by the preview templates.

## Files

- `src/templates/PreviewTemplates.jsx`
  - Added centralized Chinese/English section labels.
  - Replaced `ClassicPreview` with Editorial Signal.
  - Replaced `ModernPreview` with Precision Grid.
  - Kept the Minimal layout and localized its existing section headings.
- `server/test/template-contract.test.mjs`
  - Added the selected-direction and language-label source contract.
- `.superpowers/sdd/2026-07-28-resume-export-templates/task-5-report.md`
  - This implementation report.

No PDF, DOCX, service, server, catalog, or original brainstorm mockup file was changed.

## Commit

- Subject: `feat: redesign resume HTML previews`
- The resulting commit hash is reported by the implementing agent after commit creation.

## Visual Fidelity Decisions

Source visual truth:
`F:\AI Projects\Resume\.superpowers\brainstorm\resume-templates-20260728-174022\content\resume-template-directions.html`

- Editorial Signal uses a single continuous reading flow, left-aligned name/role,
  right-aligned contact block, Georgia/CJK serif hierarchy, warm rust `#9B4F36`,
  and approximately 24/76 label/content rows.
- Precision Grid uses an exact 31/69 grid, `#11233F` information rail, and
  `#32B7A4` accent. Contact, skills, tools, and education are in the rail; summary,
  experience, projects, objective, and additional information remain in the main flow.
- Precision skills and tools render only values supplied by `buildResumeView`, as
  text chips. The mockup's illustrative proficiency bars were deliberately omitted
  because the product data contains no proficiency values.
- Decorative metrics were not introduced.
- Minimal retains its original markup hierarchy, sizing, and spacing; only its
  existing section headings now read from the centralized language map.
- Compact type, `minWidth: 0`, `overflowWrap: anywhere`, and the existing fixed-A4
  clipping boundary prevent visible horizontal or paper-bound overflow.
- The selected references contain no required raster assets or essential icons, so
  no images or icon approximations were added.

## Self-review

- Component signatures accept the already-wired `language` prop.
- Template catalog keys remain `classic`, `modern`, and `minimal`.
- Every visible section heading used by the three previews is backed by the
  centralized Chinese/English label map.
- All displayed resume facts come from `view` or `role`; no proficiency, metric, or
  achievement data is invented.
- `git diff --check` passed.

## Risks and Concerns

- Browser screenshot comparison is blocked in this environment. The Codex in-app
  browser (`iab`) failed to initialize with `EPERM` while reading the Codex app
  directory. Therefore visual fidelity was checked against the source HTML/CSS and
  production build, but no browser-rendered screenshot is claimed.
- The preview remains a fixed single A4 sheet with `overflow: hidden`. Very large
  resumes that intrinsically exceed one page can still be clipped rather than
  paginated; pagination is outside Task 5.
- PDF and DOCX remain on their previous visual implementations by design and are
  deferred to Task 6.

---

## Round 1 Fix — Preserve Long Preview Content

### Baseline

- Started from Task 5 commit:
  `96a324cdefcbf57a514c923ad9ac68d755162ca9`.

### RED

- Replaced the source-text matching test with actual component execution:
  - Vite middleware-mode SSR loads `PreviewTemplates.jsx`.
  - ReactDOM Server renders each exported component to real static markup.
  - Vite's test cache is isolated under the operating-system temporary directory and
    is removed after the test.
- Added behavior coverage for exports, direction classes, Chinese/English labels,
  Modern 31/69 layout and rail placement, absence of fake proficiency markup,
  Minimal localization, empty contacts, and long content accessibility.
- Ran `cd server && node --test test/template-contract.test.mjs`.
- Result: 4 passed, 2 failed for the intended production defects:
  - Modern rendered `Contact` with no email, phone, or location.
  - Template roots rendered `overflow:hidden` instead of a vertically accessible
    content strategy.

### GREEN

- Changed the shared A4 preview root from blanket clipping to:
  - `overflowX: 'hidden'`
  - `overflowY: 'auto'`
- Removed `overflow:hidden` from the Modern rail and main column so the root owns
  vertical access for the complete grid.
- Rendered the Modern contact heading and values only when at least one real contact
  fact exists.
- Kept all skills, tools, experiences, projects, bullets, and extras intact; no
  `slice` or other fact truncation was introduced.
- Renamed all focused cases with the `preview templates` prefix so the original
  name-pattern command executes the entire file.
- Focused result:
  6 tests passed, 0 failed.
- Full server result:
  84 tests passed, 0 failed.
- Final Vite production build:
  passed with only the existing large-chunk warning.

### Round 1 Commit

- Subject: `fix: preserve long resume preview content`
- The resulting hash is reported by the implementing agent after commit creation.

### Round 1 Remaining Concerns

- The HTML preview now makes all content vertically accessible inside the fixed A4
  viewport. It intentionally does not paginate; PDF/DOCX pagination remains Task 6.
- Codex in-app browser screenshot QA remains unavailable because of the previously
  recorded `EPERM` initialization failure. Real SSR tests now verify the rendered
  component contracts, but they do not replace pixel-level browser comparison.
