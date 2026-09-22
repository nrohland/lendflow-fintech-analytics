export type Unit = "count" | "proportion" | "minutes" | "hours";

export type MetricRow = {
  metric_name: string;
  stage_name: string | null;
  slice_name: string;
  slice_value: string;
  numerator: number | null;
  denominator: number | null;
  metric_value: number | null;
  unit: Unit;
  population: string;
};

export type StageRow = {
  stage_order: number;
  stage_name: string;
  stage_kind: string;
  next_stage_name: string | null;
  failure_event_name: string | null;
};

export type ExperimentRow = {
  experiment_name: string;
  metric_name: string;
  metric_role: "primary" | "secondary" | "guardrail" | "exploratory";
  population: string;
  unit: Unit;
  n_assigned_control: number;
  n_assigned_treatment: number;
  n_control: number;
  n_treatment: number;
  n_assigned_outside_population_control: number;
  n_assigned_outside_population_treatment: number;
  conversions_control: number | null;
  conversions_treatment: number | null;
  control_value: number | null;
  treatment_value: number | null;
  absolute_difference: number | null;
  absolute_difference_pp: number | null;
  relative_uplift: number | null;
  interval_standard_error: number | null;
  ci_low: number | null;
  ci_high: number | null;
  ci_level: number;
  z_statistic: number | null;
  p_value: number | null;
  null_rejected_at_alpha: boolean | null;
  alpha: number;
  test_method: string;
  interval_method: string;
};

export type DashboardSource = {
  generator_version: string | null;
  seed: number | null;
  n_applications: number | null;
  window_start: string | null;
  window_end_exclusive: string | null;
  experiment_name: string | null;
};

export type DashboardSnapshot = {
  export_version: number;
  engine: string;
  primary_metric: string;
  primary_population: string;
  sla_attainment: string;
  product_decision: string | null;
  source: DashboardSource | null;
  row_counts: Record<string, number>;
  stages: StageRow[];
  product_metrics: MetricRow[];
  experiment_results: ExperimentRow[];
  experiment_sql: string;
};

export const FILTER_SLICES = [
  { id: "overall", label: "Portfolio" },
  { id: "device_type", label: "Device" },
  { id: "browser", label: "Browser" },
  { id: "acquisition_channel", label: "Channel" },
  { id: "started_month", label: "Month" },
  { id: "started_week", label: "Week" },
] as const;

export type FilterSlice = (typeof FILTER_SLICES)[number]["id"];
