# Synthetic data

The files in `data/synthetic/` are entirely synthetic. A fixed-seed Python generator wrote them for this portfolio case study. They are not customer records, not a lender's book, and not affiliated with any lender. Do not quote a rate from these tables as a measured business result. EDA writes the findings.

The analytical spec locks grains, metrics, and the six patterns. Magnitudes live in `scripts/lendflow_synth/parameters.py`. This page is the operator's copy of that contract.

## Regenerate

From the repository root, with Python 3.11+:

```bash
make install
make data
```

`make install` creates `.venv` and installs `requirements.txt`. `make data` runs the generator, replaces the Parquet files, and runs `scripts/check_synthetic_data.py`. The check writes `data/synthetic/sanity_report.json` and exits non-zero on a failure.

Pinned direct dependencies at the time of generation:

```text
numpy==2.2.6
pandas==2.3.3
pyarrow==21.0.0
duckdb==1.4.4
```

| Parameter | Value |
| --- | --- |
| Seed | `20260921` |
| Applications | 100,000 exactly |
| Tolerance | 98,000–102,000 if a later edit changes the count |
| Applicants | 96,000, plus 4,000 second applications |
| Window | `2025-01-06T00:00:00Z` inclusive to `2025-06-30T00:00:00Z` exclusive |
| Later period | `started_at` on or after `2025-05-05T00:00:00Z` |
| Experiment | `bank_connection_clarity`, assigned at `application_started` |

Output directory: `data/synthetic/`. One Parquet file per table, plus `manifest.json`.

```text
applicants.parquet
applications.parquet
events.parquet
underwriting_decisions.parquet
funding_events.parquet
experiments.parquet
```

IDs are surrogate keys (`apl_`, `app_`, `evt_`, `ses_`), zero-padded, not time order. Sort by `started_at` for a calendar view.

Same seed, same code, and these pins reproduce the same tables. On the generation machine the Parquet bytes matched across two runs. A different NumPy or PyArrow build can change bytes even when the rows match.

## What the columns mean

Grains and metric formulas stay in the [analytical spec](../specs/analytical-spec.md). Additions this generator commits to:

| Item | Rule |
| --- | --- |
| `returning_user` | True when `created_at` is at least 30 days before the applicant's first in-window `started_at`. It is not "this person has two applications." |
| Second application | 4,000 applicants have a second in-window application, at least 7 days after the first. A person can land in both variants. |
| `risk_band` | `low`, `moderate`, `elevated`, `high`. Drawn from `income_band`. Stored on the decision row. Not a credit model. |
| `state` | Twenty postal codes plus `OTHER` for the collapsed remainder. `OTHER` is not a state. |
| Closed cohort | Every submitted application has one terminal decision. `referred` and `declined` stop. No second decision. |
| `underwriting_path` | Null until that decision. `manual` matches `manual_review_started` and `manual_review_flag`. |
| One session | Each application has one `session_id`. Device, browser, channel, and variant on events are copied from the application. |
| Bank or identity drop-off | An unfinished bank connection has at least one `bank_connection_failed`. An unfinished identity verification has at least one `identity_verification_failed`. A later success still counts as completion. |
| `error_code` | Null except on those two failure events. Codes are generic (`session_timeout`, `institution_unavailable`, `credential_rejected`, `user_abandoned`, `document_unreadable`, `selfie_mismatch`, `session_expired`). |
| `funding_events` | One row per approved application. `funding_timestamp` equals `funded_at` when funded, otherwise null. `funding_duration_hours` is `funded_at - contracted_at` in hours when funded, otherwise null. |
| `stipulation_flag` | On every approved row. It lowers the chance the loan funds. It is not a stage. |
| Decision and funding SLAs | Not set. The checker uses a 24-hour cut only to test that long decisions concentrate on the manual path. That cut is not a product SLA. |

`paid_search` is one of the channel values, so a later catalog question can use that name.

Allowed levels for age, income, employment, channel, device, and browser are the tuples in `parameters.py`. Browser is conditional on device: `samsung_internet` is mobile only, `firefox` and `edge` are desktop only.

## Seeded processes

These are inputs to the generator. They are not labels on the tables and they are not dashboard sentences. Variant is an input only to bank-connection failure and recovery. The other processes do not read variant.

1. **Mobile Safari bank connection.** `device_type = mobile` and `browser = safari` has a higher first-failure probability and a lower recovery probability than other device/browser pairs, in both variants. Desktop Safari is not given that shift.
2. **`social_prospecting`.** Highest start share (probability 0.30). Lower probabilities of personal-info completion, bank-connection start, and submission. After approval, lower vehicle and contract continuation and a higher stipulation floor. Approval, given `risk_band`, does not depend on channel.
3. **Manual review.** Probability rises with `risk_band` (about 4% to 26%). Most manual decisions use a median of 36 hours. About 12% of manual decisions are a short draw (median 90 minutes). About 2% of auto decisions use a delayed draw (median 30 hours). Auto is otherwise a median of 18 minutes.
4. **Later period.** From 2025-05-05, approval probabilities rise, especially for `elevated` and `high`. Vehicle and contract continuation fall for those bands, and stipulations rise. The assignment coin does not depend on the date.
5. **Tablet identity.** `device_type = tablet` has a higher identity-failure probability, a lower recovery probability, and a longer completer duration (median 26 minutes versus 5.5).
6. **`bank_connection_clarity`.** Treatment lowers bank-connection first-failure probability and raises recovery, including inside Mobile Safari. Approval, identity failure, and the other stage durations do not read variant.

Failure and recovery probabilities, and the duration medians, are the constants `P_BANK_FAIL`, `P_BANK_RECOVER`, `P_ID_FAIL`, `P_ID_RECOVER`, `P_APPROVE`, and `D_*` in `parameters.py`.

## Checks

`scripts/check_synthetic_data.py` reads the Parquet files with DuckDB. It fails the process if any check fails. The families are:

- uniqueness of applicant, application, event, decision, funding, and experiment assignment
- foreign keys across the six tables
- strictly increasing event timestamps and stage order
- canonical clocks equal the matching events
- no contract before submission
- no funding before an approval, and a funding row if and only if the decision is `approved`
- one `bank_connection_clarity` assignment per application, variant in `{control, treatment}`, `assigned_at = started_at`
- status, event names, error codes, and device/browser pairs in the published sets
- the six processes above still show up at the thresholds written in the check script

The pattern thresholds are generator self-checks. They are not a ship decision and they are not SLA attainment.

## Limits

- No dashboard, Ask LendFlow, or dbt marts in this contract.
- Decision SLA and funding SLA still have no numeric limit.
- Guardrail margins for a pass/fail label are still unset. The generator keeps approval, identity-failure, and median time-to-submit close across variants; the check records the gaps.
- Applications are generated as independent rows. About 4% are a second application from the same person. Clustering by `applicant_id` is a later contract, as the spec says.
- Rebuilds are local. There is no warehouse and no cloud spend.
