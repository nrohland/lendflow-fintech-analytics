with stages as (
    select *
    from (
        values
            (10, 'application_started', 'lifecycle', 'personal_info_completed', cast(null as varchar)),
            (20, 'personal_info_completed', 'lifecycle', 'bank_connection_started', null),
            (30, 'bank_connection_started', 'lifecycle', 'bank_connected', 'bank_connection_failed'),
            (40, 'bank_connected', 'lifecycle', 'identity_verified', null),
            (45, 'identity_verification_started', 'work', 'identity_verified', 'identity_verification_failed'),
            (50, 'identity_verified', 'lifecycle', 'application_submitted', null),
            (60, 'application_submitted', 'lifecycle', 'decided', null),
            (70, 'decided', 'lifecycle', cast(null as varchar), null),
            (80, 'approved', 'outcome', 'vehicle_selected', null),
            (81, 'referred', 'outcome', null, null),
            (82, 'declined', 'outcome', null, null),
            (90, 'vehicle_selected', 'lifecycle', 'contract_signed', null),
            (100, 'contract_signed', 'lifecycle', 'loan_funded', null),
            (110, 'loan_funded', 'lifecycle', null, null)
    ) as stage_dim (
        stage_order,
        stage_name,
        stage_kind,
        next_stage_name,
        failure_event_name
    )
),

apps as (
    select * from {{ ref('fct_applications') }}
),

expanded as (
    select
        apps.application_id,
        stages.stage_order,
        stages.stage_name,
        stages.stage_kind,
        stages.next_stage_name,
        stages.failure_event_name,
        case stages.stage_name
            when 'application_started' then apps.reached_application_started
            when 'personal_info_completed' then apps.reached_personal_info
            when 'bank_connection_started' then apps.reached_bank_connection_started
            when 'bank_connected' then apps.reached_bank_connected
            when 'identity_verification_started' then apps.reached_identity_verification_started
            when 'identity_verified' then apps.reached_identity_verified
            when 'application_submitted' then apps.is_submitted
            when 'decided' then apps.is_decided
            when 'approved' then apps.is_approved
            when 'referred' then apps.is_referred
            when 'declined' then apps.is_declined
            when 'vehicle_selected' then apps.reached_vehicle_selected
            when 'contract_signed' then apps.is_contracted
            when 'loan_funded' then apps.is_funded
        end as reached,
        case stages.stage_name
            when 'application_started' then apps.started_at
            when 'personal_info_completed' then apps.personal_info_completed_at
            when 'bank_connection_started' then apps.bank_connection_started_at
            when 'bank_connected' then apps.bank_connected_at
            when 'identity_verification_started' then apps.identity_verification_started_at
            when 'identity_verified' then apps.identity_verified_at
            when 'application_submitted' then apps.submitted_at
            when 'decided' then apps.decision_at
            when 'approved' then apps.decision_at
            when 'referred' then apps.decision_at
            when 'declined' then apps.decision_at
            when 'vehicle_selected' then apps.vehicle_selected_at
            when 'contract_signed' then apps.contracted_at
            when 'loan_funded' then apps.funded_at
        end as reached_at,
        case stages.next_stage_name
            when 'personal_info_completed' then apps.reached_personal_info
            when 'bank_connection_started' then apps.reached_bank_connection_started
            when 'bank_connected' then apps.reached_bank_connected
            when 'identity_verified' then apps.reached_identity_verified
            when 'application_submitted' then apps.is_submitted
            when 'decided' then apps.is_decided
            when 'vehicle_selected' then apps.reached_vehicle_selected
            when 'contract_signed' then apps.is_contracted
            when 'loan_funded' then apps.is_funded
        end as next_reached,
        case stages.next_stage_name
            when 'personal_info_completed' then apps.personal_info_completed_at
            when 'bank_connection_started' then apps.bank_connection_started_at
            when 'bank_connected' then apps.bank_connected_at
            when 'identity_verified' then apps.identity_verified_at
            when 'application_submitted' then apps.submitted_at
            when 'decided' then apps.decision_at
            when 'vehicle_selected' then apps.vehicle_selected_at
            when 'contract_signed' then apps.contracted_at
            when 'loan_funded' then apps.funded_at
        end as next_reached_at,
        case
            when stages.failure_event_name is null then null
            when stages.failure_event_name = 'bank_connection_failed' then apps.bank_connection_failure_count > 0
            when stages.failure_event_name = 'identity_verification_failed' then apps.identity_verification_failure_count > 0
        end as failure_occurred,
        apps.device_type,
        apps.browser,
        apps.device_browser,
        apps.acquisition_channel,
        apps.returning_user,
        apps.started_at,
        apps.started_week,
        apps.started_month,
        apps.age_band,
        apps.income_band,
        apps.employment_type,
        apps.state,
        apps.experiment_variant,
        apps.risk_band,
        apps.underwriting_path
    from apps
    cross join stages
)

select
    application_id,
    stage_order,
    stage_name,
    stage_kind,
    next_stage_name,
    failure_event_name,
    reached,
    case when reached then reached_at end as reached_at,
    case
        when not reached then null
        when next_stage_name is null then null
        else coalesce(next_reached, false)
    end as reached_next,
    case
        when reached and next_stage_name is not null and coalesce(next_reached, false)
            then date_diff('second', reached_at, next_reached_at) / 60.0
    end as step_duration_minutes,
    case
        when failure_event_name is null then null
        when not reached then null
        else failure_occurred
    end as had_failure,
    device_type,
    browser,
    device_browser,
    acquisition_channel,
    returning_user,
    started_at,
    started_week,
    started_month,
    age_band,
    income_band,
    employment_type,
    state,
    experiment_variant,
    risk_band,
    underwriting_path
from expanded
