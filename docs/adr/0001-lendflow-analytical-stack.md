---
id: ADR-0001
status: accepted
date: 2026-09-21
tags: [lendflow, analytical-stack]
supersedes: null
superseded_by: null
---

# ADR 0001: LendFlow V1 analytical stack

Owner: nrohland. Proposed by role `project-architect`. Accepted by the owner on 2026-09-21.

## Decision

Option A. Python writes Parquet. DuckDB and dbt build the metric layer locally. A mart export feeds Next.js. The dashboard and Ask LendFlow read that same export. Ask LendFlow V1 is deterministic curated Q&A. Charts are Recharts.

Option C, a cloud warehouse, is rejected.

## Consequences

The portfolio path has no warehouse bill. Ad-hoc SQL inside the UI is out of V1. Runtime DuckDB (Option B) stays a later contract if live SQL becomes a requirement.

The diagram, trade-offs, alternatives, and chronological log live in [architecture.md](../architecture.md). Metric grain for the experiment lives in [the analytical spec](../../specs/analytical-spec.md).
