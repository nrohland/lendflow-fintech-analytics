select
    cast(event_id as varchar) as event_id,
    cast(applicant_id as varchar) as applicant_id,
    cast(application_id as varchar) as application_id,
    cast(session_id as varchar) as session_id,
    cast(event_timestamp as timestamptz) as event_timestamp,
    cast(event_name as varchar) as event_name,
    cast(device_type as varchar) as device_type,
    cast(browser as varchar) as browser,
    cast(acquisition_channel as varchar) as acquisition_channel,
    cast(experiment_variant as varchar) as experiment_variant,
    cast(error_code as varchar) as error_code
from {{ source('synthetic', 'events') }}
