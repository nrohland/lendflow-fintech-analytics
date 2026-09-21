with apps as (
    select * from {{ ref('fct_applications') }}
),

assigned as (
    select
        count(*) filter (where experiment_variant = 'control') as n_assigned_control,
        count(*) filter (where experiment_variant = 'treatment') as n_assigned_treatment
    from apps
),

metric_long as (
    select
        'bank_connection_completion_rate' as metric_name,
        'primary' as metric_role,
        'applications with bank_connection_started' as population,
        'proportion' as unit,
        'two_proportion_z' as test_method,
        'wald_95' as interval_method,
        experiment_variant as variant,
        count(*) filter (where reached_bank_connection_started) as n_population,
        count(*) filter (
            where reached_bank_connection_started and reached_bank_connected
        ) as conversions,
        cast(count(*) filter (
            where reached_bank_connection_started and reached_bank_connected
        ) as double)
            / nullif(count(*) filter (where reached_bank_connection_started), 0) as metric_value,
        cast(null as double) as value_stddev
    from apps
    group by experiment_variant

    union all

    select
        'application_submission_rate',
        'secondary',
        'applications assigned at application_started',
        'proportion',
        'two_proportion_z',
        'wald_95',
        experiment_variant,
        count(*),
        count(*) filter (where is_submitted),
        cast(count(*) filter (where is_submitted) as double) / nullif(count(*), 0),
        cast(null as double)
    from apps
    group by experiment_variant

    union all

    select
        'approval_rate',
        'guardrail',
        'applications with a terminal decision',
        'proportion',
        'two_proportion_z',
        'wald_95',
        experiment_variant,
        count(*) filter (where is_decided),
        count(*) filter (where is_approved),
        cast(count(*) filter (where is_approved) as double)
            / nullif(count(*) filter (where is_decided), 0),
        cast(null as double)
    from apps
    group by experiment_variant

    union all

    select
        'identity_verification_failure_rate',
        'guardrail',
        'applications with identity_verification_started',
        'proportion',
        'two_proportion_z',
        'wald_95',
        experiment_variant,
        count(*) filter (where reached_identity_verification_started),
        count(*) filter (
            where reached_identity_verification_started
              and identity_verification_failure_count > 0
              and not reached_identity_verified
        ),
        cast(count(*) filter (
            where reached_identity_verification_started
              and identity_verification_failure_count > 0
              and not reached_identity_verified
        ) as double)
            / nullif(count(*) filter (where reached_identity_verification_started), 0),
        cast(null as double)
    from apps
    group by experiment_variant

    union all

    select
        'median_time_to_submit',
        'guardrail',
        'submitted applications',
        'minutes',
        'median_difference_normal_approx',
        'normal_approx_median_se_95',
        experiment_variant,
        count(*) filter (where is_submitted),
        cast(null as bigint),
        median(time_to_submit_minutes) filter (where is_submitted),
        stddev_samp(time_to_submit_minutes) filter (where is_submitted)
    from apps
    group by experiment_variant

    union all

    select
        'funding_rate',
        'exploratory',
        'applications with application_started',
        'proportion',
        'two_proportion_z',
        'wald_95',
        experiment_variant,
        count(*),
        count(*) filter (where is_funded),
        cast(count(*) filter (where is_funded) as double) / nullif(count(*), 0),
        cast(null as double)
    from apps
    group by experiment_variant
),

sided as (
    select
        metric_name,
        any_value(metric_role) as metric_role,
        any_value(population) as population,
        any_value(unit) as unit,
        any_value(test_method) as test_method,
        any_value(interval_method) as interval_method,
        max(case when variant = 'control' then n_population end) as n_control,
        max(case when variant = 'treatment' then n_population end) as n_treatment,
        max(case when variant = 'control' then conversions end) as conversions_control,
        max(case when variant = 'treatment' then conversions end) as conversions_treatment,
        max(case when variant = 'control' then metric_value end) as control_value,
        max(case when variant = 'treatment' then metric_value end) as treatment_value,
        max(case when variant = 'control' then value_stddev end) as stddev_control,
        max(case when variant = 'treatment' then value_stddev end) as stddev_treatment
    from metric_long
    group by metric_name
),

compared as (
    select
        sided.*,
        assigned.n_assigned_control,
        assigned.n_assigned_treatment,
        treatment_value - control_value as absolute_difference,
        case
            when unit = 'proportion' then (treatment_value - control_value) * 100.0
        end as absolute_difference_pp,
        case
            when control_value is null or control_value = 0 then null
            else (treatment_value - control_value) / control_value
        end as relative_uplift,
        case
            when n_control is null or n_treatment is null or n_control = 0 or n_treatment = 0 then null
            when test_method = 'two_proportion_z' then sqrt(greatest(
                control_value * (1.0 - control_value) / n_control
                    + treatment_value * (1.0 - treatment_value) / n_treatment,
                0.0
            ))
            when test_method = 'median_difference_normal_approx'
                and stddev_control is not null
                and stddev_treatment is not null
                then sqrt(
                    power({{ var('median_se_factor') }} * stddev_control / sqrt(n_control), 2)
                    + power({{ var('median_se_factor') }} * stddev_treatment / sqrt(n_treatment), 2)
                )
        end as interval_standard_error,
        case
            when n_control is null or n_treatment is null or n_control = 0 or n_treatment = 0 then null
            when test_method <> 'two_proportion_z' then null
            else sqrt(greatest(
                (
                    cast(conversions_control + conversions_treatment as double)
                    / (n_control + n_treatment)
                )
                * (
                    1.0 - cast(conversions_control + conversions_treatment as double)
                    / (n_control + n_treatment)
                )
                * (1.0 / n_control + 1.0 / n_treatment),
                0.0
            ))
        end as z_standard_error
    from sided
    cross join assigned
),

scored as (
    select
        *,
        case
            when test_method = 'two_proportion_z' and z_standard_error = 0 and absolute_difference = 0 then 0.0
            when test_method = 'two_proportion_z' and (z_standard_error is null or z_standard_error = 0) then null
            when test_method = 'two_proportion_z' then absolute_difference / z_standard_error
            when interval_standard_error is null or interval_standard_error = 0 then null
            else absolute_difference / interval_standard_error
        end as z_statistic
    from compared
)

select
    '{{ var("experiment_name") }}' as experiment_name,
    metric_name,
    metric_role,
    population,
    unit,
    n_assigned_control,
    n_assigned_treatment,
    n_control,
    n_treatment,
    n_assigned_control - n_control as n_assigned_outside_population_control,
    n_assigned_treatment - n_treatment as n_assigned_outside_population_treatment,
    conversions_control,
    conversions_treatment,
    control_value,
    treatment_value,
    absolute_difference,
    absolute_difference_pp,
    relative_uplift,
    interval_standard_error,
    case
        when interval_standard_error is null then null
        else absolute_difference - {{ var('z_critical_95') }} * interval_standard_error
    end as ci_low,
    case
        when interval_standard_error is null then null
        else absolute_difference + {{ var('z_critical_95') }} * interval_standard_error
    end as ci_high,
    0.95 as ci_level,
    z_statistic,
    {{ normal_two_sided_p_value('z_statistic') }} as p_value,
    case
        when z_statistic is null then null
        else {{ normal_two_sided_p_value('z_statistic') }} < 0.05
    end as null_rejected_at_alpha,
    0.05 as alpha,
    test_method,
    interval_method
from scored
