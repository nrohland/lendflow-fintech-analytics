-- Starts, submissions, approvals, and funded counts agree across the application
-- fact, the funnel fact, and the overall product_metrics rows.
with app_counts as (
    select
        count(*) as applications_started,
        count(*) filter (where is_submitted) as submitted_applications,
        count(*) filter (where is_approved) as approved_applications,
        count(*) filter (where is_funded) as funded_applications,
        count(*) filter (where reached_bank_connection_started) as bank_connection_started,
        count(*) filter (where reached_bank_connected) as bank_connected,
        count(*) filter (where is_decided) as decided_applications
    from {{ ref('fct_applications') }}
),

funnel_counts as (
    select
        count(*) filter (where stage_name = 'application_started' and reached) as applications_started,
        count(*) filter (where stage_name = 'application_submitted' and reached) as submitted_applications,
        count(*) filter (where stage_name = 'approved' and reached) as approved_applications,
        count(*) filter (where stage_name = 'loan_funded' and reached) as funded_applications,
        count(*) filter (where stage_name = 'bank_connection_started' and reached) as bank_connection_started,
        count(*) filter (where stage_name = 'bank_connected' and reached) as bank_connected,
        count(*) filter (where stage_name = 'decided' and reached) as decided_applications
    from {{ ref('fct_application_funnel') }}
),

metric_counts as (
    select
        max(case when metric_name = 'applications_started' then cast(metric_value as bigint) end) as applications_started,
        max(case when metric_name = 'submitted_applications' then cast(metric_value as bigint) end) as submitted_applications,
        max(case when metric_name = 'approved_applications' then cast(metric_value as bigint) end) as approved_applications,
        max(case when metric_name = 'funded_applications' then cast(metric_value as bigint) end) as funded_applications,
        max(case when metric_name = 'decided_applications' then cast(metric_value as bigint) end) as decided_applications,
        max(case when metric_name = 'bank_connection_completion_rate' then denominator end) as bank_connection_started,
        max(case when metric_name = 'bank_connection_completion_rate' then numerator end) as bank_connected,
        max(case when metric_name = 'application_completion_rate' then numerator end) as submitted_from_rate,
        max(case when metric_name = 'application_completion_rate' then denominator end) as started_from_rate,
        max(case when metric_name = 'approval_rate' then numerator end) as approved_from_rate,
        max(case when metric_name = 'funding_rate' then numerator end) as funded_from_rate,
        max(case when metric_name = 'funding_rate' then denominator end) as started_from_funding
    from {{ ref('product_metrics') }}
    where slice_name = 'overall'
      and stage_name is null
),

step_counts as (
    select
        max(case when stage_name = 'application_started' then denominator end) as applications_started,
        max(case when stage_name = 'bank_connection_started' then denominator end) as bank_connection_started,
        max(case when stage_name = 'bank_connection_started' then numerator end) as bank_connected,
        max(case when stage_name = 'application_submitted' then denominator end) as submitted_applications,
        max(case when stage_name = 'approved' then denominator end) as approved_applications,
        max(case when stage_name = 'contract_signed' then numerator end) as funded_applications
    from {{ ref('product_metrics') }}
    where slice_name = 'overall'
      and metric_name = 'step_conversion_rate'
),

compared as (
    select
        'applications_started' as metric_name,
        app_counts.applications_started as application_n,
        funnel_counts.applications_started as funnel_n,
        metric_counts.applications_started as metric_n
    from app_counts, funnel_counts, metric_counts
    union all
    select 'submitted_applications', app_counts.submitted_applications, funnel_counts.submitted_applications, metric_counts.submitted_applications
    from app_counts, funnel_counts, metric_counts
    union all
    select 'approved_applications', app_counts.approved_applications, funnel_counts.approved_applications, metric_counts.approved_applications
    from app_counts, funnel_counts, metric_counts
    union all
    select 'funded_applications', app_counts.funded_applications, funnel_counts.funded_applications, metric_counts.funded_applications
    from app_counts, funnel_counts, metric_counts
    union all
    select 'decided_applications', app_counts.decided_applications, funnel_counts.decided_applications, metric_counts.decided_applications
    from app_counts, funnel_counts, metric_counts
    union all
    select 'bank_connection_started', app_counts.bank_connection_started, funnel_counts.bank_connection_started, metric_counts.bank_connection_started
    from app_counts, funnel_counts, metric_counts
    union all
    select 'bank_connected', app_counts.bank_connected, funnel_counts.bank_connected, metric_counts.bank_connected
    from app_counts, funnel_counts, metric_counts
    union all
    select 'completion_numerator_is_submitted', app_counts.submitted_applications, metric_counts.submitted_from_rate, metric_counts.submitted_from_rate
    from app_counts, metric_counts
    union all
    select 'completion_denominator_is_started', app_counts.applications_started, metric_counts.started_from_rate, metric_counts.started_from_rate
    from app_counts, metric_counts
    union all
    select 'approval_numerator', app_counts.approved_applications, metric_counts.approved_from_rate, metric_counts.approved_from_rate
    from app_counts, metric_counts
    union all
    select 'funding_numerator', app_counts.funded_applications, metric_counts.funded_from_rate, metric_counts.funded_from_rate
    from app_counts, metric_counts
    union all
    select 'funding_denominator', app_counts.applications_started, metric_counts.started_from_funding, metric_counts.started_from_funding
    from app_counts, metric_counts
    union all
    select 'step_started', app_counts.applications_started, step_counts.applications_started, step_counts.applications_started
    from app_counts, step_counts
    union all
    select 'step_bank_started', app_counts.bank_connection_started, step_counts.bank_connection_started, step_counts.bank_connection_started
    from app_counts, step_counts
    union all
    select 'step_bank_connected', app_counts.bank_connected, step_counts.bank_connected, step_counts.bank_connected
    from app_counts, step_counts
    union all
    select 'step_submitted', app_counts.submitted_applications, step_counts.submitted_applications, step_counts.submitted_applications
    from app_counts, step_counts
    union all
    select 'step_approved', app_counts.approved_applications, step_counts.approved_applications, step_counts.approved_applications
    from app_counts, step_counts
    union all
    select 'step_funded', app_counts.funded_applications, step_counts.funded_applications, step_counts.funded_applications
    from app_counts, step_counts
)

select metric_name, application_n, funnel_n, metric_n
from compared
where application_n is distinct from funnel_n
   or application_n is distinct from metric_n
