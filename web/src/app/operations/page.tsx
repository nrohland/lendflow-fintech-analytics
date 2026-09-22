"use client";

import { Kpi, Note, Section } from "@/components/bits";
import { useSlice } from "@/components/shell";
import { formatCount, formatMetric, formatMinutes, formatPercent } from "@/lib/format";
import { labelSlice, labelValue, metric, pathRows, riskRows, snapshot } from "@/lib/metrics";

export default function OperationsPage() {
  const { slice, value } = useSlice();
  const sliceText =
    slice === "overall" ? "the portfolio" : `${labelSlice(slice).toLowerCase()} · ${labelValue(slice, value)}`;
  const paths = pathRows();
  const bands = riskRows();

  return (
    <article>
      <p className="text-xs uppercase tracking-[0.16em] text-copper">03 — Operations</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight text-ink">Where do underwriting and funding wait?</h1>
      <p className="mt-3 max-w-2xl text-base leading-7 text-muted">
        Headline rates follow {sliceText}. Path and risk-band tables are their own slices of decided
        applications. Those attributes are unknown before a decision, so they are not crossed with device,
        browser, channel, or period.
      </p>

      <Section kicker="Underwriting" title="Decision mix and the decision clock">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Auto decision" row={metric("auto_decision_rate", slice, value)} />
          <Kpi label="Manual review" row={metric("manual_review_rate", slice, value)} />
          <Kpi label="Approval rate" row={metric("approval_rate", slice, value)} />
          <Kpi label="Median time to decision" row={metric("median_time_to_decision", slice, value)} />
        </div>
        <div className="mt-3">
          <Note>
            Decision SLA attainment is {snapshot.sla_attainment}. The limit is unset, so this page shows
            median_time_to_decision and leaves attainment blank.
          </Note>
        </div>
      </Section>

      <Section
        kicker="Portfolio cut · underwriting_path"
        title="Auto and manual"
        lede="median_time_to_decision is minutes from submitted_at to the decision, among decided applications on that path."
      >
        <div className="overflow-x-auto rounded-2xl border border-line bg-card">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-3 font-medium">Path</th>
                <th className="px-3 py-3 text-right font-medium">Decided</th>
                <th className="px-3 py-3 text-right font-medium">Approval rate</th>
                <th className="px-3 py-3 text-right font-medium">Median decision</th>
                <th className="px-3 py-3 text-right font-medium">Approved to funded</th>
              </tr>
            </thead>
            <tbody>
              {paths.map((row) => (
                <tr key={row.value} className="border-t border-line">
                  <td className="px-3 py-2">{row.label}</td>
                  <td className="num px-3 py-2 text-right">{formatCount(row.decided)}</td>
                  <td className="num px-3 py-2 text-right">{formatPercent(row.approval)}</td>
                  <td className="num px-3 py-2 text-right">{formatMinutes(row.medianDecision)}</td>
                  <td className="num px-3 py-2 text-right">{formatPercent(row.approvedToFunded)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PathBars rows={paths} />
      </Section>

      <Section kicker="Funding" title="After approval">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Kpi label="Approved to contracted" row={metric("approved_to_contracted_rate", slice, value)} />
          <Kpi label="Approved to funded" row={metric("approved_to_funded_rate", slice, value)} />
          <Kpi label="Contracted to funded" row={metric("contracted_to_funded_rate", slice, value)} />
          <Kpi label="Median time to funding" row={metric("median_time_to_funding", slice, value)} hint="Funded minus decision, hours" />
          <Kpi
            label="Median contract to fund"
            row={metric("median_funding_duration_hours", slice, value)}
            hint="Funded minus contracted, hours"
          />
          <Kpi label="Funding rate" row={metric("funding_rate", slice, value)} hint="Funded / started" />
        </div>
        <div className="mt-3">
          <Note>
            Funding SLA attainment is {snapshot.sla_attainment}. The clock is median_funding_duration_hours.
            The limit is unset, so attainment stays blank.
          </Note>
        </div>
      </Section>

      <Section
        kicker="Portfolio cut · risk_band"
        title="Approval beside post-approval funding"
        lede="risk_band is a synthetic segment on decided applications. approval_rate and approved_to_funded_rate are separate rows."
      >
        <div className="overflow-x-auto rounded-2xl border border-line bg-card">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-3 font-medium">Risk band</th>
                <th className="px-3 py-3 text-right font-medium">Decided</th>
                <th className="px-3 py-3 text-right font-medium">Approval rate</th>
                <th className="px-3 py-3 text-right font-medium">Approved to funded</th>
                <th className="px-3 py-3 text-right font-medium">Median contract to fund</th>
              </tr>
            </thead>
            <tbody>
              {bands.map((row) => (
                <tr key={row.value} className="border-t border-line">
                  <td className="px-3 py-2">{row.label}</td>
                  <td className="num px-3 py-2 text-right">{formatCount(row.decided)}</td>
                  <td className="num px-3 py-2 text-right">{formatPercent(row.approval)}</td>
                  <td className="num px-3 py-2 text-right">{formatPercent(row.approvedToFunded)}</td>
                  <td className="num px-3 py-2 text-right">{formatMetric(row.fundingDuration, "hours")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </article>
  );
}

function PathBars({
  rows,
}: {
  rows: { label: string; medianDecision: number | null }[];
}) {
  const max = Math.max(...rows.map((row) => row.medianDecision ?? 0), 1);
  return (
    <div className="mt-4 rounded-2xl border border-line bg-card p-4">
      <p className="text-sm text-muted">Median decision time, same minute scale</p>
      <ul className="mt-3 grid gap-3">
        {rows.map((row) => (
          <li key={row.label}>
            <div className="mb-1 flex justify-between text-sm">
              <span>{row.label}</span>
              <span className="num">{formatMinutes(row.medianDecision)}</span>
            </div>
            <div className="h-2 rounded-full bg-line">
              <div
                className="h-2 rounded-full bg-copper"
                style={{ width: `${((row.medianDecision ?? 0) / max) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
