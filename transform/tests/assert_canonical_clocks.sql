-- Application columns and the decision / funding clocks equal the matching events.
select application_id, 'started_at' as reason
from {{ ref('int_application_funnel') }}
where started_at is distinct from event_application_started_at

union all

select application_id, 'submitted_at' as reason
from {{ ref('int_application_funnel') }}
where submitted_at is distinct from event_application_submitted_at

union all

select application_id, 'decision_at' as reason
from {{ ref('int_application_funnel') }}
where decision_at is distinct from coalesce(
    decision_approved_at,
    decision_referred_at,
    decision_declined_at
)
or (
    decision_at is not null
    and (
        (decision_approved_at is not null)::int
        + (decision_referred_at is not null)::int
        + (decision_declined_at is not null)::int
    ) <> 1
)

union all

select application_id, 'contracted_at' as reason
from {{ ref('int_application_funnel') }}
where contracted_at is distinct from event_contract_signed_at

union all

select application_id, 'funded_at' as reason
from {{ ref('int_application_funnel') }}
where funded_at is distinct from event_loan_funded_at
