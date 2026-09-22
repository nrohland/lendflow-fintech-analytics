import snapshotJson from "@/data/dashboard.json";
import { formatPeriod, titleCase } from "./format";
import type { DashboardSnapshot, ExperimentRow, FilterSlice, MetricRow, StageRow } from "./types";

export const snapshot = snapshotJson as DashboardSnapshot;

const STAGE_COUNT: Record<string, string> = {
  application_started: "applications_started",
  application_submitted: "submitted_applications",
  decided: "decided_applications",
  approved: "approved_applications",
  referred: "referred_applications",
  declined: "declined_applications",
  contract_signed: "contracted_applications",
  loan_funded: "funded_applications",
};

export const STAGE_LABELS: Record<string, string> = {
  application_started: "Application started",
  personal_info_completed: "Personal info completed",
  bank_connection_started: "Bank connection started",
  bank_connected: "Bank connected",
  identity_verification_started: "Identity verification started",
  identity_verified: "Identity verified",
  application_submitted: "Application submitted",
  decided: "Decided",
  approved: "Approved",
  referred: "Referred",
  declined: "Declined",
  vehicle_selected: "Vehicle selected",
  contract_signed: "Contract signed",
  loan_funded: "Loan funded",
};

export const METRIC_LABELS: Record<string, string> = {
  applications_started: "Applications started",
  application_completion_rate: "Application completion",
  submitted_applications: "Submitted",
  decided_applications: "Decided",
  approved_applications: "Approved",
  referred_applications: "Referred",
  declined_applications: "Declined",
  contracted_applications: "Contracted",
  funded_applications: "Funded",
  approval_rate: "Approval rate",
  decline_rate: "Decline rate",
  referral_rate: "Referral rate",
  funding_rate: "Funding rate",
  approved_to_funded_rate: "Approved to funded",
  approved_to_contracted_rate: "Approved to contracted",
  contracted_to_funded_rate: "Contracted to funded",
  median_time_to_decision: "Median time to decision",
  median_time_to_funding: "Median time to funding",
  median_funding_duration_hours: "Median contract to fund",
  median_time_to_submit: "Median time to submit",
  auto_decision_rate: "Auto decision",
  manual_review_rate: "Manual review",
  bank_connection_completion_rate: "Bank connection completion",
  bank_connection_start_rate: "Bank connection start",
  bank_connection_failure_incidence: "Bank connection failure incidence",
  application_submission_rate: "Application submission",
  identity_verification_failure_rate: "Identity verification failure",
  step_conversion_rate: "Step conversion",
  step_drop_off_rate: "Step drop-off",
  median_step_duration: "Median completer time",
  error_rate: "Error rate",
};

export const FUNDING_PATH = [
  "application_started",
  "personal_info_completed",
  "bank_connection_started",
  "bank_connected",
  "identity_verified",
  "application_submitted",
  "approved",
  "vehicle_selected",
  "contract_signed",
  "loan_funded",
] as const;

const index = new Map<string, MetricRow>();
for (const row of snapshot.product_metrics) {
  index.set(metricKey(row.metric_name, row.slice_name, row.slice_value, row.stage_name), row);
}

function metricKey(name: string, slice: string, value: string, stage: string | null): string {
  return `${name}\u0000${slice}\u0000${value}\u0000${stage ?? ""}`;
}

export function metric(
  name: string,
  slice: string,
  value: string,
  stage: string | null = null,
): MetricRow | null {
  return index.get(metricKey(name, slice, value, stage)) ?? null;
}

export function stageByName(name: string): StageRow | null {
  return snapshot.stages.find((stage) => stage.stage_name === name) ?? null;
}

export function labelStage(name: string): string {
  return STAGE_LABELS[name] ?? titleCase(name);
}

export function labelMetric(name: string): string {
  return METRIC_LABELS[name] ?? titleCase(name);
}

export function labelSlice(slice: string): string {
  if (slice === "overall") return "Portfolio";
  if (slice === "device_type") return "Device";
  if (slice === "browser") return "Browser";
  if (slice === "acquisition_channel") return "Channel";
  if (slice === "started_month") return "Month";
  if (slice === "started_week") return "Week";
  if (slice === "device_browser") return "Device and browser";
  if (slice === "underwriting_path") return "Underwriting path";
  if (slice === "risk_band") return "Risk band";
  return titleCase(slice);
}

export function labelValue(slice: string, value: string): string {
  if (slice === "overall" || value === "all") return "Portfolio";
  if (slice === "started_month" || slice === "started_week") return formatPeriod(value, slice);
  if (slice === "device_browser") {
    return value.split("|").map((part) => titleCase(part)).join(" · ");
  }
  return titleCase(value);
}

export function sliceValues(slice: FilterSlice): string[] {
  if (slice === "overall") return ["all"];
  const values = new Set<string>();
  for (const row of snapshot.product_metrics) {
    if (row.slice_name === slice && row.metric_name === "applications_started") {
      values.add(row.slice_value);
    }
  }
  return [...values].sort();
}

export function distinctSliceValues(slice: string, metricName: string): string[] {
  const values = new Set<string>();
  for (const row of snapshot.product_metrics) {
    if (row.slice_name === slice && row.metric_name === metricName && row.stage_name == null) {
      values.add(row.slice_value);
    }
  }
  return [...values].sort();
}

export function reachedCount(stageName: string, slice: string, value: string): number | null {
  const step = metric("step_conversion_rate", slice, value, stageName);
  if (step?.denominator != null) return step.denominator;
  const countName = STAGE_COUNT[stageName];
  if (!countName) return null;
  const row = metric(countName, slice, value);
  return row?.metric_value ?? null;
}

export type FunnelStep = {
  name: string;
  label: string;
  kind: string;
  reached: number | null;
  conversion: number | null;
  dropOff: number | null;
  durationMinutes: number | null;
  errorRate: number | null;
  errorDefined: boolean;
  nextStage: string | null;
};

export function funnelStep(stageName: string, slice: string, value: string): FunnelStep {
  const stage = stageByName(stageName);
  const conversion = metric("step_conversion_rate", slice, value, stageName);
  const drop = metric("step_drop_off_rate", slice, value, stageName);
  const duration = metric("median_step_duration", slice, value, stageName);
  const error = metric("error_rate", slice, value, stageName);
  return {
    name: stageName,
    label: labelStage(stageName),
    kind: stage?.stage_kind ?? "lifecycle",
    reached: reachedCount(stageName, slice, value),
    conversion: conversion?.metric_value ?? null,
    dropOff: drop?.metric_value ?? null,
    durationMinutes: duration?.metric_value ?? null,
    errorRate: error?.metric_value ?? null,
    errorDefined: error?.denominator != null,
    nextStage: stage?.next_stage_name ?? null,
  };
}

export function periodSeries(slice: "started_month" | "started_week") {
  return sliceValues(slice).map((value) => ({
    value,
    label: labelValue(slice, value),
    approval: metric("approval_rate", slice, value)?.metric_value ?? null,
    funding: metric("funding_rate", slice, value)?.metric_value ?? null,
    approvedToFunded: metric("approved_to_funded_rate", slice, value)?.metric_value ?? null,
    started: metric("applications_started", slice, value)?.metric_value ?? null,
  }));
}

export function approvalFundingReading() {
  const series = periodSeries("started_month").filter(
    (point) => point.approval != null && point.funding != null && point.approvedToFunded != null,
  );
  if (series.length < 2) return null;
  const first = series[0];
  const peak = series.reduce((best, point) =>
    (point.approval ?? 0) > (best.approval ?? 0) ? point : best,
  );
  return { first, peak };
}

export function bankConnectionPairs() {
  return distinctSliceValues("device_browser", "bank_connection_completion_rate")
    .map((value) => {
      const completion = metric("bank_connection_completion_rate", "device_browser", value);
      const failure = metric("bank_connection_failure_incidence", "device_browser", value);
      return {
        value,
        label: labelValue("device_browser", value),
        completion: completion?.metric_value ?? null,
        failure: failure?.metric_value ?? null,
        denominator: completion?.denominator ?? null,
      };
    })
    .sort((left, right) => (left.completion ?? 0) - (right.completion ?? 0));
}

export function channelRows() {
  return distinctSliceValues("acquisition_channel", "applications_started")
    .map((value) => ({
      value,
      label: labelValue("acquisition_channel", value),
      started: metric("applications_started", "acquisition_channel", value)?.metric_value ?? null,
      completion: metric("application_completion_rate", "acquisition_channel", value)?.metric_value ?? null,
      funding: metric("funding_rate", "acquisition_channel", value)?.metric_value ?? null,
      approvedToFunded: metric("approved_to_funded_rate", "acquisition_channel", value)?.metric_value ?? null,
    }))
    .sort((left, right) => (right.started ?? 0) - (left.started ?? 0));
}

export function pathRows() {
  return distinctSliceValues("underwriting_path", "decided_applications").map((value) => ({
    value,
    label: labelValue("underwriting_path", value),
    decided: metric("decided_applications", "underwriting_path", value)?.metric_value ?? null,
    approval: metric("approval_rate", "underwriting_path", value)?.metric_value ?? null,
    medianDecision: metric("median_time_to_decision", "underwriting_path", value)?.metric_value ?? null,
    approvedToFunded: metric("approved_to_funded_rate", "underwriting_path", value)?.metric_value ?? null,
  }));
}

export function riskRows() {
  return distinctSliceValues("risk_band", "approval_rate").map((value) => ({
    value,
    label: labelValue("risk_band", value),
    decided: metric("decided_applications", "risk_band", value)?.metric_value ?? null,
    approval: metric("approval_rate", "risk_band", value)?.metric_value ?? null,
    approvedToFunded: metric("approved_to_funded_rate", "risk_band", value)?.metric_value ?? null,
    fundingDuration: metric("median_funding_duration_hours", "risk_band", value)?.metric_value ?? null,
  }));
}

export function experimentRows(): ExperimentRow[] {
  const order = { primary: 0, secondary: 1, guardrail: 2, exploratory: 3 };
  return [...snapshot.experiment_results].sort(
    (left, right) => order[left.metric_role] - order[right.metric_role] || left.metric_name.localeCompare(right.metric_name),
  );
}

export function primaryExperiment(): ExperimentRow {
  const row = snapshot.experiment_results.find((item) => item.metric_name === snapshot.primary_metric);
  if (!row) {
    throw new Error(`Snapshot is missing ${snapshot.primary_metric}`);
  }
  return row;
}

export function sourceLine(): string {
  const source = snapshot.source;
  if (!source?.n_applications || !source.window_start || !source.window_end_exclusive) {
    return "Synthetic export";
  }
  const count = new Intl.NumberFormat("en-US").format(source.n_applications);
  return `Synthetic · seed ${source.seed} · ${count} applications · ${source.window_start.slice(0, 10)} to ${source.window_end_exclusive.slice(0, 10)} (end exclusive)`;
}
