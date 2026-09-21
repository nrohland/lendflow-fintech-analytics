select
    cast(applicant_id as varchar) as applicant_id,
    cast(created_at as timestamptz) as created_at,
    cast(age_band as varchar) as age_band,
    cast(income_band as varchar) as income_band,
    cast(employment_type as varchar) as employment_type,
    cast(state as varchar) as state,
    cast(returning_user as boolean) as returning_user
from {{ source('synthetic', 'applicants') }}
