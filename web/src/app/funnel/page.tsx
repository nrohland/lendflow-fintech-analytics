"use client";

import { Note, Section } from "@/components/bits";
import { ChannelChart, ConversionFunnel, DropOffChart, PairChart } from "@/components/charts";
import { useSlice } from "@/components/shell";
import { formatCount, formatMetric, formatMinutes, formatPercent } from "@/lib/format";
import {
  FUNDING_PATH,
  bankConnectionPairs,
  channelRows,
  funnelStep,
  labelSlice,
  labelValue,
  metric,
  snapshot,
} from "@/lib/metrics";

const OUTCOMES = ["approved", "referred", "declined"] as const;

export default function FunnelPage() {
  const { slice, value } = useSlice();
  const path = FUNDING_PATH.map((name) => funnelStep(name, slice, value));
  const work = funnelStep("identity_verification_started", slice, value);
  const volume = path.filter((step) => step.reached != null).map((step) => ({
    name: step.label,
    value: step.reached ?? 0,
  }));
  const drops = [...path, work]
    .filter((step) => step.dropOff != null)
    .sort((left, right) => (right.dropOff ?? 0) - (left.dropOff ?? 0))
    .map((step) => ({ label: step.label, dropOff: step.dropOff ?? 0 }));
  const pairs = bankConnectionPairs();
  const channels = channelRows();
  const sliceText =
    slice === "overall" ? "the portfolio" : `${labelSlice(slice).toLowerCase()} · ${labelValue(slice, value)}`;

  return (
    <article className="page-content">
      <p className="eyebrow">Application funnel</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight text-ink">Where applicants leave.</h1>
      <p className="mt-3 max-w-2xl text-base leading-7 text-muted">
        Follow {sliceText} from application start to funding. Compare the stage losses, then look at bank connection by device and browser.
      </p>

      <Section kicker="Selected view" title="The path to funding" lede="Bar length is the share of applications started. Labels show the number reaching each stage.">
        <div className="data-panel p-4 sm:p-6">
          {volume.length >= 2 ? <ConversionFunnel data={volume} /> : <p className="text-sm text-muted">No funnel data for this filter.</p>}
        </div>
        <p className="mt-3 text-xs leading-5 text-muted">Approval is an outcome branch. The decline and referral counts appear below; the reduction after submission is not all abandonment.</p>
      </Section>

      <Section kicker="Selected view" title="Loss at each handoff" lede="Share of applicants reaching a stage who do not reach its next stage. Sorted from highest to lowest.">
        <div className="data-panel p-4 sm:p-6">
          <DropOffChart data={drops} />
        </div>
      </Section>

      <Section kicker="Stage detail" title="The complete scorecard">
        <details className="data-panel p-4">
          <summary className="text-sm font-semibold">Counts, conversion, time, and recorded errors</summary>
        <div className="table-scroll mt-4">
          <table className="data-table min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-3 font-medium">Stage</th>
                <th className="px-3 py-3 font-medium">Kind</th>
                <th className="px-3 py-3 text-right font-medium">Reached</th>
                <th className="px-3 py-3 text-right font-medium">Conversion</th>
                <th className="px-3 py-3 text-right font-medium">Drop-off</th>
                <th className="px-3 py-3 text-right font-medium">Median completer</th>
                <th className="px-3 py-3 text-right font-medium">Error rate</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.stages.map((stage) => {
                const step = funnelStep(stage.stage_name, slice, value);
                return (
                  <tr key={stage.stage_name} className="border-t border-line">
                    <td className="px-3 py-2 text-ink">{step.label}</td>
                    <td className="px-3 py-2 text-muted">{stage.stage_kind}</td>
                    <td className="num px-3 py-2 text-right">{formatCount(step.reached)}</td>
                    <td className="num px-3 py-2 text-right">{formatPercent(step.conversion)}</td>
                    <td className="num px-3 py-2 text-right">{formatPercent(step.dropOff)}</td>
                    <td className="num px-3 py-2 text-right">
                      {formatMinutes(step.durationMinutes)}
                    </td>
                    <td className="num px-3 py-2 text-right">
                      {step.errorDefined ? formatPercent(step.errorRate) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </details>
        <div className="mt-3">
          <Note>
            Error rate is blank on stages with no recorded failure event. A blank cell is undefined, and it is not
            zero. Identity verification started is a work stage between bank connected and identity verified.
          </Note>
        </div>
      </Section>

      <Section kicker="Decision split" title="Approved, referred, and declined">
        <div className="grid gap-3 sm:grid-cols-3">
          {OUTCOMES.map((name) => {
            const rateName =
              name === "approved" ? "approval_rate" : name === "referred" ? "referral_rate" : "decline_rate";
            const rate = metric(rateName, slice, value);
            const count = metric(
              name === "approved"
                ? "approved_applications"
                : name === "referred"
                  ? "referred_applications"
                  : "declined_applications",
              slice,
              value,
            );
            return (
              <article key={name} className="kpi">
                <p className="kpi-label capitalize">{name}</p>
                <p className="num mt-2 font-display text-3xl">{formatMetric(rate?.metric_value, "proportion")}</p>
                <p className="num mt-1 text-sm text-muted">{formatCount(count?.metric_value ?? null)} applications</p>
                <p className="mt-2 text-xs text-muted">Of decided applications</p>
              </article>
            );
          })}
        </div>
      </Section>

      <Section
        kicker="Portfolio cut"
        title="Bank connection by device and browser"
        lede="Both rates use bank connection starters. A recorded failure can be followed by completion, so the rates are not complements. Portfolio comparison; filters do not apply."
      >
        <div className="data-panel p-4 sm:p-6">
          <PairChart data={pairs} />
        </div>
      </Section>

      <Section
        kicker="Portfolio cut"
        title="Acquisition volume and submission"
        lede="The same channels, in the same order, on two separate scales. Portfolio comparison; filters do not apply."
      >
        <div className="data-panel p-4 sm:p-6">
          <ChannelChart data={channels} active={slice === "acquisition_channel" ? value : null} />
        </div>
      </Section>
    </article>
  );
}
