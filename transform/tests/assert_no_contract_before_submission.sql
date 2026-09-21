select application_id, 'contract_before_submission' as reason
from {{ ref('fct_applications') }}
where contracted_at is not null
  and (submitted_at is null or contracted_at < submitted_at)

union all

select application_id, 'contract_without_approval' as reason
from {{ ref('fct_applications') }}
where is_contracted and not is_approved
