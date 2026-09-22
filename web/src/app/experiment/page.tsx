"use client";

import { Note, Section } from "@/components/bits";
import { DifferenceChart, VariantChart } from "@/components/charts";
import {
  formatCount,
  formatDifference,
  formatInterval,
  formatP,
  formatPercent,
  formatSignedPercent,
} from "@/lib/format";
import { experimentRows, labelMetric, primaryExperiment, snapshot } from "@/lib/metrics";
import type { ExperimentRow } from "@/lib/types";

export default function ExperimentPage() {
  const primary = primaryExperiment();
  const rows = experimentRows();
  const guardrails = rows.filter((row) => row.metric_role === "guardrail");
  const proportions = rows.filter(
    (row) => row.unit === "proportion" && row.absolute_difference_pp != null && row.ci_low != null && row.ci_high != null,
  );
  const selected = snapshot.product_decision;
  const primaryAboveZero = primary.ci_low != null && primary.ci_low > 0 && (primary.absolute_difference ?? 0) > 0;
  const primaryCoversZero =
    primary.ci_low != null && primary.ci_high != null && primary.ci_low <= 0 && primary.ci_high >= 0;
  const rejectedGuardrails = guardrails.filter((row) => row.null_rejected_at_alpha === true);

  const variants = [
    { label: "Control", rate: primary.control_value ?? 0 },
    { label: "Treatment", rate: primary.treatment_value ?? 0 },
  ];
  const intervals = proportions.map((row) => ({
    label: labelMetric(row.metric_name),
    diff: row.absolute_difference_pp ?? 0,
    error: [
      (row.absolute_difference_pp ?? 0) - (row.ci_low ?? 0) * 100,
      (row.ci_high ?? 0) * 100 - (row.absolute_difference_pp ?? 0),
    ] as [number, number],
  }));

  return (
    <article>
      <p className="text-xs uppercase tracking-[0.16em] text-copper">04 — Experiment</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight text-ink">
        Did bank-connection clarity change completion?
      </h1>
      <p className="mt-3 max-w-2xl text-base leading-7 text-muted">
        {snapshot.source?.experiment_name ?? "bank_connection_clarity"} compares treatment with control.
        The primary metric is {snapshot.primary_metric}. The population is {snapshot.primary_population}.
      </p>

      <Section kicker="Hypothesis" title="Shorter explanation at bank connection">
        <p className="max-w-3xl text-sm leading-6 text-muted">
          Treatment uses shorter copy that explains why bank connection is required and that income
          verification is meant to be fast. Control keeps the current bank-connection experience. Every
          application is assigned at application start. The estimand is the completion rate among
          applications that start bank connection, treatment minus control. Applications that never start
          are outside this metric.
        </p>
      </Section>

      <Section kicker="Primary" title={labelMetric(primary.metric_name)}>
        <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-line bg-card p-4">
            <VariantChart data={variants} />
          </div>
          <dl className="grid content-start gap-3 sm:grid-cols-2">
            <Stat label="Control" value={formatPercent(primary.control_value)} />
            <Stat label="Treatment" value={formatPercent(primary.treatment_value)} />
            <Stat label="Absolute difference" value={formatDifference(primary)} />
            <Stat label="Relative uplift" value={formatSignedPercent(primary.relative_uplift)} />
            <Stat label="95% interval" value={formatInterval(primary)} />
            <Stat label="p-value" value={formatP(primary.p_value)} />
            <Stat
              label="Null rejected at 0.05"
              value={primary.null_rejected_at_alpha == null ? "—" : primary.null_rejected_at_alpha ? "Yes" : "No"}
            />
            <Stat label="Test" value={primary.test_method.replaceAll("_", " ")} />
          </dl>
        </div>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Assigned control" value={formatCount(primary.n_assigned_control)} />
          <Stat label="Assigned treatment" value={formatCount(primary.n_assigned_treatment)} />
          <Stat label="Started, control" value={formatCount(primary.n_control)} />
          <Stat label="Started, treatment" value={formatCount(primary.n_treatment)} />
          <Stat label="Completed, control" value={formatCount(primary.conversions_control)} />
          <Stat label="Completed, treatment" value={formatCount(primary.conversions_treatment)} />
          <Stat label="Never started, control" value={formatCount(primary.n_assigned_outside_population_control)} />
          <Stat label="Never started, treatment" value={formatCount(primary.n_assigned_outside_population_treatment)} />
        </dl>
        <p className="mt-3 text-xs text-muted">
          Population: {primary.population}. Interval method: {primary.interval_method}. Alpha {primary.alpha}.
        </p>
      </Section>

      <Section
        kicker="All experiment metrics"
        title="Difference and 95% interval"
        lede="Proportion metrics are in percentage points, treatment minus control. The whisker is the Wald interval from fct_experiment_results. The median guardrail uses minutes and sits in the table."
      >
        <div className="rounded-2xl border border-line bg-card p-4">
          <DifferenceChart data={intervals} />
        </div>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-card">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-3 font-medium">Metric</th>
                <th className="px-3 py-3 font-medium">Role</th>
                <th className="px-3 py-3 text-right font-medium">Control</th>
                <th className="px-3 py-3 text-right font-medium">Treatment</th>
                <th className="px-3 py-3 text-right font-medium">Difference</th>
                <th className="px-3 py-3 text-right font-medium">95% interval</th>
                <th className="px-3 py-3 text-right font-medium">p-value</th>
                <th className="px-3 py-3 text-right font-medium">Null rejected</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.metric_name} className="border-t border-line">
                  <td className="px-3 py-2">
                    <div>{labelMetric(row.metric_name)}</div>
                    <div className="text-xs text-muted">{row.population}</div>
                  </td>
                  <td className="px-3 py-2 capitalize text-muted">{row.metric_role}</td>
                  <td className="num px-3 py-2 text-right">{formatMetricValue(row, row.control_value)}</td>
                  <td className="num px-3 py-2 text-right">{formatMetricValue(row, row.treatment_value)}</td>
                  <td className="num px-3 py-2 text-right">{formatDifference(row)}</td>
                  <td className="num px-3 py-2 text-right">{formatInterval(row)}</td>
                  <td className="num px-3 py-2 text-right">{formatP(row.p_value)}</td>
                  <td className="px-3 py-2 text-right">
                    {row.null_rejected_at_alpha == null ? "—" : row.null_rejected_at_alpha ? "Yes" : "No"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        kicker="Guardrails"
        title="Movement, with the margin unset"
        lede="Guardrail rows use the same estimate and interval style as the primary metric. A pass or fail flag is absent. Approximately unchanged has no numeric band in this export."
      >
        <ul className="grid gap-2">
          {guardrails.map((row) => (
            <li key={row.metric_name} className="rounded-xl border border-line bg-card px-3 py-2 text-sm">
              <span className="font-medium">{labelMetric(row.metric_name)}</span>
              <span className="text-muted">
                {" "}
                · {formatDifference(row)} · {formatInterval(row)} · null rejected at 0.05:{" "}
                {row.null_rejected_at_alpha ? "yes" : "no"}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        kicker="Decision frames"
        title="Ship, iterate, or do not ship"
        lede="The mart publishes product_decision as null. These frames are the vocabulary for a later recommendation. This page leaves every frame unselected while that field is null."
      >
        <div className="grid gap-3 lg:grid-cols-3">
          <Frame
            title="Ship"
            selected={selected === "ship"}
            body={
              primaryAboveZero
                ? `The primary interval sits above zero (${formatInterval(primary)}). Ship also asks for guardrails inside a numeric margin. That margin is unset.`
                : `The primary interval does not sit above zero (${formatInterval(primary)}). The guardrail margin is unset.`
            }
          />
          <Frame
            title="Iterate"
            selected={selected === "iterate"}
            body={
              rejectedGuardrails.length
                ? `${rejectedGuardrails.map((row) => labelMetric(row.metric_name)).join(", ")} ${
                    rejectedGuardrails.length === 1 ? "has" : "have"
                  } null_rejected_at_alpha true. Iterate would weigh that movement once a margin exists. The margin is unset.`
                : "No guardrail has null_rejected_at_alpha true. The margin is unset."
            }
          />
          <Frame
            title="Do not ship"
            selected={selected === "do_not_ship"}
            body={
              primaryCoversZero
                ? `The primary interval includes zero (${formatInterval(primary)}).`
                : `The primary interval excludes zero and the absolute difference is ${formatDifference(primary)}.`
            }
          />
        </div>
        <div className="mt-3">
          <Note>
            product_decision is {selected ?? "null"}. null_rejected_at_alpha is the alpha {primary.alpha}{" "}
            comparison. It is a statistical result. The export does not store a ship label.
          </Note>
        </div>
      </Section>

      <Section kicker="Definition" title="Compiled SQL for fct_experiment_results">
        <details className="rounded-2xl border border-line bg-card p-4">
          <summary className="cursor-pointer text-sm text-ink">Read-only SQL from the dbt compile</summary>
          <pre className="mt-3 overflow-x-auto text-xs leading-5 text-muted">{snapshot.experiment_sql}</pre>
        </details>
      </Section>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card px-3 py-3">
      <dt className="text-[11px] uppercase tracking-wide text-muted">{label}</dt>
      <dd className="num mt-1 text-lg text-ink">{value}</dd>
    </div>
  );
}

function Frame({ title, body, selected }: { title: string; body: string; selected: boolean }) {
  return (
    <article className={`rounded-2xl border p-4 ${selected ? "border-pine bg-pine-soft" : "border-line bg-card"}`}>
      <p className="text-xs uppercase tracking-wide text-muted">{selected ? "Selected in the export" : "Unselected"}</p>
      <h3 className="mt-1 font-display text-2xl text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
    </article>
  );
}

function formatMetricValue(row: ExperimentRow, value: number | null): string {
  if (value == null) return "—";
  if (row.unit === "proportion") return formatPercent(value);
  if (row.unit === "minutes") return `${value.toFixed(1)} min`;
  return value.toFixed(2);
}
