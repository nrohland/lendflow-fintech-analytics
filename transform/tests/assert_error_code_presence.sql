select event_id, 'failure_event_missing_error_code' as reason
from {{ ref('stg_events') }}
where event_name in ('bank_connection_failed', 'identity_verification_failed')
  and error_code is null

union all

select event_id, 'non_failure_event_has_error_code' as reason
from {{ ref('stg_events') }}
where event_name not in ('bank_connection_failed', 'identity_verification_failed')
  and error_code is not null
