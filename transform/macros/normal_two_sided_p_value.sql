{% macro normal_two_sided_p_value(z_expr) -%}
{#-
  Two-sided tail probability from the standard normal.
  Abramowitz and Stegun 26.2.17. Absolute error is about 1e-7,
  which is enough for a p-value at alpha 0.05.
-#}
case
  when {{ z_expr }} is null then null
  else least(
    1.0,
    greatest(
      0.0,
      2.0 * (
        0.3989422804014327
        * exp(-0.5 * abs({{ z_expr }}) * abs({{ z_expr }}))
        * (
          (1.0 / (1.0 + 0.2316419 * abs({{ z_expr }})))
          * (
            0.319381530
            + (1.0 / (1.0 + 0.2316419 * abs({{ z_expr }}))) * (
              -0.356563782
              + (1.0 / (1.0 + 0.2316419 * abs({{ z_expr }}))) * (
                1.781477937
                + (1.0 / (1.0 + 0.2316419 * abs({{ z_expr }}))) * (
                  -1.821255978
                  + (1.0 / (1.0 + 0.2316419 * abs({{ z_expr }}))) * 1.330274429
                )
              )
            )
          )
        )
      )
    )
  )
end
{%- endmacro %}
