{% macro portfolio_application_agg(slice_name, slice_expr) %}
select
    '{{ slice_name }}' as slice_name,
    cast({{ slice_expr }} as varchar) as slice_value,
    count(*) as applications_started,
    count(*) filter (where is_submitted) as submitted_applications,
    count(*) filter (where is_decided) as decided_applications,
    count(*) filter (where is_approved) as approved_applications,
    count(*) filter (where is_referred) as referred_applications,
    count(*) filter (where is_declined) as declined_applications,
    count(*) filter (where is_contracted) as contracted_applications,
    count(*) filter (where is_funded) as funded_applications,
    count(*) filter (where reached_personal_info) as personal_info_completed,
    count(*) filter (where reached_bank_connection_started) as bank_connection_started,
    count(*) filter (
        where reached_bank_connection_started and reached_bank_connected
    ) as bank_connected_and_started,
    count(*) filter (
        where reached_bank_connection_started and bank_connection_failure_count > 0
    ) as bank_failed_and_started,
    count(*) filter (where reached_identity_verification_started) as identity_started,
    count(*) filter (
        where reached_identity_verification_started and reached_identity_verified
    ) as identity_verified_and_started,
    count(*) filter (
        where reached_identity_verification_started
          and identity_verification_failure_count > 0
          and not reached_identity_verified
    ) as identity_failed_without_verification,
    count(*) filter (where is_decided and underwriting_path = 'auto') as auto_decisions,
    count(*) filter (where is_decided and manual_review_flag) as manual_decisions,
    median(time_to_submit_minutes) filter (where is_submitted) as median_time_to_submit,
    median(decision_duration_minutes) filter (where is_decided) as median_time_to_decision,
    median(hours_decision_to_funded) filter (where is_funded) as median_time_to_funding,
    median(funding_duration_hours) filter (where is_funded) as median_funding_duration_hours
from {{ ref('fct_applications') }}
where {{ slice_expr }} is not null
group by 1, 2
{% endmacro %}

{% macro portfolio_decided_agg(slice_name, slice_expr) %}
select
    '{{ slice_name }}' as slice_name,
    cast({{ slice_expr }} as varchar) as slice_value,
    count(*) as decided_applications,
    count(*) filter (where is_approved) as approved_applications,
    count(*) filter (where is_referred) as referred_applications,
    count(*) filter (where is_declined) as declined_applications,
    count(*) filter (where is_contracted) as contracted_applications,
    count(*) filter (where is_funded) as funded_applications,
    count(*) filter (where underwriting_path = 'auto') as auto_decisions,
    count(*) filter (where manual_review_flag) as manual_decisions,
    median(decision_duration_minutes) as median_time_to_decision,
    median(hours_decision_to_funded) filter (where is_funded) as median_time_to_funding,
    median(funding_duration_hours) filter (where is_funded) as median_funding_duration_hours
from {{ ref('fct_applications') }}
where is_decided
  and {{ slice_expr }} is not null
group by 1, 2
{% endmacro %}

{% macro funnel_stage_agg(slice_name, slice_expr) %}
select
    '{{ slice_name }}' as slice_name,
    cast({{ slice_expr }} as varchar) as slice_value,
    stage_name,
    any_value(stage_order) as stage_order,
    any_value(next_stage_name) as next_stage_name,
    any_value(failure_event_name) as failure_event_name,
    count(*) filter (where reached) as n_reached,
    count(*) filter (where reached_next) as n_reached_next,
    count(*) filter (where had_failure) as n_failed,
    median(step_duration_minutes) filter (where step_duration_minutes is not null) as median_step_duration_minutes
from {{ ref('fct_application_funnel') }}
where {{ slice_expr }} is not null
group by 1, 2, 3
{% endmacro %}
