-- Funding follows approval. A funding row exists exactly when the decision is approved.
select application_id, 'funded_without_approval' as reason
from {{ ref('fct_applications') }}
where is_funded and not is_approved

union all

select application_id, 'funded_before_decision' as reason
from {{ ref('fct_applications') }}
where funded_at is not null
  and (decision_at is null or funded_at < decision_at)

union all

select application_id, 'vehicle_without_approval' as reason
from {{ ref('fct_applications') }}
where reached_vehicle_selected and not is_approved

union all

select funding.application_id, 'funding_row_without_approval' as reason
from {{ ref('stg_funding_events') }} as funding
left join {{ ref('fct_applications') }} as apps
    on funding.application_id = apps.application_id
where coalesce(apps.is_approved, false) = false

union all

select apps.application_id, 'approved_without_funding_row' as reason
from {{ ref('fct_applications') }} as apps
left join {{ ref('stg_funding_events') }} as funding
    on apps.application_id = funding.application_id
where apps.is_approved
  and funding.application_id is null

union all

select application_id, 'funding_status_disagrees_with_funded_at' as reason
from {{ ref('fct_applications') }}
where is_approved
  and (
      (is_funded and funding_status is distinct from 'funded')
      or (not is_funded and funding_status is distinct from 'not_funded')
      or (is_funded and funding_timestamp is distinct from funded_at)
      or (not is_funded and funding_timestamp is not null)
      or (not is_funded and funding_duration_hours is not null)
  )
