-- Later stages cannot be reached while an earlier lifecycle timestamp is null,
-- and reached timestamps are ordered. Work events stay inside their stage.
with sequenced as (
    select
        application_id,
        [
            started_at,
            personal_info_completed_at,
            bank_connection_started_at,
            bank_connected_at,
            identity_verified_at,
            submitted_at,
            decision_at,
            vehicle_selected_at,
            contracted_at,
            funded_at
        ] as stage_at
    from {{ ref('fct_applications') }}
),

indexed as (
    select
        application_id,
        i,
        stage_at[i] as ts
    from sequenced,
        range(1, 11) as r(i)
),

ordered as (
    select distinct a.application_id, 'lifecycle_order' as reason
    from indexed as a
    inner join indexed as b
        on a.application_id = b.application_id
        and a.i < b.i
    where b.ts is not null
      and (a.ts is null or a.ts > b.ts)
),

work_events as (
    select application_id, 'identity_start_outside_bank_to_verified' as reason
    from {{ ref('fct_applications') }}
    where identity_verification_started_at is not null
      and (
          bank_connected_at is null
          or identity_verification_started_at < bank_connected_at
          or (
              identity_verified_at is not null
              and identity_verified_at < identity_verification_started_at
          )
      )

    union all

    select application_id, 'identity_verified_without_start' as reason
    from {{ ref('fct_applications') }}
    where identity_verified_at is not null
      and identity_verification_started_at is null

    union all

    select application_id, 'underwriting_outside_submit_to_decision' as reason
    from {{ ref('fct_applications') }}
    where is_decided
      and (
          underwriting_started_at is null
          or submitted_at is null
          or underwriting_started_at < submitted_at
          or decision_at < underwriting_started_at
      )

    union all

    select application_id, 'manual_review_outside_underwriting' as reason
    from {{ ref('fct_applications') }}
    where manual_review_started_at is not null
      and (
          underwriting_started_at is null
          or decision_at is null
          or manual_review_started_at < underwriting_started_at
          or decision_at < manual_review_started_at
      )

    union all

    select application_id, 'contract_started_outside_vehicle_to_contract' as reason
    from {{ ref('fct_applications') }}
    where contract_started_at is not null
      and (
          vehicle_selected_at is null
          or contracted_at is null
          or contract_started_at < vehicle_selected_at
          or contracted_at < contract_started_at
      )

    union all

    select application_id, 'funding_started_outside_contract_to_fund' as reason
    from {{ ref('fct_applications') }}
    where funding_started_at is not null
      and (
          contracted_at is null
          or funding_started_at < contracted_at
          or (funded_at is not null and funded_at < funding_started_at)
      )

    union all

    select application_id, 'funded_without_funding_started' as reason
    from {{ ref('fct_applications') }}
    where is_funded
      and funding_started_at is null
)

select application_id, reason from ordered
union all
select application_id, reason from work_events
