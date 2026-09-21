-- C without S is empty. Those rows are in neither the numerator nor the denominator.
select application_id
from {{ ref('fct_applications') }}
where reached_bank_connected
  and not reached_bank_connection_started
