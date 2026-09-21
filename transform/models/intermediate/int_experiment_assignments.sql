select
    experiments.application_id,
    experiments.experiment_name,
    experiments.variant,
    experiments.assigned_at,
    funnel.bank_connection_started_at is not null as in_bank_connection_started,
    funnel.bank_connected_at is not null as in_bank_connected,
    funnel.bank_connection_started_at is not null
        and funnel.bank_connected_at is not null as in_primary_numerator
from {{ ref('stg_experiments') }} as experiments
inner join {{ ref('int_application_funnel') }} as funnel
    on experiments.application_id = funnel.application_id
where experiments.experiment_name = '{{ var("experiment_name") }}'
