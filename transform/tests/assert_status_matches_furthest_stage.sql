with expected as (
    select
        application_id,
        application_status,
        case
            when is_funded then 'funded'
            when is_contracted then 'contracted'
            when reached_vehicle_selected then 'vehicle_selected'
            when is_approved then 'approved'
            when is_referred then 'referred'
            when is_declined then 'declined'
            when is_submitted then 'submitted'
            when reached_identity_verified then 'identity_verified'
            when reached_bank_connected then 'bank_connected'
            when reached_bank_connection_started then 'bank_connection_started'
            when reached_personal_info then 'personal_info_completed'
            else 'started'
        end as expected_status
    from {{ ref('fct_applications') }}
)

select application_id, application_status, expected_status
from expected
where application_status is distinct from expected_status
