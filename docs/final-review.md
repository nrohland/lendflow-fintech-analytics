# Final interface review

Reviewed 2026-10-01 against TASK-LENDFLOW-REFRESH. Harness v1.0.0 remains unchanged at `5fc98ce7ff370dcb2700de698c7af67ae9c69fd0`.

## Design decision

An analytical case study for an interview walkthrough: restrained green and slate, Newsreader headings, Inter body copy, compact navigation and explicit evidence. Antislop dials: ENERGY 2, RHYTHM 2, MOTION 1. Preserve the approved palette and typography; remove decoration that competes with analysis.

Applied guidance: antislop, better-ui, and data-analytics:visualize-data. Charts use the existing Recharts dependency inside Next.js. The reference funnel's column pattern is implemented with direct values and a horizontal mobile layout; no chart library was added.

## Findings and repairs

| Priority | Before | After and rationale |
| --- | --- | --- |
| High | Charts relied on hovering and dense legends | Direct values, named denominators, expandable source tables |
| High | Count and rate comparisons competed on one display | Separate aligned channel charts, each with its own scale |
| High | Experiment repeated metric cards obscured the result | One primary result, point estimates with confidence intervals, explicit zero reference |
| Medium | Overview introduced the app before explaining evidence | Findings with exact populations and links to the relevant analysis |
| Medium | Repeated decorated cards created visual noise | Solid surfaces, restrained borders, compact metric strips, editorial finding rows |
| Medium | Dense tables dominated several pages | Scorecards and SQL remain available in native disclosures |
| Medium | Mobile tooltip geometry caused page overflow after resizing | Hidden tooltip wrappers removed from layout; all five routes checked at 390px |
| Medium | Source timestamps could appear in the header | Human-readable month range and a regression test |

## Delivery gates

| Gate | Result | Evidence |
| --- | --- | --- |
| Automated boundaries and labels | PASS | Seven web tests, including unsupported questions, missing SLA limits, no inferred slice intersections, human labels and ISO period labels |
| Production compilation | PASS | Next.js production build with TypeScript; all five routes generated |
| Source contracts | PASS | `make check`: 45 checks passed; generated runtime metadata was restored and excluded |
| Data fidelity | PASS | Independent read-only review: governed counts, conditional denominators, null handling, percentage-point conversion and confidence interval endpoints |
| Mobile geometry | PASS | 390px document width equals viewport on Overview, Funnel, Operations, Experiment and Ask |
| Interaction checks | PASS | All navigation routes; each filter dimension; reset; monthly/weekly toggle; device value selection; selected context across routes and back navigation; chart table disclosure; keyboard disclosure; suggested answer and unsupported question |
| Console during reviewed routes | PASS | No warning/error entries captured in the reviewed production session |
| Key text contrast | PASS | Muted on paper 5.58:1; pine on white 6.05:1; hero label 7.80:1; hero accent 8.19:1; muted on white 6.01:1 |
| Code hygiene | PASS | `git diff --check`; no new dependencies or data/model changes |

This is targeted verification, not a claim of exhaustive accessibility certification. Loading and recoverable error states are implemented and compiled; failure injection and assistive-technology runtime testing were not performed. No additional dbt execution was required for this interface-only diff; CI remains the fresh model/snapshot gate.

## Handoff

The interface and descriptive readout are ready for the portfolio walkthrough. The [case study](case-study.md) separates observations from causal conclusions. Guardrail tolerances, SLA targets and formal sensitivity analysis remain explicit analytical decisions; the app does not fill them in.

The existing draft PR is the delivery boundary. Only `nrohland` merges under AGENTS.md. Preview deployment and CI must be green before that owner action; a preview does not update the production domain until merge.
