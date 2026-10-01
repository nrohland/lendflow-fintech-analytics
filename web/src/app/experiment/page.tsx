"use client";

import { Section } from "@/components/bits";
import { DifferenceChart, VariantChart } from "@/components/charts";
import { formatCount, formatDifference, formatInterval, formatP, formatPercent, formatSignedPercent } from "@/lib/format";
import { displayText, experimentRows, labelMetric, primaryExperiment, snapshot } from "@/lib/metrics";
import type { ExperimentRow } from "@/lib/types";

export default function ExperimentPage() {
  const primary = primaryExperiment();
  const rows = experimentRows();
  const guardrails = rows.filter((row) => row.metric_role === "guardrail");
  const intervals = rows.filter((row) => row.unit === "proportion" && row.absolute_difference_pp != null && row.ci_low != null && row.ci_high != null).map((row) => ({
    label: labelMetric(row.metric_name), diff: row.absolute_difference_pp!,
    error: [row.absolute_difference_pp! - row.ci_low! * 100, row.ci_high! * 100 - row.absolute_difference_pp!] as [number, number],
  }));
  const variants = [{ label: "Control", rate: primary.control_value }, { label: "Treatment", rate: primary.treatment_value }];
  return <article className="page-content">
    <p className="eyebrow">Experiment</p>
    <h1 className="mt-2 font-display text-4xl">A clearer bank connection step.</h1>
    <p className="mt-3 text-muted">A shorter explanation of why bank connection is needed, tested against the current experience. The outcome is completion among applications that start bank connection.</p>

    <Section kicker="Primary result" title="Bank connection completion" lede="The treatment-control difference is measured in percentage points. Both completion rates use bank connection starters.">
      <div className="data-panel p-4 sm:p-6">
        <div className="experiment-result">
          <VariantChart data={variants} />
          <div>
            <p className="text-sm text-muted">Treatment minus control</p>
            <p className="num mt-2 text-5xl font-semibold tracking-tight text-pine">{formatDifference(primary)}</p>
            <p className="mt-3 text-sm leading-6 text-muted">95% confidence interval: {formatInterval(primary)}.</p>
            <dl className="result-stats mt-6">
              <Stat label="Relative uplift" value={formatSignedPercent(primary.relative_uplift)} />
              <Stat label="p-value" value={formatP(primary.p_value)} />
              <Stat label="Control starters" value={formatCount(primary.n_control)} />
              <Stat label="Treatment starters" value={formatCount(primary.n_treatment)} />
            </dl>
          </div>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted">{primary.ci_low != null && primary.ci_low > 0 ? "The primary interval is above zero." : "Review the interval against zero."} A launch decision still needs guardrail tolerances.</p>
    </Section>

    <Section kicker="Effect estimates" title="How the other measures move" lede="Points are treatment-control differences; whiskers are 95% confidence intervals. Zero means no difference. Percentage measures are shown here; time is reported in the table.">
      <div className="data-panel p-4 sm:p-6"><DifferenceChart data={intervals} /></div>
      <details className="mt-4 data-panel p-4">
        <summary className="text-sm font-semibold">All estimates, intervals, and tests</summary>
        <div className="table-scroll mt-3"><table className="data-table w-full text-left text-sm">
          <thead><tr>{["Metric", "Role", "Control", "Treatment", "Difference", "95% interval", "p-value"].map((heading, i) => <th key={heading} className={`p-3 ${i >= 2 ? "text-right" : ""}`}>{heading}</th>)}</tr></thead>
          <tbody>{rows.map((row) => <tr key={row.metric_name}>
            <td className="p-3"><div>{labelMetric(row.metric_name)}</div><p className="mt-1 text-xs text-muted">{displayText(row.population)}</p></td>
            <td className="p-3 capitalize text-muted">{row.metric_role}</td>
            <td className="num p-3 text-right">{formatMetricValue(row, row.control_value)}</td><td className="num p-3 text-right">{formatMetricValue(row, row.treatment_value)}</td>
            <td className="num p-3 text-right">{formatDifference(row)}</td><td className="num p-3 text-right">{formatInterval(row)}</td><td className="num p-3 text-right">{formatP(row.p_value)}</td>
          </tr>)}</tbody>
        </table></div>
      </details>
    </Section>

    <Section kicker="Decision status" title={snapshot.product_decision ? `Recorded decision: ${displayText(snapshot.product_decision)}` : "Launch criteria are still open"} lede="Statistical significance does not establish an acceptable business trade-off. No numeric tolerance has been defined for the guardrails.">
      <div className="data-panel p-4 sm:p-6">
        <ul className="divide-y divide-line">{guardrails.map((row) => <li key={row.metric_name} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span className="font-medium">{labelMetric(row.metric_name)}</span><span className="num text-muted">{formatDifference(row)} · 95% CI {formatInterval(row)}</span></li>)}</ul>
        <p className="mt-4 border-t border-line pt-4 text-sm leading-6 text-muted">Define acceptable movement in these measures, then record a ship, iterate, or do-not-ship decision. {snapshot.product_decision ? "The export contains a product decision." : "The export currently contains no product decision."}</p>
      </div>
    </Section>

    <Section kicker="Study detail" title="Assignment and measurement">
      <p className="max-w-3xl text-sm leading-6 text-muted">Applications are assigned at application start. Treatment explains why bank connection is required using shorter copy. This result includes only applicants who subsequently start bank connection; applicants who never start are outside the primary metric.</p>
      <details className="mt-4 data-panel p-4">
        <summary className="text-sm font-semibold">Group sizes and statistical method</summary>
        <div className="table-scroll mt-3"><table className="data-table w-full text-left text-sm">
          <thead><tr><th className="p-3">Population</th><th className="p-3 text-right">Control</th><th className="p-3 text-right">Treatment</th></tr></thead>
          <tbody>
            <Sample label="Assigned at application start" control={primary.n_assigned_control} treatment={primary.n_assigned_treatment} />
            <Sample label="Started bank connection" control={primary.n_control} treatment={primary.n_treatment} />
            <Sample label="Completed bank connection" control={primary.conversions_control} treatment={primary.conversions_treatment} />
            <Sample label="Never started bank connection" control={primary.n_assigned_outside_population_control} treatment={primary.n_assigned_outside_population_treatment} />
          </tbody>
        </table></div>
        <p className="mt-4 text-xs leading-6 text-muted">Test: {displayText(primary.test_method)}. Interval: {displayText(primary.interval_method)}. Significance level: {primary.alpha}. Null rejected: {primary.null_rejected_at_alpha == null ? "Not available" : primary.null_rejected_at_alpha ? "Yes" : "No"}.</p>
      </details>
      <details className="mt-3 data-panel p-4"><summary className="text-sm font-semibold">Read-only SQL behind the experiment</summary><pre className="mt-4 overflow-x-auto text-xs leading-5 text-muted">{snapshot.experiment_sql}</pre></details>
    </Section>
  </article>;
}

function Stat({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
function Sample({ label, control, treatment }: { label: string; control: number | null; treatment: number | null }) { return <tr><td className="p-3">{label}</td><td className="num p-3 text-right">{formatCount(control)}</td><td className="num p-3 text-right">{formatCount(treatment)}</td></tr>; }
function formatMetricValue(row: ExperimentRow, value: number | null) {
  if (value == null) return "Not available";
  return row.unit === "proportion" ? formatPercent(value) : row.unit === "minutes" ? `${value.toFixed(1)} min` : value.toFixed(3);
}
