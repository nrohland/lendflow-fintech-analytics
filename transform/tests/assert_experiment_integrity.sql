-- One bank_connection_clarity assignment per application. Variant matches the application.
-- The results mart carries the locked metric set and both variants.
with assignment_counts as (
    select application_id, count(*) as n_assignments
    from {{ ref('stg_experiments') }}
    where experiment_name = '{{ var("experiment_name") }}'
    group by application_id
),

failures as (
    select apps.application_id as detail, 'missing_assignment' as reason
    from {{ ref('stg_applications') }} as apps
    left join assignment_counts
        on apps.application_id = assignment_counts.application_id
    where coalesce(assignment_counts.n_assignments, 0) <> 1

    union all

    select apps.application_id, 'variant_or_assigned_at_mismatch' as reason
    from {{ ref('stg_applications') }} as apps
    inner join {{ ref('stg_experiments') }} as experiments
        on apps.application_id = experiments.application_id
        and experiments.experiment_name = '{{ var("experiment_name") }}'
    where apps.experiment_variant is distinct from experiments.variant
       or apps.started_at is distinct from experiments.assigned_at

    union all

    select application_id, 'fact_variant_mismatch' as reason
    from {{ ref('fct_applications') }}
    where experiment_variant is distinct from application_experiment_variant
       or experiment_name is distinct from '{{ var("experiment_name") }}'

    union all

    select metric_name, 'unexpected_metric' as reason
    from {{ ref('fct_experiment_results') }}
    where metric_name not in (
        'bank_connection_completion_rate',
        'application_submission_rate',
        'approval_rate',
        'identity_verification_failure_rate',
        'median_time_to_submit',
        'funding_rate'
    )
       or n_assigned_control is null
       or n_assigned_treatment is null
       or n_assigned_control = 0
       or n_assigned_treatment = 0
       or n_control is null
       or n_treatment is null
       or (unit = 'proportion' and (conversions_control is null or conversions_treatment is null))
       or (metric_role = 'primary' and population is distinct from 'applications with bank_connection_started')
       or (
           metric_name in ('application_submission_rate', 'funding_rate')
           and (
               n_control is distinct from n_assigned_control
               or n_treatment is distinct from n_assigned_treatment
           )
       )
),

expected as (
    select metric_name
    from (
        values
            ('bank_connection_completion_rate'),
            ('application_submission_rate'),
            ('approval_rate'),
            ('identity_verification_failure_rate'),
            ('median_time_to_submit'),
            ('funding_rate')
    ) as names (metric_name)
)

select detail, reason from failures

union all

select expected.metric_name, 'missing_metric' as reason
from expected
left join {{ ref('fct_experiment_results') }} as results
    on expected.metric_name = results.metric_name
where results.metric_name is null
