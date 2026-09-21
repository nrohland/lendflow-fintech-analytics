-- Recorded durations match the timestamp clocks. Tolerance is 1e-6 of the unit.
select application_id, 'decision_duration_minutes' as reason
from {{ ref('fct_underwriting') }}
where abs(
        decision_duration_minutes
        - date_diff('second', submitted_at, decision_timestamp) / 60.0
    ) > 1e-6
    or decision_timestamp is distinct from decision_at

union all

select application_id, 'funding_duration_hours' as reason
from {{ ref('fct_funding') }}
where is_funded
  and (
      funding_duration_hours is null
      or contracted_at is null
      or abs(
          funding_duration_hours
          - date_diff('second', contracted_at, funded_at) / 3600.0
      ) > 1e-6
  )
