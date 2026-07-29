# Design QA

## Evidence

- Source visual truth: `F:\AI Projects\Resume\.superpowers\brainstorm\resume-templates-20260728-174022\content\resume-template-directions.html`
- Intended implementation: local resume export flow in `F:\tmp\resume-export-templates`
- Browser-rendered implementation screenshots: unavailable
- Required desktop viewport: `1440 x 1000` CSS px
- Required narrow viewport: `390 x 844` CSS px
- Source pixel dimensions: unavailable because the HTML source could not be opened in the required in-app browser
- Implementation pixel dimensions: unavailable because the implementation could not be captured in the required in-app browser
- CSS size and density normalization: not performed; no valid source/implementation browser capture pair exists
- Intended states: Chinese preview; first English loading and success; cached English return after template/format changes; regenerated English result; Editorial, Precision Grid, and Minimal; PDF and Word

## Browser Blocker

Codex Desktop browser verification was attempted through the required IAB path. The Node-backed browser probe executed:

```text
agent.browsers.get("iab")
```

It failed with:

```text
agent is not defined
```

The persistent JavaScript environment also exposed no `agent`, `browser`, or `iab` global binding. Tool discovery exposed the Node REPL bridge but no callable Browser control tool. Per the browser-choice rule, Playwright CLI/MCP and Chrome were not used as substitutes.

Consequently, the following required evidence is missing and cannot be certified:

- `1440 x 1000` full-flow screenshot
- `390 x 844` full-flow screenshot
- toolbar and primary-action positioning
- export-control usability and horizontal-overflow behavior
- preview paper-boundary and long-text wrapping behavior
- English loading/cache/regeneration interactions
- browser console state

## Full-view Comparison

Blocked. No same-viewport source capture and implementation capture could be placed into a combined comparison input. No claim of browser fidelity is made.

## Focused-region Comparison

Blocked. The toolbar, export controls, template previews, long-name header, long-title row, and long-bullet regions could not be captured in the required IAB. Focused browser comparisons were therefore not possible.

## Findings

- [P0] Required browser evidence is unavailable
  - Location: complete local resume export flow.
  - Evidence: the required IAB API is unavailable with `agent is not defined`; no Browser control tool is callable.
  - Impact: responsive layout, interaction states, console health, and source-to-implementation browser fidelity cannot be certified.
  - Fix: rerun this QA in a Codex Desktop session that exposes `agent.browsers.get("iab")`, then capture both required viewports and repeat the full-view and focused-region comparisons.

## Required Fidelity Surfaces

- Fonts and typography: browser comparison blocked. Exported PDF typography was inspected separately, but that does not certify the browser preview.
- Spacing and layout rhythm: browser comparison blocked.
- Colors and visual tokens: browser comparison blocked.
- Image quality and asset fidelity: the selected directions contain no required raster imagery; browser rendering is still unavailable for visible surface comparison.
- Copy and content: source/code inspection confirms the intended Editorial/classic and Precision Grid/modern mapping, but browser-rendered copy was not captured.
- Responsiveness: blocked at both required viewports.
- Accessibility: keyboard, focus, tap targets, text scaling, and browser semantics were not tested.
- States and interactions: loading, selected, cached, regeneration, format, and template states were not tested in a browser.
- Console: not available for inspection.

## Comparison History

1. Initial browser QA attempt: blocked before source or implementation capture because the required IAB binding was unavailable.
2. No browser P0/P1/P2 fix iteration was possible without a valid capture surface.
3. Separate export-artifact QA found mixed-script PDF name corruption, an incorrect Precision Grid monogram, unsafe DOCX East Asian font metadata, and missing Minimal additional-information facts. Those export defects were fixed and re-verified, but they do not unblock browser design QA.

## Implementation Checklist

- Reopen the source visual truth and local app through IAB.
- Capture the same export state at `1440 x 1000` and `390 x 844`, device scale factor `1`.
- Verify the complete Chinese-to-English flow, cache reuse, and regeneration invalidation.
- Inspect toolbar alignment, control overflow, paper boundaries, long-text wrapping, keyboard focus, and console errors.
- Put each source/implementation pair into one comparison input and update this report.

final result: blocked
