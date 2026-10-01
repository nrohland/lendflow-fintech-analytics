"use client";

import Link from "next/link";
import { useState } from "react";
import { Section } from "@/components/bits";
import { ConversionFunnel, TrendChart } from "@/components/charts";
import { useSlice } from "@/components/shell";
import { formatCount, formatInterval, formatMinutes, formatPercent, formatSignedPp } from "@/lib/format";
import { labelSlice, labelValue, metric, periodSeries, primaryExperiment } from "@/lib/metrics";

export default function OverviewPage() {
  const { slice, value } = useSlice();
  const [grain, setGrain] = useState<"started_month" | "started_week">("started_month");
  const series = periodSeries(grain);
  const bankDrop = metric("step_drop_off_rate", "overall", "all", "bank_connection_started");
  const fundedAfterApproval = metric("approved_to_funded_rate", "overall", "all");
  const experiment = primaryExperiment();
  const selectedFunding = metric("funding_rate", slice, value);
  const funnel = [
    { name: "Started", value: metric("applications_started", slice, value)?.metric_value ?? null },
    { name: "Submitted", value: metric("submitted_applications", slice, value)?.metric_value ?? null },
    { name: "Approved", value: metric("approved_applications", slice, value)?.metric_value ?? null },
    { name: "Funded", value: metric("funded_applications", slice, value)?.metric_value ?? null },
  ];
  const chartRows = funnel.filter((row): row is typeof row & { value: number } => row.value != null);
  const activeLabel = slice === grain ? series.find((point) => point.value === value)?.label ?? null : null;
  const scope = slice === "overall" ? "Portfolio" : `${labelSlice(slice)}: ${labelValue(slice, value)}`;

  return (
    <article className="page-content home-page">
      <div className="overview-hero">
        <div>
          <p className="eyebrow text-[#c3d7cd]">Portfolio overview</p>
          <h1 className="mt-4 font-display text-5xl leading-[1.06] tracking-tight text-white sm:text-6xl">From approval<br />to a funded loan.</h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-[#d7e4dd]">Approval isn&apos;t the finish line. Follow the application journey, find the handoffs that lose applicants, and review the bank connection test.</p>
        </div>
        <div className="hero-stat">
          <p className="text-sm text-[#d7e4dd]">End-to-end funding rate</p>
          <p className="num mt-2 text-6xl font-semibold tracking-tight text-[#a6e986]">{formatPercent(selectedFunding?.metric_value)}</p>
          <p className="num mt-3 text-sm text-white">{formatCount(selectedFunding?.numerator)} funded / {formatCount(selectedFunding?.denominator)} started</p>
          <p className="mt-2 text-xs text-[#c3d7cd]">{scope}</p>
        </div>
      </div>

      <section className="readout" aria-labelledby="key-findings">
        <div className="readout-heading">
          <p className="eyebrow">The analysis</p>
          <h2 id="key-findings" className="mt-2 font-display text-3xl">Where to focus</h2>
          <p className="mt-3 text-sm leading-6 text-muted">Portfolio findings.<br />These stay fixed across filters.</p>
        </div>
        <div>
          <Finding href="/funnel" title="Bank connection loses one in five starters" value={formatPercent(bankDrop?.metric_value)}
            body={`${formatCount(bankDrop?.numerator)} of ${formatCount(bankDrop?.denominator)} bank connection starters do not complete it. Review the device and browser breakdown before assigning a cause.`} action="Locate the drop-off" />
          <Finding href="/operations" title="Approval leaves a second conversion gap" value={formatPercent(fundedAfterApproval?.metric_value)}
            body={`${formatCount(fundedAfterApproval?.numerator)} of ${formatCount(fundedAfterApproval?.denominator)} approved applications reach funding. Compare the decision paths and the steps after approval.`} action="Review the funding handoff" />
          <div className="experiment-readout">
            <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-base font-semibold">The bank connection test</h3><strong className="num text-xl text-pine">{formatSignedPp(experiment.absolute_difference_pp)}</strong></div>
            <p className="mt-2 text-sm leading-6 text-muted">Completion rises from {formatPercent(experiment.control_value)} to {formatPercent(experiment.treatment_value)}. The 95% interval is {formatInterval(experiment)}. Guardrail tolerances are still needed for a launch decision.</p>
            <Link href="/experiment" className="text-link mt-3 inline-block">Read the experiment result</Link>
          </div>
        </div>
      </section>

      <Section kicker={scope} title="The application journey" lede="Counts and share of applications started. Every stage follows the selected view.">
        <div className="data-panel p-4 sm:p-6">
          <ConversionFunnel data={chartRows} />
          <dl className="metric-strip mt-5">
            <div><dt>Submitted / started</dt><dd>{formatPercent(metric("application_completion_rate", slice, value)?.metric_value)}</dd></div>
            <div><dt>Approved / decided</dt><dd>{formatPercent(metric("approval_rate", slice, value)?.metric_value)}</dd></div>
            <div><dt>Funded / approved</dt><dd>{formatPercent(metric("approved_to_funded_rate", slice, value)?.metric_value)}</dd></div>
            <div><dt>Median decision time</dt><dd>{formatMinutes(metric("median_time_to_decision", slice, value)?.metric_value)}</dd></div>
          </dl>
        </div>
        <Link href="/funnel" className="text-link mt-3 inline-block">See all application stages</Link>
      </Section>

      <Section kicker="Portfolio history" title="Approval and funding over time" lede="Approval uses decided applications; funding uses all starts. Both series are grouped by application start date.">
        <div className="data-panel p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">Whole portfolio · page filters do not apply</p>
            <div className="segmented" aria-label="Trend granularity">
              {(["started_month", "started_week"] as const).map((item) => <button key={item} type="button" onClick={() => setGrain(item)} aria-pressed={grain === item}>{item === "started_month" ? "Monthly" : "Weekly"}</button>)}
            </div>
          </div>
          <TrendChart data={series} activeLabel={activeLabel} />
        </div>
      </Section>

      <nav className="analysis-guide" aria-label="Continue the analysis">
        <p className="eyebrow">Continue the analysis</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Guide href="/funnel" title="Application funnel" description="Find the stage and the segment behind each loss." />
          <Guide href="/operations" title="Operations" description="Compare decision paths and the funding clock." />
          <Guide href="/experiment" title="Experiment" description="Assess the effect, uncertainty, and guardrails." />
          <Guide href="/ask" title="Ask LendFlow" description="Look up an answer and inspect the supporting query." />
        </div>
      </nav>
    </article>
  );
}

function Finding({ href, title, value, body, action }: { href: string; title: string; value: string; body: string; action: string }) {
  return <article className="finding">
    <div className="flex flex-wrap items-baseline justify-between gap-3"><h3 className="text-base font-semibold">{title}</h3><strong className="num text-2xl font-semibold">{value}</strong></div>
    <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
    <Link href={href} className="text-link mt-3 inline-block">{action}</Link>
  </article>;
}

function Guide({ href, title, description }: { href: string; title: string; description: string }) {
  return <Link href={href} className="guide-link"><span className="block text-sm font-semibold">{title}</span><span className="mt-2 block text-sm leading-6 text-muted">{description}</span></Link>;
}
