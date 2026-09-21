# Governed models

Local DuckDB and dbt. The project reads the Parquet files in `data/synthetic/` and builds staging, intermediate, and mart models. Nothing here calls a warehouse.

Metric formulas stay in the [analytical spec](../specs/analytical-spec.md). This page is how to run the project and how the marts are shaped. It does not state what the synthetic rates mean. EDA writes that.

## Run

From the repository root, with Python 3.11+:

```bash
make install
make dbt-build
```

`make install` creates `.venv` and installs `requirements.txt`, including `dbt-duckdb`. `make dbt-build` runs `dbt build` against `transform/` and the local file `transform/target/lendflow.duckdb`. That command builds the models and runs the tests. The database file is gitignored.

The Makefile passes an absolute `parquet_root` var and sets `LENDFLOW_DUCKDB` to `transform/target/lendflow.duckdb`. Override that database path if you invoke dbt yourself. Run from the repository root so the default relative Parquet path resolves:

```bash
export LENDFLOW_DUCKDB="$PWD/transform/target/lendflow.duckdb"
.venv/bin/dbt build --project-dir transform --profiles-dir transform --vars "{parquet_root: $PWD/data/synthetic}"
```

`profiles.yml.example` matches `transform/profiles.yml`. The profile has no credentials.

## Export for Next.js

The dashboard is a later contract. It should read this export, not a live database.

```bash
make marts
```

`make marts` is `dbt build` and then `scripts/export_marts.py`. The script writes `data/marts/`, which is gitignored, so a fresh build is the publish step.

```text
data/marts/fct_applications.parquet
data/marts/fct_application_funnel.parquet
data/marts/fct_underwriting.parquet
data/marts/fct_funding.parquet
data/marts/fct_experiment_results.parquet
data/marts/product_metrics.parquet
data/marts/metrics.json
```

`metrics.json` holds `product_metrics`, `fct_experiment_results`, row counts, the source manifest, and the compiled SQL for the six marts. `product_decision` is null. This layer does not choose Ship, Iterate, or Do not ship.

## Layout

```text
transform/models/staging/        stg_applicants, stg_applications, stg_events,
                                 stg_underwriting_decisions, stg_funding_events,
                                 stg_experiments
transform/models/intermediate/   int_application_funnel, int_application_durations,
                                 int_experiment_assignments
transform/models/marts/          fct_applications, fct_application_funnel,
                                 fct_underwriting, fct_funding,
                                 fct_experiment_results, product_metrics
```

`int_application_funnel` is one row per application, with a timestamp per stage. `fct_application_funnel` is one row per application and stage. `stage_order` is only a display sequence. Step conversion follows `next_stage_name`.

`identity_verification_started` is a work stage between bank connected and identity verified. It is how identity duration and the identity error rate are computed. It is not an extra step in the lifecycle chain from bank connected to identity verified.

## Metrics

`product_metrics` is the metric table. Grain is `metric_name`, `stage_name`, `slice_name`, `slice_value`.

`stage_name` is null when the metric is not a funnel step. The overall slice uses `slice_name = 'overall'` and `slice_value = 'all'`.

Rates are proportions in `[0, 1]`. A count metric stores the count in `metric_value` and `numerator`, and leaves `denominator` null. A median stores the median in `metric_value` and the completer count in `denominator`.

`bank_connection_completion_rate` uses applications that start bank connection as the denominator. Applications that never start are outside that metric. They are in `bank_connection_start_rate` instead. A `bank_connection_failed` event does not cancel completion.

Cuts on the application and funnel metrics: `device_type`, `browser`, `device_browser` (`device_type|browser`), `acquisition_channel`, `returning_user`, `started_week` (UTC Monday), `started_month`, `age_band`, `income_band`, `employment_type`, `state`, and `experiment_variant`.

`risk_band` and `underwriting_path` are slices only on decision and post-approval metrics. Both are unknown before a decision, so they are not cuts of the pre-decision funnel.

`error_rate` is null on stages that have no failure event. A null there means the rate is undefined, not zero. The failure events in this version are `bank_connection_failed` and `identity_verification_failed`.

`median_funding_duration_hours` is the median of `funded_at - contracted_at` among funded loans. That is the funding SLA clock. `median_time_to_funding` is `funded_at - decision_at`, in hours. Neither metric is an attainment percent.

Decision SLA attainment and funding SLA attainment are not in the marts. The limits are unset.

## Experiment

`fct_experiment_results` has one row per metric for `bank_connection_clarity`.

| Metric | Role | Population |
| --- | --- | --- |
| `bank_connection_completion_rate` | primary | applications that start bank connection |
| `application_submission_rate` | secondary | all assigned applications |
| `approval_rate` | guardrail | decided applications |
| `identity_verification_failure_rate` | guardrail | applications that start identity verification |
| `median_time_to_submit` | guardrail | submitted applications |
| `funding_rate` | exploratory | all assigned applications |

For a proportion, `absolute_difference` is treatment minus control, on the proportion scale. `absolute_difference_pp` is that difference in percentage points. The interval is a 95% Wald interval. The test is a two-sided two-proportion z-test at alpha 0.05. `null_rejected_at_alpha` records that comparison. It is not a product recommendation.

The median guardrail is not a proportion. Its interval uses a normal approximation to the standard error of the median (`test_method = median_difference_normal_approx`). Guardrail rows have no pass or fail flag. A numeric margin for "approximately unchanged" is still unset.

`n_assigned_outside_population_*` is assigned applications that are outside that row's denominator. On the primary row, that is applications that never start bank connection.

## Tests

`dbt build` runs them. The meaningful checks are:

- unique `application_id` on applications, decisions, funding, and the experiment assignment
- applicant and event relationships
- lifecycle timestamp order, including work events inside their stage
- no funding before approval, and a funding row if and only if the decision is approved
- no contract before submission
- `bank_connected` implies `bank_connection_started`
- recorded `decision_duration_minutes` and `funding_duration_hours` match the timestamp deltas
- one `bank_connection_clarity` assignment per application, variant in `{control, treatment}`, `assigned_at` equal to `started_at`
- status and event names in the spec sets, failure events carry `error_code`, other events do not
- stage counts for starts, submissions, approvals, and funded loans match across `fct_applications`, `fct_application_funnel`, and overall `product_metrics`
- approved + referred + declined = decided, and auto + manual = decided, on every slice
- the primary completion rate matches the bank-connection step conversion, and the variant slices match `fct_experiment_results`

## Left out on purpose

- A ship / iterate / do not ship label
- SLA attainment percents
- A pass or fail mark on guardrails
- Columns that name a segment or a period as the cause of a pattern
- The Next.js app and Ask LendFlow
