-- Rate components add back to their denominator. Step conversion matches the
-- bank-connection completion rate. Error rates stay null where no failure event exists.
with decision_parts as (
    select
        slice_name,
        slice_value,
        max(case when metric_name = 'approval_rate' then numerator end) as approved_n,
        max(case when metric_name = 'decline_rate' then numerator end) as declined_n,
        max(case when metric_name = 'referral_rate' then numerator end) as referred_n,
        max(case when metric_name = 'approval_rate' then denominator end) as decided_n,
        max(case when metric_name = 'auto_decision_rate' then numerator end) as auto_n,
        max(case when metric_name = 'manual_review_rate' then numerator end) as manual_n,
        max(case when metric_name = 'auto_decision_rate' then denominator end) as auto_den
    from {{ ref('product_metrics') }}
    where stage_name is null
      and metric_name in (
          'approval_rate',
          'decline_rate',
          'referral_rate',
          'auto_decision_rate',
          'manual_review_rate'
      )
    group by slice_name, slice_value
),

bounds as (
    select metric_name, stage_name, slice_name, slice_value, metric_value
    from {{ ref('product_metrics') }}
    where unit = 'proportion'
      and metric_value is not null
      and (metric_value < -1e-9 or metric_value > 1 + 1e-9)
),

bank_step as (
    select
        completion.metric_value as completion_rate,
        steps.metric_value as step_rate,
        failure.metric_value as failure_incidence,
        errors.metric_value as error_rate
    from {{ ref('product_metrics') }} as completion
    inner join {{ ref('product_metrics') }} as steps
        on steps.metric_name = 'step_conversion_rate'
        and steps.stage_name = 'bank_connection_started'
        and steps.slice_name = 'overall'
        and steps.slice_value = 'all'
    inner join {{ ref('product_metrics') }} as failure
        on failure.metric_name = 'bank_connection_failure_incidence'
        and failure.slice_name = 'overall'
        and failure.stage_name is null
    inner join {{ ref('product_metrics') }} as errors
        on errors.metric_name = 'error_rate'
        and errors.stage_name = 'bank_connection_started'
        and errors.slice_name = 'overall'
    where completion.metric_name = 'bank_connection_completion_rate'
      and completion.slice_name = 'overall'
      and completion.stage_name is null
),

experiment_match as (
    select
        results.metric_name,
        results.control_value,
        control_metric.metric_value as control_metric_value,
        results.treatment_value,
        treatment_metric.metric_value as treatment_metric_value
    from {{ ref('fct_experiment_results') }} as results
    inner join {{ ref('product_metrics') }} as control_metric
        on control_metric.metric_name = results.metric_name
        and control_metric.slice_name = 'experiment_variant'
        and control_metric.slice_value = 'control'
        and control_metric.stage_name is null
    inner join {{ ref('product_metrics') }} as treatment_metric
        on treatment_metric.metric_name = results.metric_name
        and treatment_metric.slice_name = 'experiment_variant'
        and treatment_metric.slice_value = 'treatment'
        and treatment_metric.stage_name is null
    where results.metric_name in (
        'bank_connection_completion_rate',
        'application_submission_rate',
        'approval_rate',
        'identity_verification_failure_rate',
        'median_time_to_submit',
        'funding_rate'
    )
),

defined_error as (
    select stage_name, metric_value, denominator
    from {{ ref('product_metrics') }}
    where metric_name = 'error_rate'
      and slice_name = 'overall'
      and (
          (
              stage_name in ('bank_connection_started', 'identity_verification_started')
              and denominator > 0
              and metric_value is null
          )
          or (
              stage_name not in ('bank_connection_started', 'identity_verification_started')
              and metric_value is not null
          )
      )
)

select slice_name || '|' || slice_value as detail, 'decision_parts_do_not_sum' as reason
from decision_parts
where approved_n + declined_n + referred_n is distinct from decided_n
   or auto_n + manual_n is distinct from decided_n
   or auto_den is distinct from decided_n

union all

select metric_name || '|' || coalesce(stage_name, '') || '|' || slice_name || '|' || slice_value,
    'proportion_out_of_range' as reason
from bounds

union all

select 'bank_connection', 'completion_disagrees_with_step_or_error' as reason
from bank_step
where abs(completion_rate - step_rate) > 1e-9
   or abs(failure_incidence - error_rate) > 1e-9

union all

select metric_name, 'experiment_disagrees_with_variant_slice' as reason
from experiment_match
where abs(control_value - control_metric_value) > 1e-6
   or abs(treatment_value - treatment_metric_value) > 1e-6

union all

select stage_name, 'error_rate_nullability' as reason
from defined_error
