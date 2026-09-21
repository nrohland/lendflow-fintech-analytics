select 'fct_application_funnel' as model_name, application_id || '|' || stage_name as key
from {{ ref('fct_application_funnel') }}
group by application_id, stage_name
having count(*) > 1

union all

select
    'product_metrics' as model_name,
    metric_name || '|' || coalesce(stage_name, '') || '|' || slice_name || '|' || slice_value as key
from {{ ref('product_metrics') }}
group by metric_name, stage_name, slice_name, slice_value
having count(*) > 1

union all

select 'stg_experiments' as model_name, application_id || '|' || experiment_name as key
from {{ ref('stg_experiments') }}
group by application_id, experiment_name
having count(*) > 1

union all

select 'fct_experiment_results' as model_name, metric_name as key
from {{ ref('fct_experiment_results') }}
group by metric_name
having count(*) > 1
