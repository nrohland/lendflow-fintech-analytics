select
    cast(application_id as varchar) as application_id,
    cast(funding_status as varchar) as funding_status,
    cast(funding_timestamp as timestamptz) as funding_timestamp,
    cast(funding_duration_hours as double) as funding_duration_hours,
    cast(stipulation_flag as boolean) as stipulation_flag
from {{ source('synthetic', 'funding_events') }}
