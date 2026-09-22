"use client";

import { useState } from "react";
import { Kpi, Note, Section } from "@/components/bits";
import { TrendChart } from "@/components/charts";
import { useSlice } from "@/components/shell";
import { formatMinutes, formatPercent } from "@/lib/format";
import {
  FUNDING_PATH,
  approvalFundingReading,
  bankConnectionPairs,
  funnelStep,
  labelSlice,
  labelValue,
  metric,
  pathRows,
  periodSeries,
} from "@/lib/metrics";

export default function OverviewPage() {
  const { slice, value } = useSlice();
  const [grain, setGrain] = useState<"started_month" | "started_week">("started_month");
  const series = periodSeries(grain);
  const reading = approvalFundingReading();
  const pairs = bankConnectionPairs();
  const lowest = pairs[0];
  const paths = pathRows();
  const auto = paths.find((row) => row.value === "auto");
  const manual = paths.find((row) => row.value === "manual");
  const steps = FUNDING_PATH.map((name) => funnelStep(name, slice, value)).filter(
    (step) => step.reached != null,
  );
  const maxReached = Math.max(...steps.map((step) => step.reached ?? 0), 1);
  const activeLabel =
    slice === grain ? series.find((point) => point.value === value)?.label ?? null : null;

  return (
    <article>
      <p className="text-xs uppercase tracking-[0.16em] text-copper">01 — Overview</p>
      <h1 className="mt-2 max-w-3xl font-display text-4xl leading-tight tracking-tight text-ink sm:text-5xl">
        Approval isn&apos;t the finish line. Funding is.
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
        Are we funding the applications we approve? The cards read product_metrics for{" "}
        {slice === "overall" ? "the portfolio" : `${labelSlice(slice).toLowerCase()} · ${labelValue(slice, value)}`}.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Kpi label="Applications started" row={metric("applications_started", slice, value)} />
        <Kpi label="Application completion" row={metric("application_completion_rate", slice, value)} />
        <Kpi label="Approval rate" row={metric("approval_rate", slice, value)} hint="Approved / decided" />
        <Kpi label="Funding rate" row={metric("funding_rate", slice, value)} hint="Funded / started" />
        <Kpi
          label="Approved to funded"
          row={metric("approved_to_funded_rate", slice, value)}
          hint="Funded / approved"
        />
        <Kpi label="Median time to decision" row={metric("median_time_to_decision", slice, value)} />
      </div>

      <Section
        kicker="Portfolio trend"
        title="Approval rate and funding rate"
        lede="started_month and started_week are portfolio cuts. A device, browser, or channel filter changes the cards above. It does not cross with this trend, because the mart has no combined slice."
      >
        <div className="rounded-2xl border border-line bg-card p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-copper">Approval rate</span>
            <span className="text-pine">Funding rate</span>
            <span className="ml-auto flex gap-1">
              {(["started_month", "started_week"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setGrain(item)}
                  className={`rounded-full px-3 py-1 ${
                    grain === item ? "bg-ink text-paper" : "bg-paper text-muted"
                  }`}
                >
                  {item === "started_month" ? "Month" : "Week"}
                </button>
              ))}
            </span>
          </div>
          <TrendChart data={series} activeLabel={activeLabel} />
        </div>
      </Section>

      <Section
        kicker="Funding path"
        title="Reached volume on the selected slice"
        lede="Counts are the step denominator in product_metrics, or the matching count metric when a stage has no next step. Identity verification started sits inside bank connected to identity verified and is on the funnel page."
      >
        <ol className="grid gap-2">
          {steps.map((step) => (
            <li key={step.name} className="grid grid-cols-[minmax(0,11rem)_1fr_auto] items-center gap-3 text-sm">
              <span className="truncate text-muted">{step.label}</span>
              <span className="h-2 rounded-full bg-line">
                <span
                  className="block h-2 rounded-full bg-pine"
                  style={{ width: `${((step.reached ?? 0) / maxReached) * 100}%` }}
                />
              </span>
              <span className="num text-ink">{formatCount(step.reached)}</span>
            </li>
          ))}
        </ol>
      </Section>

      <Section
        kicker="From the export"
        title="Three readings of published slices"
        lede="These sentences quote product_metrics. They are rankings and comparisons of rows already in the export. A formal EDA write-up is a later contract."
      >
        <div className="grid gap-3 lg:grid-cols-3">
          <article className="rounded-2xl border border-line bg-card p-4">
            <h3 className="font-display text-xl text-ink">Approval and funding by month</h3>
            {reading ? (
              <p className="mt-3 text-sm leading-6 text-muted">
                Approval rate peaks in {reading.peak.label} at {formatPercent(reading.peak.approval)}. Funding
                rate that month is {formatPercent(reading.peak.funding)}. Approved to funded is{" "}
                {formatPercent(reading.peak.approvedToFunded)}. In {reading.first.label}, approval rate is{" "}
                {formatPercent(reading.first.approval)}, funding rate is {formatPercent(reading.first.funding)},
                and approved to funded is {formatPercent(reading.first.approvedToFunded)}.
              </p>
            ) : (
              <p className="mt-3 text-sm text-muted">The month slice has no paired rates.</p>
            )}
          </article>
          <article className="rounded-2xl border border-line bg-card p-4">
            <h3 className="font-display text-xl text-ink">Bank connection by device and browser</h3>
            {lowest ? (
              <p className="mt-3 text-sm leading-6 text-muted">
                The lowest bank_connection_completion_rate on the device_browser slice is{" "}
                {formatPercent(lowest.completion)} for {lowest.label}. Denominator {formatCount(lowest.denominator)}{" "}
                applications that start bank connection. Failure incidence on that slice is{" "}
                {formatPercent(lowest.failure)}.
              </p>
            ) : (
              <p className="mt-3 text-sm text-muted">No device_browser rows.</p>
            )}
          </article>
          <article className="rounded-2xl border border-line bg-card p-4">
            <h3 className="font-display text-xl text-ink">Decision time by path</h3>
            {auto && manual ? (
              <p className="mt-3 text-sm leading-6 text-muted">
                median_time_to_decision is {formatMinutes(auto.medianDecision)} on the auto path (
                {formatCount(auto.decided)} decided) and {formatMinutes(manual.medianDecision)} on the manual path
                ({formatCount(manual.decided)} decided). The underwriting_path slice is the portfolio of decided
                applications.
              </p>
            ) : (
              <p className="mt-3 text-sm text-muted">No underwriting_path rows.</p>
            )}
          </article>
        </div>
        <div className="mt-3">
          <Note>
            Decision SLA attainment and funding SLA attainment are unshipped. The limits are unset, so this
            page leaves those percents blank.
          </Note>
        </div>
      </Section>
    </article>
  );
}

function formatCount(value: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}
