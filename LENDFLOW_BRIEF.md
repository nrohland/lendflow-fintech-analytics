# LendFlow — Product Analytics Case Study

> **Working title:** LendFlow  
> **Pitch:** *Approval isn't the finish line. Funding is.*  
> Product analytics for the auto-loan application lifecycle.

## 0. Reference

Use the existing ecommerce case study as the main **visual, narrative, and interaction reference**:

**Northstar — Ecommerce Profitability Analytics**  
https://ecommerce-profitability-analytics.vercel.app/

What to preserve from Northstar:
- Strong one-line business thesis.
- Executive overview before technical detail.
- KPI cards + trends + analyst signals.
- Each section answers a business question rather than merely showing charts.
- Governed metrics shared by dashboard and AI analyst.
- Visible/read-only SQL where useful.
- Minimal, polished UI.
- Synthetic data clearly disclosed.

Do **not** clone the ecommerce content or force the same sections. This project should feel native to Product Analytics and lending.

---

## 1. Objective

Build a portfolio case study that demonstrates how a **Senior Product Data Analyst** would analyze an auto-loan application lifecycle.

The project should demonstrate:

- Product funnel analysis.
- Identification of user pain points and drop-offs.
- Segmentation and diagnostic deep-dives.
- Operational analytics across underwriting and funding.
- Experimentation / statistical analysis.
- SQL + dimensional/event modeling.
- dbt transformations and tests.
- Clear recommendations tied to product/business outcomes.
- AI-assisted analytics over the same governed metric layer.

This is a **fictional case study using 100% synthetic data**. It is Not affiliated with any real lender. and must not imply access to a fictional auto lender proprietary data, systems, customers, models, or internal metrics.

---

## 2. Product question

The central question:

> **Where does the application journey lose qualified applicants, why does it happen, and what should the product team change?**

Supporting questions:

1. Where are the largest funnel drop-offs?
2. Which drop-offs are controllable product problems?
3. Which applicant/device/channel segments behave differently?
4. How long does each lifecycle stage take?
5. Where do underwriting/manual-review bottlenecks appear?
6. Does approval translate into funded loans?
7. Which product intervention should be tested first?
8. Did the experiment improve conversion without damaging guardrail metrics?

---

## 3. V1 scope

Keep V1 deliberately small.

### Pages / sections

1. **Overview**
2. **Application Funnel**
3. **Operations**
4. **Experiment**
5. **Ask LendFlow**

No additional pages until these work end-to-end.

---

# 4. Application lifecycle

Model the following simplified lifecycle:

```text
Application Started
        ↓
Personal Info Completed
        ↓
Bank Connection Started
        ↓
Bank Connected
        ↓
Identity Verified
        ↓
Application Submitted
        ↓
Underwriting Decision
   ↙        ↓        ↘
Approved  Referred  Declined
        ↓
Vehicle Selected
        ↓
Contract Signed
        ↓
Loan Funded
```

The exact funnel can evolve after EDA, but avoid adding stages unless they answer a useful analytical question.

---

# 5. Core metrics

## Acquisition / funnel

- Applications started
- Application completion rate
- Step conversion rate
- Step drop-off rate
- Submitted applications
- Median time to submit

## Underwriting

- Approval rate
- Decline rate
- Referral/manual-review rate
- Auto-decision rate
- Median time to decision
- Decision SLA attainment

## Funding

- Approved → contracted conversion
- Approved → funded conversion
- Contracted → funded conversion
- Median time to funding
- Funding SLA attainment

## Experience

- Bank connection success rate
- Identity verification success rate
- Error rate by funnel step
- Median duration by funnel step

## Experimentation

- Primary metric uplift
- Secondary metric uplift
- Absolute percentage-point change
- Relative uplift
- Confidence interval
- p-value
- Sample size
- Guardrail metrics

---

# 6. Synthetic dataset

Generate enough data for realistic segmentation and statistical testing.

Initial target:

**~100,000 synthetic applications**

The generator must be deterministic using a fixed seed.

## Core tables

### `applicants`

```text
applicant_id
created_at
age_band
income_band
employment_type
state
returning_user
```

Avoid unnecessary sensitive attributes.

### `applications`

```text
application_id
applicant_id
started_at
submitted_at
decision_at
contracted_at
funded_at
acquisition_channel
device_type
browser
application_status
underwriting_path
experiment_variant
```

### `events`

Event-style product analytics table.

```text
event_id
applicant_id
application_id
session_id
event_timestamp
event_name
device_type
browser
acquisition_channel
experiment_variant
error_code
```

Possible events:

```text
application_started
personal_info_completed
bank_connection_started
bank_connection_failed
bank_connected
identity_verification_started
identity_verification_failed
identity_verified
application_submitted
underwriting_started
manual_review_started
decision_approved
decision_declined
decision_referred
vehicle_selected
contract_started
contract_signed
funding_started
loan_funded
```

### `underwriting_decisions`

```text
application_id
decision_timestamp
decision
decision_path
manual_review_flag
decision_duration_minutes
risk_band
```

`risk_band` is synthetic and exists only for analytical segmentation. Do not attempt to reproduce a real credit model.

### `funding_events`

```text
application_id
funding_status
funding_timestamp
funding_duration_hours
stipulation_flag
```

### `experiments`

```text
application_id
experiment_name
variant
assigned_at
```

---

# 7. Seeded analytical problems

The synthetic generator should intentionally create several patterns that can later be **discovered through EDA**.

Do not hard-code the conclusions into the dashboard.

## Signal 1 — Mobile bank-connection friction

Mobile Safari should have materially worse bank-connection completion than comparable devices/browsers.

Possible underlying mechanism:
- elevated `bank_connection_failed` events.

Expected analytical path:

```text
Overall funnel
→ bank connection drop-off
→ device segmentation
→ browser segmentation
→ Mobile Safari anomaly
```

---

## Signal 2 — High-volume / low-quality acquisition channel

One acquisition channel should generate strong application-start volume but weak:

- submission conversion and/or
- approval → funding conversion.

Purpose:

Show why optimizing acquisition on application volume alone can be misleading.

---

## Signal 3 — Manual-review bottleneck

Manual-review applications should represent a minority of applications but a disproportionate share of applications exceeding decision SLA.

Potential insight:

> Manual review is operationally expensive and may contain cases that could be automatically resolved.

Do **not** assume automation is the solution. The analysis should first determine where the bottleneck exists.

---

## Signal 4 — Approval ≠ funding

Create a period/segment where approval rate improves while funded-loan conversion does not.

Purpose:

Demonstrate that approval rate alone is an incomplete product/business KPI.

This supports the project thesis:

> **Approval isn't the finish line. Funding is.**

---

## Signal 5 — Identity verification friction

Create a smaller but meaningful segment with longer KYC/identity-verification duration and higher abandonment.

EDA should determine whether this is associated with device, time, channel, or another permitted synthetic dimension.

---

## Signal 6 — Successful product experiment

Create an A/B experiment around the bank-connection experience.

The treatment should improve the primary conversion metric while leaving important downstream guardrails approximately unchanged.

---

# 8. Experiment

## Hypothesis

Reducing friction and improving clarity during bank connection will increase successful bank connections and completed applications.

## Example experiment

**Control**

Current bank-connection experience.

**Treatment**

Simplified copy / UX explaining why bank connection is required and emphasizing secure, fast income verification.

Do not claim this reproduces a real a fictional auto lender or Plaid interface.

## Primary metric

```text
bank_connection_completion_rate
```

## Secondary metric

```text
application_submission_rate
```

## Guardrails

```text
approval_rate
identity_verification_failure_rate
median_time_to_submit
```

Optional downstream exploratory metric:

```text
funding_rate
```

## Analysis

Calculate:

- sample size by variant;
- conversion by variant;
- absolute uplift;
- relative uplift;
- confidence interval;
- statistical significance;
- guardrail movement.

The dashboard must distinguish statistical evidence from business interpretation.

---

# 9. Dashboard

## 01 — Executive Overview

Headline:

> **Approval isn't the finish line. Funding is.**

Possible KPI cards:

```text
Applications Started
Completion Rate
Approval Rate
Funding Rate
Median Time to Decision
```

Visuals:

- lifecycle trend;
- compact end-to-end funnel;
- 3 analyst signals.

Example analyst signals:

```text
01 — Funnel friction
Bank connection is the largest controllable abandonment point.

02 — Operational bottleneck
Manual-review applications disproportionately miss decision SLA.

03 — Approval ≠ funding
Higher approvals are not translating proportionally into funded loans.
```

These texts must ultimately be generated from the actual synthetic results, not copied blindly.

---

## 02 — Application Funnel

Show:

```text
Step
Users / Applications
Step Conversion
Drop-off
Median Time
Error Rate
```

Allow segmentation by:

- device;
- browser;
- acquisition channel;
- returning/new user;
- time period.

The page should answer:

> **Where are qualified applicants experiencing unnecessary friction?**

---

## 03 — Operations

Split into two logical areas.

### Underwriting

```text
Auto-decision %
Manual review %
Approval rate
Median decision time
Decision SLA %
```

### Funding

```text
Approval → funding %
Contract → funding %
Median funding time
Funding SLA %
```

Focus on bottlenecks rather than operational vanity metrics.

---

## 04 — Experiment

Show:

- hypothesis;
- control vs treatment;
- primary result;
- confidence interval;
- significance;
- guardrails;
- recommendation.

End with a clear decision:

```text
Ship
Iterate
Do not ship
```

The decision must be supported by the experiment results.

---

# 10. Ask LendFlow

Add a lightweight AI/product-analytics interaction inspired by **Ask Northstar**.

Example questions:

```text
Where do applicants drop off most?

Which segment has the longest underwriting time?

Why did funding conversion decline?

How does manual review affect decision time?

Did the bank-connection experiment improve completion?

Show the funnel for mobile applicants from paid search.
```

Requirements:

- answers use the same governed metrics as the dashboard;
- SQL is read-only;
- SQL can be displayed to the user;
- never fabricate metrics;
- clearly label AI-generated interpretation;
- deterministic demo responses are acceptable for V1 if a live LLM would add unnecessary complexity.

---

# 11. Proposed architecture

Keep the architecture intentionally simple.

```text
Synthetic Data Generator
        ↓
      Parquet
        ↓
      DuckDB
        ↓
        dbt
        ↓
Analytics / Metric Models
        ↓
      Next.js
      ↙     ↘
Dashboard   Ask LendFlow
```

Suggested technologies:

```text
Python
Parquet
DuckDB
dbt
SQL
Next.js
Recharts
Git
```

---

# 12. dbt structure

Suggested structure:

```text
models/
├── staging/
│   ├── stg_applicants.sql
│   ├── stg_applications.sql
│   ├── stg_events.sql
│   ├── stg_underwriting_decisions.sql
│   ├── stg_funding_events.sql
│   └── stg_experiments.sql
│
├── intermediate/
│   ├── int_application_funnel.sql
│   ├── int_application_durations.sql
│   └── int_experiment_assignments.sql
│
└── marts/
    ├── fct_applications.sql
    ├── fct_application_funnel.sql
    ├── fct_underwriting.sql
    ├── fct_funding.sql
    ├── fct_experiment_results.sql
    └── product_metrics.sql
```

Add schema documentation and tests.

---

# 13. Data quality

Minimum automated checks:

- unique `application_id`;
- valid applicant/application relationships;
- no funding before approval;
- no contract before application submission;
- valid lifecycle timestamp ordering;
- valid experiment variants;
- no duplicate experiment assignment;
- allowed application statuses;
- allowed event names;
- required timestamps not null where appropriate;
- metric reconciliation between funnel and application facts.

Prefer a small number of meaningful tests over dozens of superficial checks.

---

# 14. EDA requirements

**Do EDA before building the dashboard.**

The EDA should answer:

1. Is the generated dataset internally consistent?
2. What does the baseline funnel look like?
3. Where is the largest drop-off?
4. Which segments explain it?
5. What drives decision latency?
6. What drives funding conversion?
7. Are the seeded patterns detectable without knowing their implementation?
8. Does the experiment produce a plausible measurable effect?
9. Are there accidental/unrealistic correlations that should be removed?

Document findings before implementing UI.

The dashboard should reflect the findings from EDA rather than a predetermined story.

---

# 15. Development phases

## Phase 1 — Product definition

- Finalize lifecycle.
- Finalize metric definitions.
- Finalize dataset grain.
- Define synthetic assumptions.
- Define experiment.

**Output:** concise analytical specification.

## Phase 2 — Data generation

- Build deterministic Python generator.
- Generate Parquet datasets.
- Add sanity checks.

**Output:** reproducible synthetic source data.

## Phase 3 — EDA

- Profile funnel.
- Segment behavior.
- Investigate operational latency.
- Validate experiment.
- Identify the strongest 3–5 insights.

**Output:** notebook/report with findings.

## Phase 4 — dbt

- Build staging.
- Build intermediate models.
- Build marts.
- Add tests/documentation.
- Reconcile metrics.

**Output:** governed analytical layer.

## Phase 5 — Dashboard

Build only:

```text
Overview
Application Funnel
Operations
Experiment
```

Use Northstar as the UX benchmark.

**Output:** deployed portfolio case study.

## Phase 6 — Ask LendFlow

Connect the analytical Q&A experience to the governed metric layer.

**Output:** AI-assisted analytics demo.

## Phase 7 — Portfolio polish

- README.
- Architecture diagram.
- Methodology.
- Synthetic-data disclaimer.
- Screenshots.
- Deployment.
- Interview walkthrough.

---

# 16. Non-goals for V1

Do **not** add these unless a concrete requirement emerges:

- Airflow
- Dagster
- Kafka
- GCP infrastructure
- BigQuery
- Snowflake
- Databricks
- Kubernetes
- production ML models
- real credit scoring
- real applicant data
- real a fictional auto lender data
- complex agent orchestration
- authentication
- multi-user permissions
- production-grade LLM infrastructure

The portfolio value should come from:

> **Product thinking + analytical depth + SQL/modeling + experimentation + communication**

—not infrastructure complexity.

---

# 17. Success criteria

The project is ready to show in an interview when a reviewer can understand, in ~5 minutes:

1. **What problem are we solving?**
2. **Where does the funnel break?**
3. **Why does it break?**
4. **What is the business/product impact?**
5. **What would we change?**
6. **How would we validate the change?**

A successful walkthrough should follow:

```text
Problem
   ↓
Metric
   ↓
Funnel
   ↓
Deep Dive
   ↓
Insight
   ↓
Hypothesis
   ↓
Experiment
   ↓
Decision
```

---

# 18. Interview narrative

Suggested framing:

> I wanted to practice the type of problem a Senior Product Analyst faces across an application lifecycle. Since I obviously don't have access to proprietary company data, I created a deterministic synthetic event dataset representing an auto-loan journey. I modeled the data, explored the funnel, diagnosed product and operational friction, and designed an experiment around one of the strongest opportunities.

Then demonstrate:

```text
Overview
→ Funnel problem
→ Segment deep-dive
→ Operational impact
→ Experiment
→ Recommendation
```

The goal is not to present a fictional answer about a fictional auto lender.

The goal is to demonstrate **how the analysis would be approached**.
