with application_slices as (
    {{ portfolio_application_agg('overall', "'all'") }}
    union all
    {{ portfolio_application_agg('device_type', 'device_type') }}
    union all
    {{ portfolio_application_agg('browser', 'browser') }}
    union all
    {{ portfolio_application_agg('device_browser', "device_type || '|' || browser") }}
    union all
    {{ portfolio_application_agg('acquisition_channel', 'acquisition_channel') }}
    union all
    {{ portfolio_application_agg('returning_user', "case when returning_user then 'true' else 'false' end") }}
    union all
    {{ portfolio_application_agg('started_week', 'started_week') }}
    union all
    {{ portfolio_application_agg('started_month', 'started_month') }}
    union all
    {{ portfolio_application_agg('age_band', 'age_band') }}
    union all
    {{ portfolio_application_agg('income_band', 'income_band') }}
    union all
    {{ portfolio_application_agg('employment_type', 'employment_type') }}
    union all
    {{ portfolio_application_agg('state', 'state') }}
    union all
    {{ portfolio_application_agg('experiment_variant', 'experiment_variant') }}
),

decided_slices as (
    {{ portfolio_decided_agg('risk_band', 'risk_band') }}
    union all
    {{ portfolio_decided_agg('underwriting_path', 'underwriting_path') }}
),

funnel_slices as (
    {{ funnel_stage_agg('overall', "'all'") }}
    union all
    {{ funnel_stage_agg('device_type', 'device_type') }}
    union all
    {{ funnel_stage_agg('browser', 'browser') }}
    union all
    {{ funnel_stage_agg('device_browser', "device_type || '|' || browser") }}
    union all
    {{ funnel_stage_agg('acquisition_channel', 'acquisition_channel') }}
    union all
    {{ funnel_stage_agg('returning_user', "case when returning_user then 'true' else 'false' end") }}
    union all
    {{ funnel_stage_agg('started_week', 'started_week') }}
    union all
    {{ funnel_stage_agg('started_month', 'started_month') }}
    union all
    {{ funnel_stage_agg('age_band', 'age_band') }}
    union all
    {{ funnel_stage_agg('income_band', 'income_band') }}
    union all
    {{ funnel_stage_agg('employment_type', 'employment_type') }}
    union all
    {{ funnel_stage_agg('state', 'state') }}
    union all
    {{ funnel_stage_agg('experiment_variant', 'experiment_variant') }}
),

application_metrics as (
    select
        'applications_started' as metric_name,
        cast(null as varchar) as stage_name,
        slice_name,
        slice_value,
        applications_started as numerator,
        cast(null as bigint) as denominator,
        cast(applications_started as double) as metric_value,
        'count' as unit,
        'applications with application_started' as population
    from application_slices
    union all
    select 'submitted_applications', null, slice_name, slice_value,
        submitted_applications, null, cast(submitted_applications as double),
        'count', 'applications with application_submitted'
    from application_slices
    union all
    select 'decided_applications', null, slice_name, slice_value,
        decided_applications, null, cast(decided_applications as double),
        'count', 'applications with a terminal decision'
    from application_slices
    union all
    select 'approved_applications', null, slice_name, slice_value,
        approved_applications, null, cast(approved_applications as double),
        'count', 'applications approved'
    from application_slices
    union all
    select 'referred_applications', null, slice_name, slice_value,
        referred_applications, null, cast(referred_applications as double),
        'count', 'applications referred'
    from application_slices
    union all
    select 'declined_applications', null, slice_name, slice_value,
        declined_applications, null, cast(declined_applications as double),
        'count', 'applications declined'
    from application_slices
    union all
    select 'contracted_applications', null, slice_name, slice_value,
        contracted_applications, null, cast(contracted_applications as double),
        'count', 'applications with contract_signed'
    from application_slices
    union all
    select 'funded_applications', null, slice_name, slice_value,
        funded_applications, null, cast(funded_applications as double),
        'count', 'applications with loan_funded'
    from application_slices
    union all
    select 'application_completion_rate', null, slice_name, slice_value,
        submitted_applications, applications_started,
        cast(submitted_applications as double) / nullif(applications_started, 0),
        'proportion', 'applications with application_started'
    from application_slices
    union all
    select 'bank_connection_start_rate', null, slice_name, slice_value,
        bank_connection_started, personal_info_completed,
        cast(bank_connection_started as double) / nullif(personal_info_completed, 0),
        'proportion', 'applications with personal_info_completed'
    from application_slices
    union all
    select 'bank_connection_completion_rate', null, slice_name, slice_value,
        bank_connected_and_started, bank_connection_started,
        cast(bank_connected_and_started as double) / nullif(bank_connection_started, 0),
        'proportion', 'applications with bank_connection_started'
    from application_slices
    union all
    select 'bank_connection_failure_incidence', null, slice_name, slice_value,
        bank_failed_and_started, bank_connection_started,
        cast(bank_failed_and_started as double) / nullif(bank_connection_started, 0),
        'proportion', 'applications with bank_connection_started'
    from application_slices
    union all
    select 'identity_verification_success_rate', null, slice_name, slice_value,
        identity_verified_and_started, identity_started,
        cast(identity_verified_and_started as double) / nullif(identity_started, 0),
        'proportion', 'applications with identity_verification_started'
    from application_slices
    union all
    select 'identity_verification_failure_rate', null, slice_name, slice_value,
        identity_failed_without_verification, identity_started,
        cast(identity_failed_without_verification as double) / nullif(identity_started, 0),
        'proportion', 'applications with identity_verification_started'
    from application_slices
    union all
    select 'approval_rate', null, slice_name, slice_value,
        approved_applications, decided_applications,
        cast(approved_applications as double) / nullif(decided_applications, 0),
        'proportion', 'applications with a terminal decision'
    from application_slices
    union all
    select 'decline_rate', null, slice_name, slice_value,
        declined_applications, decided_applications,
        cast(declined_applications as double) / nullif(decided_applications, 0),
        'proportion', 'applications with a terminal decision'
    from application_slices
    union all
    select 'referral_rate', null, slice_name, slice_value,
        referred_applications, decided_applications,
        cast(referred_applications as double) / nullif(decided_applications, 0),
        'proportion', 'applications with a terminal decision'
    from application_slices
    union all
    select 'auto_decision_rate', null, slice_name, slice_value,
        auto_decisions, decided_applications,
        cast(auto_decisions as double) / nullif(decided_applications, 0),
        'proportion', 'applications with a terminal decision'
    from application_slices
    union all
    select 'manual_review_rate', null, slice_name, slice_value,
        manual_decisions, decided_applications,
        cast(manual_decisions as double) / nullif(decided_applications, 0),
        'proportion', 'applications with a terminal decision'
    from application_slices
    union all
    select 'approved_to_contracted_rate', null, slice_name, slice_value,
        contracted_applications, approved_applications,
        cast(contracted_applications as double) / nullif(approved_applications, 0),
        'proportion', 'approved applications'
    from application_slices
    union all
    select 'approved_to_funded_rate', null, slice_name, slice_value,
        funded_applications, approved_applications,
        cast(funded_applications as double) / nullif(approved_applications, 0),
        'proportion', 'approved applications'
    from application_slices
    union all
    select 'contracted_to_funded_rate', null, slice_name, slice_value,
        funded_applications, contracted_applications,
        cast(funded_applications as double) / nullif(contracted_applications, 0),
        'proportion', 'applications with contract_signed'
    from application_slices
    union all
    select 'funding_rate', null, slice_name, slice_value,
        funded_applications, applications_started,
        cast(funded_applications as double) / nullif(applications_started, 0),
        'proportion', 'applications with application_started'
    from application_slices
    union all
    select 'median_time_to_submit', null, slice_name, slice_value,
        cast(null as bigint), submitted_applications, median_time_to_submit,
        'minutes', 'submitted applications'
    from application_slices
    union all
    select 'median_time_to_decision', null, slice_name, slice_value,
        cast(null as bigint), decided_applications, median_time_to_decision,
        'minutes', 'applications with a terminal decision'
    from application_slices
    union all
    select 'median_time_to_funding', null, slice_name, slice_value,
        cast(null as bigint), funded_applications, median_time_to_funding,
        'hours', 'funded loans'
    from application_slices
    union all
    select 'median_funding_duration_hours', null, slice_name, slice_value,
        cast(null as bigint), funded_applications, median_funding_duration_hours,
        'hours', 'funded loans'
    from application_slices
),

decided_metrics as (
    select
        'decided_applications' as metric_name,
        cast(null as varchar) as stage_name,
        slice_name,
        slice_value,
        decided_applications as numerator,
        cast(null as bigint) as denominator,
        cast(decided_applications as double) as metric_value,
        'count' as unit,
        'applications with a terminal decision' as population
    from decided_slices
    union all
    select 'approved_applications', null, slice_name, slice_value,
        approved_applications, null, cast(approved_applications as double),
        'count', 'applications approved'
    from decided_slices
    union all
    select 'referred_applications', null, slice_name, slice_value,
        referred_applications, null, cast(referred_applications as double),
        'count', 'applications referred'
    from decided_slices
    union all
    select 'declined_applications', null, slice_name, slice_value,
        declined_applications, null, cast(declined_applications as double),
        'count', 'applications declined'
    from decided_slices
    union all
    select 'contracted_applications', null, slice_name, slice_value,
        contracted_applications, null, cast(contracted_applications as double),
        'count', 'applications with contract_signed'
    from decided_slices
    union all
    select 'funded_applications', null, slice_name, slice_value,
        funded_applications, null, cast(funded_applications as double),
        'count', 'applications with loan_funded'
    from decided_slices
    union all
    select 'approval_rate', null, slice_name, slice_value,
        approved_applications, decided_applications,
        cast(approved_applications as double) / nullif(decided_applications, 0),
        'proportion', 'applications with a terminal decision'
    from decided_slices
    union all
    select 'decline_rate', null, slice_name, slice_value,
        declined_applications, decided_applications,
        cast(declined_applications as double) / nullif(decided_applications, 0),
        'proportion', 'applications with a terminal decision'
    from decided_slices
    union all
    select 'referral_rate', null, slice_name, slice_value,
        referred_applications, decided_applications,
        cast(referred_applications as double) / nullif(decided_applications, 0),
        'proportion', 'applications with a terminal decision'
    from decided_slices
    union all
    select 'auto_decision_rate', null, slice_name, slice_value,
        auto_decisions, decided_applications,
        cast(auto_decisions as double) / nullif(decided_applications, 0),
        'proportion', 'applications with a terminal decision'
    from decided_slices
    union all
    select 'manual_review_rate', null, slice_name, slice_value,
        manual_decisions, decided_applications,
        cast(manual_decisions as double) / nullif(decided_applications, 0),
        'proportion', 'applications with a terminal decision'
    from decided_slices
    union all
    select 'approved_to_contracted_rate', null, slice_name, slice_value,
        contracted_applications, approved_applications,
        cast(contracted_applications as double) / nullif(approved_applications, 0),
        'proportion', 'approved applications'
    from decided_slices
    union all
    select 'approved_to_funded_rate', null, slice_name, slice_value,
        funded_applications, approved_applications,
        cast(funded_applications as double) / nullif(approved_applications, 0),
        'proportion', 'approved applications'
    from decided_slices
    union all
    select 'contracted_to_funded_rate', null, slice_name, slice_value,
        funded_applications, contracted_applications,
        cast(funded_applications as double) / nullif(contracted_applications, 0),
        'proportion', 'applications with contract_signed'
    from decided_slices
    union all
    select 'median_time_to_decision', null, slice_name, slice_value,
        cast(null as bigint), decided_applications, median_time_to_decision,
        'minutes', 'applications with a terminal decision'
    from decided_slices
    union all
    select 'median_time_to_funding', null, slice_name, slice_value,
        cast(null as bigint), funded_applications, median_time_to_funding,
        'hours', 'funded loans'
    from decided_slices
    union all
    select 'median_funding_duration_hours', null, slice_name, slice_value,
        cast(null as bigint), funded_applications, median_funding_duration_hours,
        'hours', 'funded loans'
    from decided_slices
),

funnel_metrics as (
    select
        'step_conversion_rate' as metric_name,
        stage_name,
        slice_name,
        slice_value,
        case when next_stage_name is null then null else n_reached_next end as numerator,
        case when next_stage_name is null then null else n_reached end as denominator,
        case
            when next_stage_name is null or n_reached = 0 then null
            else cast(n_reached_next as double) / n_reached
        end as metric_value,
        'proportion' as unit,
        'applications that reached this stage' as population
    from funnel_slices
    union all
    select
        'step_drop_off_rate',
        stage_name,
        slice_name,
        slice_value,
        case when next_stage_name is null then null else n_reached - n_reached_next end,
        case when next_stage_name is null then null else n_reached end,
        case
            when next_stage_name is null or n_reached = 0 then null
            else 1.0 - cast(n_reached_next as double) / n_reached
        end,
        'proportion',
        'applications that reached this stage'
    from funnel_slices
    union all
    select
        'median_step_duration',
        stage_name,
        slice_name,
        slice_value,
        cast(null as bigint),
        case when next_stage_name is null then null else n_reached_next end,
        case when next_stage_name is null then null else median_step_duration_minutes end,
        'minutes',
        'applications that reached the next stage'
    from funnel_slices
    union all
    select
        'error_rate',
        stage_name,
        slice_name,
        slice_value,
        case when failure_event_name is null then null else n_failed end,
        case when failure_event_name is null then null else n_reached end,
        case
            when failure_event_name is null or n_reached = 0 then null
            else cast(n_failed as double) / n_reached
        end,
        'proportion',
        'applications that entered this stage'
    from funnel_slices
)

select * from application_metrics
union all
select * from decided_metrics
union all
select * from funnel_metrics
