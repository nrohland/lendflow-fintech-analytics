-- Failure events may repeat. Every other event name occurs at most once per application.
select application_id, event_name
from {{ ref('stg_events') }}
where event_name not in ('bank_connection_failed', 'identity_verification_failed')
group by application_id, event_name
having count(*) > 1
