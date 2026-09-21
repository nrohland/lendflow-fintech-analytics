# LendFlow

> **Approval isn't the finish line. Funding is.**

Product analytics for a synthetic auto-loan application. The question is where qualified applicants drop out, why, and which change to test first.

**Unofficial portfolio case study. Not affiliated with any real lender. No proprietary data, systems, or internal metrics. The tables in `data/synthetic/` are 100% synthetic.**

## In this repository

Phase 1 is the design package:

- [Architecture](docs/architecture.md) — stack diagram, trade-offs, decision log
- [Analytical spec](specs/analytical-spec.md) — lifecycle, metrics, experiment, seeded signals
- [Brief](LENDFLOW_BRIEF.md) — frozen 2026-09-21
- [Harness](AGENTS.md) — how contracts land as draft pull requests
- [Synthetic data](docs/data-generation.md) — regenerate the Parquet tables

The diagram is also an [Archify HTML file](docs/diagrams/lendflow-stack.html). Mermaid and JSON sources sit beside it.

[Northstar](https://ecommerce-profitability-analytics.vercel.app/) is the visual and interaction reference. This case study does not reuse that content.

## Decided stack

```text
Python → Parquet → DuckDB + dbt → mart export → Next.js
```

DuckDB runs locally. There is no cloud warehouse. The dashboard and Ask LendFlow will read one exported metric layer. Ask LendFlow V1 is a curated question list, not a live model.

The primary experiment metric is `bank_connection_completion_rate`, among applications that start bank connection.

## Synthetic data

The generator writes 100,000 applications to `data/synthetic/`. It uses one fixed seed. Rebuild and checks:

```bash
make install
make data
```

`make data` replaces the Parquet files and runs the sanity checks. Column rules, the seed, and the seeded processes are in [docs/data-generation.md](docs/data-generation.md).

These tables are not a lender's book of record. Do not treat a rate in the files as a measured business result until EDA is written.

## Not built yet

EDA, dbt, the dashboard, and Ask LendFlow are later contracts.
