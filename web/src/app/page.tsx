"use client";

import Link from "next/link";
import { useState } from "react";
import { Section } from "@/components/bits";
import { ConversionFunnel, TrendChart } from "@/components/charts";
import { useSlice } from "@/components/shell";
import { formatMinutes, formatPercent, formatSignedPp } from "@/lib/format";
import {
  labelSlice,
  labelValue,
  metric,
  periodSeries,
  primaryExperiment,
} from "@/lib/metrics";

export default function OverviewPage() {
  const { slice, value } = useSlice();
  const [grain, setGrain] = useState<"started_month" | "started_week">("started_month");
  const series = periodSeries(grain);
  const bankDrop = metric("step_drop_off_rate", "overall", "all", "bank_connection_started");
  const fundedAfterApproval = metric("approved_to_funded_rate", "overall", "all");
  const experiment = primaryExperiment();
  const funnel = [
    { name: "Started", value: metric("applications_started", slice, value)?.metric_value ?? null, rate: null, basis: "Starting population" },
    { name: "Submitted", value: metric("submitted_applications", slice, value)?.metric_value ?? null, rate: metric("application_completion_rate", slice, value)?.metric_value ?? null, basis: "of started" },
    { name: "Approved", value: metric("approved_applications", slice, value)?.metric_value ?? null, rate: metric("approval_rate", slice, value)?.metric_value ?? null, basis: "of decided" },
    { name: "Funded", value: metric("funded_applications", slice, value)?.metric_value ?? null, rate: metric("approved_to_funded_rate", slice, value)?.metric_value ?? null, basis: "of approved" },
  ];
  const chartRows = funnel.filter((row): row is typeof row & { value: number } => row.value != null);
  const activeLabel =
    slice === grain ? series.find((point) => point.value === value)?.label ?? null : null;

  return (
    <article className="page-content home-page">
      <div className="overview-hero">
        <div className="relative z-10">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#b0eba1]">01 / Portfolio overview</p>
          <h1 className="mt-5 max-w-3xl font-display text-5xl leading-[1.02] tracking-tight text-white sm:text-6xl">
            Approval isn&apos;t the finish line. <em className="font-normal text-[#a6e986]">Funding is.</em>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#dbe4e4]">
            Are we funding the applications we approve? Explore the governed metrics for{" "}
            {slice === "overall" ? "the portfolio" : `${labelSlice(slice).toLowerCase()} · ${labelValue(slice, value)}`}.
          </p>
        </div>
        <div className="relative z-10 self-end border-l border-white/20 pl-6">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#b7c8ca]">Funded / started</p>
          <p className="num mt-3 text-5xl font-semibold tracking-tight text-white">
            {formatPercent(metric("funding_rate", slice, value)?.metric_value ?? null)}
          </p>
          <p className="mt-2 text-sm text-[#c1d1d1]">End-to-end funding rate</p>
        </div>
      </div>

      <section className="mt-8" aria-labelledby="key-findings">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.13em] text-pine">The readout</p>
            <h2 id="key-findings" className="mt-2 font-display text-3xl text-ink sm:text-4xl">Three findings to take away</h2>
          </div>
          <p className="text-xs text-muted">Portfolio-wide · These findings stay fixed when you change filters</p>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          <Insight
            number="01"
            label="A major handoff"
            value={formatPercent(bankDrop?.metric_value)}
            body={`${formatCount(bankDrop?.numerator ?? null)} of ${formatCount(bankDrop?.denominator ?? null)} applications that start bank connection do not complete it. This is a clear place to investigate friction.`}
            href="/funnel"
            action="Explore the funnel"
          />
          <Insight
            number="02"
            label="Approval to funding"
            value={formatPercent(fundedAfterApproval?.metric_value)}
            body={`${formatCount(fundedAfterApproval?.numerator ?? null)} of ${formatCount(fundedAfterApproval?.denominator ?? null)} approved applications reach funding. Approval alone misses this downstream gap.`}
            href="/operations"
            action="See what happens after approval"
          />
          <Insight
            number="03"
            label="Experiment signal"
            value={formatSignedPp(experiment.absolute_difference_pp)}
            body={`${formatPercent(experiment.control_value)} in control versus ${formatPercent(experiment.treatment_value)} in treatment among bank connection starters. Guardrail limits are still undefined.`}
            href="/experiment"
            action="Review the experiment"
          />
        </div>
        <p className="mt-4 rounded-lg border-l-[3px] border-[#60b975] bg-pine-soft px-4 py-3 text-sm leading-6 text-ink">
          <strong>Where to focus:</strong> investigate the bank connection handoff, then trace losses after approval.
          The test result is promising, but guardrail limits are needed before a launch decision.
        </p>
      </section>

      <Section
        kicker="Conversion funnel"
        title="From application start to funding"
        lede="Each bar shows the share of applications reaching that stage. Counts appear on the bars and follow the selected filter."
      >
        <div className="data-panel p-5 lg:p-7">
          {chartRows.length >= 2 ? <ConversionFunnel data={chartRows} /> : <p className="text-sm text-muted">No funnel data for this filter.</p>}
          <ol className="sr-only" aria-label="Application stage conversion rates">
            {funnel.map((stage) => (
              <li key={stage.name}>{stage.name}: {formatCount(stage.value)} applications. {stage.rate == null ? stage.basis : `${formatPercent(stage.rate)} ${stage.basis}`}.</li>
            ))}
          </ol>
          <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-muted">
            {funnel.slice(1).map((stage) => (
              <span key={stage.name}><strong className="font-semibold text-ink">{stage.name}</strong> {formatPercent(stage.rate)} {stage.basis}</span>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
            <p className="text-sm text-muted">Median time to decision <span className="text-xs">· among decided applications</span></p>
            <strong className="num text-lg font-semibold text-ink">{formatMinutes(metric("median_time_to_decision", slice, value)?.metric_value)}</strong>
          </div>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted">The full stage-by-stage breakdown is on the Funnel page.</p>
      </Section>

      <section className="mt-14" aria-labelledby="explore-title">
        <p className="text-xs font-bold uppercase tracking-[0.13em] text-pine">Explore the story</p>
        <h2 id="explore-title" className="mt-2 font-display text-3xl text-ink sm:text-4xl">Where to go next</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Use the filters above to change the headline metrics. Sections marked “Portfolio” stay fixed so you can compare them with the wider picture.
        </p>
        <nav className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Explore the analysis">
          <GuideLink href="/funnel" number="02" title="Funnel" description="Find where applicants leave." />
          <GuideLink href="/operations" number="03" title="Operations" description="Compare decision and funding times." />
          <GuideLink href="/experiment" number="04" title="Experiment" description="Read the test result and guardrails." />
          <GuideLink href="/ask" number="05" title="Ask" description="Try a guided question about the data." />
        </nav>
      </section>

      <Section
        kicker="Portfolio trend"
        title="Approval rate and funding rate"
        lede="This portfolio trend is shown by month or week. The page filters above change the headline cards, but do not combine with this trend."
      >
        <div className="data-panel p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-copper">Approval rate</span>
            <span className="text-pine">Funding rate</span>
            <span className="ml-auto flex gap-1">
              {(["started_month", "started_week"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setGrain(item)}
                  aria-pressed={grain === item}
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

    </article>
  );
}

function formatCount(value: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function Insight({ number, label, value, body, href, action }: {
  number: string;
  label: string;
  value: string;
  body: string;
  href: string;
  action: string;
}) {
  return (
    <article className="data-panel flex h-full flex-col p-5">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-pine">{number} / {label}</p>
      <p className="num mt-4 text-4xl font-semibold tracking-tight text-ink">{value}</p>
      <p className="mt-3 flex-1 text-sm leading-6 text-muted">{body}</p>
      <Link href={href} className="mt-5 inline-flex w-fit items-center gap-2 text-sm font-semibold text-pine hover:underline">
        {action} <span aria-hidden="true">→</span>
      </Link>
    </article>
  );
}

function GuideLink({ href, number, title, description }: {
  href: string;
  number: string;
  title: string;
  description: string;
}) {
  return (
    <Link href={href} className="data-panel group block p-4 transition-colors hover:border-pine">
      <span className="text-xs font-bold text-pine">{number}</span>
      <span className="mt-2 flex items-center justify-between font-semibold text-ink">
        {title} <span className="text-pine transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
      </span>
      <span className="mt-1 block text-xs leading-5 text-muted">{description}</span>
    </Link>
  );
}
