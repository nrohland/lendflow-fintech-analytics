select
    application_id,
    case
        when submitted_at is not null
            then date_diff('second', started_at, submitted_at) / 60.0
    end as time_to_submit_minutes,
    case
        when identity_verification_started_at is not null and identity_verified_at is not null
            then date_diff('second', identity_verification_started_at, identity_verified_at) / 60.0
    end as identity_verification_duration_minutes,
    case
        when decision_at is not null and funded_at is not null
            then date_diff('second', decision_at, funded_at) / 3600.0
    end as hours_decision_to_funded
from {{ ref('int_application_funnel') }}
