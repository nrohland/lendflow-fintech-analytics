select application_id, 'path_null_on_decision' as reason
from {{ ref('fct_applications') }}
where is_decided
  and underwriting_path is null

union all

select application_id, 'path_set_without_decision' as reason
from {{ ref('fct_applications') }}
where not is_decided
  and underwriting_path is not null

union all

select application_id, 'manual_flag_disagrees_with_path' as reason
from {{ ref('fct_applications') }}
where is_decided
  and manual_review_flag is distinct from (underwriting_path = 'manual')

union all

select application_id, 'manual_event_disagrees_with_flag' as reason
from {{ ref('fct_applications') }}
where (manual_review_started_at is not null)
    is distinct from coalesce(manual_review_flag, false)
