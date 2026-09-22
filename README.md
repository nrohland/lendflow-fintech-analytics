# LendFlow

> **Approval isn't the finish line. Funding is.**

Product analytics for a synthetic auto-loan application. The question is where qualified applicants drop out, why, and which change to test first.

**Unofficial portfolio case study. Not affiliated with any real lender. No proprietary data, systems, or internal metrics. The tables in `data/synthetic/` are 100% synthetic.**

**Live demo:** [lendflow-fintech-analytics.vercel.app](https://lendflow-fintech-analytics.vercel.app)

## In this repository

Phase 1 is the design package:

- [Architecture](docs/architecture.md) — stack diagram, trade-offs, decision log
- [Analytical spec](specs/analytical-spec.md) — lifecycle, metrics, experiment, seeded signals
- [Brief](LENDFLOW_BRIEF.md) — frozen 2026-09-21
- [Harness](AGENTS.md) — how contracts land as draft pull requests
- [Synthetic data](docs/data-generation.md) — regenerate the Parquet tables

The diagram is also an [Archify HTML file](docs/diagrams/lendflow-stack.html). Mermaid and JSON sources sit beside it.

[Northstar](https://ecommerce-profitability-analytics.vercel.app/) is the visual and interaction reference. This case study does not reuse that content.

The dashboard is a Next.js app in [web/](web/). **Live:** [lendflow-fintech-analytics.vercel.app](https://lendflow-fintech-analytics.vercel.app). How to refresh the mart export and how to deploy on Vercel are in [docs/dashboard.md](docs/dashboard.md).

## Decided stack

```text
Python → Parquet → DuckDB + dbt → mart export → Next.js
```

DuckDB runs locally. There is no cloud warehouse. The dashboard and Ask LendFlow read one exported metric layer. Ask LendFlow V1 is a curated question list, not a live model.

The primary experiment metric is `bank_connection_completion_rate`, among applications that start bank connection.

## Synthetic data

The generator writes 100,000 applications to `data/synthetic/`. It uses one fixed seed. Rebuild and checks:

```bash
make install
make data
```

`make data` replaces the Parquet files and runs the sanity checks. Column rules, the seed, and the seeded processes are in [docs/data-generation.md](docs/data-generation.md).

These tables are not a lender's book of record. Do not treat a rate in the files as a measured business result until EDA is written.

## Governed models

dbt runs locally on DuckDB and the Parquet files in `data/synthetic/`. Staging, intermediate models, and marts live under [transform/](transform/). How to build and how to export marts for a later Next.js app is in [docs/dbt.md](docs/dbt.md).

```bash
make install
make dbt-build
make marts
```

`make marts` rebuilds the models, writes gitignored files under `data/marts/`, and refreshes `web/src/data/dashboard.json`. The dashboard imports that snapshot. It does not query a live database.

Quality checks from the tooling trial:

```bash
make dbt-checkpoint
make dbt-doctor
```

What each command does, and which tools were left unwired, is in [docs/dbt-tooling-trial.md](docs/dbt-tooling-trial.md). Column descriptions, `make pre-commit-install`, and the pull-request workflow are in [docs/dbt-quality.md](docs/dbt-quality.md).

`product_metrics` is the metric table. The primary experiment metric remains `bank_connection_completion_rate` among applications that start bank connection. The marts do not label a segment, a period, or a ship decision. EDA still has to read them.

## Dashboard

```bash
make marts
make web-install
make web-dev
```

Overview, Application Funnel, Operations, Experiment, and Ask LendFlow at `/ask`. A formal EDA notebook is a later contract.

Ask LendFlow matches a fixed question list to `product_metrics` and `fct_experiment_results`. It does not call a model provider. Local run and the Vercel path are in [docs/dashboard.md](docs/dashboard.md).

## Not built yet

A formal EDA notebook is a later contract.
