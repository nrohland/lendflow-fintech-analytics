select
    cast(application_id as varchar) as application_id,
    cast(experiment_name as varchar) as experiment_name,
    cast(variant as varchar) as variant,
    cast(assigned_at as timestamptz) as assigned_at
from {{ source('synthetic', 'experiments') }}
