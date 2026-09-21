select
    cast(application_id as varchar) as application_id,
    cast(applicant_id as varchar) as applicant_id,
    cast(started_at as timestamptz) as started_at,
    cast(submitted_at as timestamptz) as submitted_at,
    cast(decision_at as timestamptz) as decision_at,
    cast(contracted_at as timestamptz) as contracted_at,
    cast(funded_at as timestamptz) as funded_at,
    cast(acquisition_channel as varchar) as acquisition_channel,
    cast(device_type as varchar) as device_type,
    cast(browser as varchar) as browser,
    cast(application_status as varchar) as application_status,
    cast(underwriting_path as varchar) as underwriting_path,
    cast(experiment_variant as varchar) as experiment_variant
from {{ source('synthetic', 'applications') }}
