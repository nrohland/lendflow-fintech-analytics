"use client";

import { Kpi, Note, Section } from "@/components/bits";
import { DurationChart, RateComparisonChart } from "@/components/charts";
import { useSlice } from "@/components/shell";
import { formatCount, formatMetric, formatMinutes, formatPercent } from "@/lib/format";
import { labelSlice, labelValue, metric, pathRows, riskRows } from "@/lib/metrics";

export default function OperationsPage() {
  const { slice, value } = useSlice();
  const scope = slice === "overall" ? "the portfolio" : `${labelSlice(slice).toLowerCase()}: ${labelValue(slice, value)}`;
  const paths = pathRows();
  const bands = riskRows();
  return <article className="page-content">
    <p className="eyebrow">Operations</p>
    <h1 className="mt-2 font-display text-4xl">The wait between decisions.</h1>
    <p className="mt-3 text-muted">Decision and funding metrics for {scope}. Compare automated and manual review, then follow the clock after approval.</p>

    <Section kicker="Selected view" title="Underwriting at a glance">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Automated decisions" row={metric("auto_decision_rate", slice, value)} hint="Share of decided applications" />
        <Kpi label="Manual review" row={metric("manual_review_rate", slice, value)} hint="Share of decided applications" />
        <Kpi label="Approved / decided" row={metric("approval_rate", slice, value)} />
        <Kpi label="Median decision time" row={metric("median_time_to_decision", slice, value)} hint="Submission to decision" />
      </div>
    </Section>

    <Section kicker="Portfolio comparison" title="Automated versus manual review" lede="Median submission-to-decision time, on a common hour scale. Each path includes only decided applications. Page filters do not apply.">
      <div className="data-panel p-4 sm:p-6"><DurationChart data={paths} /></div>
      <details className="mt-4 data-panel p-4">
        <summary className="text-sm font-semibold">Decision paths: population and conversion</summary>
        <div className="table-scroll mt-3"><table className="data-table w-full text-left text-sm">
          <thead><tr><th className="p-3">Path</th><th className="p-3 text-right">Decided</th><th className="p-3 text-right">Approval / decided</th><th className="p-3 text-right">Median decision</th><th className="p-3 text-right">Funded / approved</th></tr></thead>
          <tbody>{paths.map((row) => <tr key={row.value}><td className="p-3">{row.label}</td><td className="num p-3 text-right">{formatCount(row.decided)}</td><td className="num p-3 text-right">{formatPercent(row.approval)}</td><td className="num p-3 text-right">{formatMinutes(row.medianDecision)}</td><td className="num p-3 text-right">{formatPercent(row.approvedToFunded)}</td></tr>)}</tbody>
        </table></div>
      </details>
    </Section>

    <Section kicker="Selected view" title="From approval to funding">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Kpi label="Contracted / approved" row={metric("approved_to_contracted_rate", slice, value)} />
        <Kpi label="Funded / approved" row={metric("approved_to_funded_rate", slice, value)} />
        <Kpi label="Funded / contracted" row={metric("contracted_to_funded_rate", slice, value)} />
        <Kpi label="Median approval to funding" row={metric("median_time_to_funding", slice, value)} hint="Decision to funding, among funded applications" />
        <Kpi label="Median contract to funding" row={metric("median_funding_duration_hours", slice, value)} hint="Contract signature to funding, among funded applications" />
        <Kpi label="Funded / started" row={metric("funding_rate", slice, value)} />
      </div>
      <div className="mt-4"><Note>Decision and funding service targets have not been set. Latency is reported; SLA attainment is unavailable.</Note></div>
    </Section>

    <Section kicker="Portfolio comparison" title="Approval and funding by risk group" lede="Two different denominators: approval among decided applications, funding among approved applications. Synthetic risk groups; page filters do not apply.">
      <div className="data-panel p-4 sm:p-6"><RateComparisonChart data={bands.map((row) => ({ label: row.label, first: row.approval, second: row.approvedToFunded }))} firstLabel="Approved / decided" secondLabel="Funded / approved" /></div>
      <details className="mt-4 data-panel p-4">
        <summary className="text-sm font-semibold">Risk groups: population and funding time</summary>
        <div className="table-scroll mt-3"><table className="data-table w-full text-left text-sm">
          <thead><tr><th className="p-3">Risk group</th><th className="p-3 text-right">Decided</th><th className="p-3 text-right">Approval / decided</th><th className="p-3 text-right">Funded / approved</th><th className="p-3 text-right">Median contract to funding</th></tr></thead>
          <tbody>{bands.map((row) => <tr key={row.value}><td className="p-3">{row.label}</td><td className="num p-3 text-right">{formatCount(row.decided)}</td><td className="num p-3 text-right">{formatPercent(row.approval)}</td><td className="num p-3 text-right">{formatPercent(row.approvedToFunded)}</td><td className="num p-3 text-right">{formatMetric(row.fundingDuration, "hours")}</td></tr>)}</tbody>
        </table></div>
      </details>
    </Section>
  </article>;
}
