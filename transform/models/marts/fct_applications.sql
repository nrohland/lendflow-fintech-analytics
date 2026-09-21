with decisions as (
    select * from {{ ref('stg_underwriting_decisions') }}
),

funding as (
    select * from {{ ref('stg_funding_events') }}
)

select
    funnel.application_id,
    funnel.applicant_id,
    applicants.created_at as applicant_created_at,
    applicants.age_band,
    applicants.income_band,
    applicants.employment_type,
    applicants.state,
    applicants.returning_user,

    funnel.acquisition_channel,
    funnel.device_type,
    funnel.browser,
    funnel.device_type || '|' || funnel.browser as device_browser,
    funnel.application_status,
    assignments.experiment_name,
    assignments.variant as experiment_variant,
    funnel.application_experiment_variant,
    assignments.assigned_at,

    funnel.started_at,
    strftime(date_trunc('week', funnel.started_at at time zone 'UTC'), '%Y-%m-%d') as started_week,
    strftime(date_trunc('month', funnel.started_at at time zone 'UTC'), '%Y-%m-%d') as started_month,
    funnel.personal_info_completed_at,
    funnel.bank_connection_started_at,
    funnel.bank_connected_at,
    funnel.identity_verification_started_at,
    funnel.identity_verified_at,
    funnel.submitted_at,
    funnel.underwriting_started_at,
    funnel.manual_review_started_at,
    funnel.decision_at,
    decisions.decision_timestamp,
    decisions.decision,
    decisions.decision_path as underwriting_path,
    decisions.manual_review_flag,
    decisions.decision_duration_minutes,
    decisions.risk_band,
    funnel.vehicle_selected_at,
    funnel.contract_started_at,
    funnel.contracted_at,
    funnel.funding_started_at,
    funnel.funded_at,
    funding.funding_status,
    funding.funding_timestamp,
    funding.funding_duration_hours,
    funding.stipulation_flag,

    funnel.bank_connection_failure_count,
    funnel.identity_verification_failure_count,
    durations.time_to_submit_minutes,
    durations.identity_verification_duration_minutes,
    durations.hours_decision_to_funded,

    true as reached_application_started,
    funnel.personal_info_completed_at is not null as reached_personal_info,
    funnel.bank_connection_started_at is not null as reached_bank_connection_started,
    funnel.bank_connected_at is not null as reached_bank_connected,
    funnel.identity_verification_started_at is not null as reached_identity_verification_started,
    funnel.identity_verified_at is not null as reached_identity_verified,
    funnel.submitted_at is not null as is_submitted,
    funnel.decision_at is not null as is_decided,
    coalesce(decisions.decision = 'approved', false) as is_approved,
    coalesce(decisions.decision = 'referred', false) as is_referred,
    coalesce(decisions.decision = 'declined', false) as is_declined,
    funnel.vehicle_selected_at is not null as reached_vehicle_selected,
    funnel.contracted_at is not null as is_contracted,
    funnel.funded_at is not null as is_funded
from {{ ref('int_application_funnel') }} as funnel
inner join {{ ref('stg_applicants') }} as applicants
    on funnel.applicant_id = applicants.applicant_id
inner join {{ ref('int_application_durations') }} as durations
    on funnel.application_id = durations.application_id
inner join {{ ref('int_experiment_assignments') }} as assignments
    on funnel.application_id = assignments.application_id
left join decisions
    on funnel.application_id = decisions.application_id
left join funding
    on funnel.application_id = funding.application_id
