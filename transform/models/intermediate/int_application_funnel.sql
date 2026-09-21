with events as (
    select * from {{ ref('stg_events') }}
),

pivoted as (
    select
        application_id,
        min(event_timestamp) filter (where event_name = 'application_started') as event_application_started_at,
        min(event_timestamp) filter (where event_name = 'personal_info_completed') as personal_info_completed_at,
        min(event_timestamp) filter (where event_name = 'bank_connection_started') as bank_connection_started_at,
        min(event_timestamp) filter (where event_name = 'bank_connected') as bank_connected_at,
        min(event_timestamp) filter (where event_name = 'identity_verification_started') as identity_verification_started_at,
        min(event_timestamp) filter (where event_name = 'identity_verified') as identity_verified_at,
        min(event_timestamp) filter (where event_name = 'application_submitted') as event_application_submitted_at,
        min(event_timestamp) filter (where event_name = 'underwriting_started') as underwriting_started_at,
        min(event_timestamp) filter (where event_name = 'manual_review_started') as manual_review_started_at,
        min(event_timestamp) filter (where event_name = 'decision_approved') as decision_approved_at,
        min(event_timestamp) filter (where event_name = 'decision_referred') as decision_referred_at,
        min(event_timestamp) filter (where event_name = 'decision_declined') as decision_declined_at,
        min(event_timestamp) filter (where event_name = 'vehicle_selected') as vehicle_selected_at,
        min(event_timestamp) filter (where event_name = 'contract_started') as contract_started_at,
        min(event_timestamp) filter (where event_name = 'contract_signed') as event_contract_signed_at,
        min(event_timestamp) filter (where event_name = 'funding_started') as funding_started_at,
        min(event_timestamp) filter (where event_name = 'loan_funded') as event_loan_funded_at,
        count(*) filter (where event_name = 'bank_connection_failed') as bank_connection_failure_count,
        count(*) filter (where event_name = 'identity_verification_failed') as identity_verification_failure_count
    from events
    group by application_id
)

select
    applications.application_id,
    applications.applicant_id,
    applications.started_at,
    pivoted.event_application_started_at,
    pivoted.personal_info_completed_at,
    pivoted.bank_connection_started_at,
    pivoted.bank_connected_at,
    pivoted.identity_verification_started_at,
    pivoted.identity_verified_at,
    applications.submitted_at,
    pivoted.event_application_submitted_at,
    pivoted.underwriting_started_at,
    pivoted.manual_review_started_at,
    applications.decision_at,
    pivoted.decision_approved_at,
    pivoted.decision_referred_at,
    pivoted.decision_declined_at,
    pivoted.vehicle_selected_at,
    pivoted.contract_started_at,
    applications.contracted_at,
    pivoted.event_contract_signed_at,
    pivoted.funding_started_at,
    applications.funded_at,
    pivoted.event_loan_funded_at,
    applications.application_status,
    applications.underwriting_path,
    applications.experiment_variant as application_experiment_variant,
    applications.acquisition_channel,
    applications.device_type,
    applications.browser,
    coalesce(pivoted.bank_connection_failure_count, 0) as bank_connection_failure_count,
    coalesce(pivoted.identity_verification_failure_count, 0) as identity_verification_failure_count
from {{ ref('stg_applications') }} as applications
left join pivoted
    on applications.application_id = pivoted.application_id
