select
    cast(application_id as varchar) as application_id,
    cast(decision_timestamp as timestamptz) as decision_timestamp,
    cast(decision as varchar) as decision,
    cast(decision_path as varchar) as decision_path,
    cast(manual_review_flag as boolean) as manual_review_flag,
    cast(decision_duration_minutes as double) as decision_duration_minutes,
    cast(risk_band as varchar) as risk_band
from {{ source('synthetic', 'underwriting_decisions') }}
