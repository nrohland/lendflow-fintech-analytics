"use client";

import { Note, Section } from "@/components/bits";
import { ChannelChart, DropOffChart, PairChart, VolumeChart } from "@/components/charts";
import { useSlice } from "@/components/shell";
import { formatCount, formatMetric, formatPercent } from "@/lib/format";
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
    label: step.label,
    reached: step.reached ?? 0,
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
    <article>
      <p className="text-xs uppercase tracking-[0.16em] text-copper">02 — Application funnel</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight text-ink">Where is the friction?</h1>
      <p className="mt-3 max-w-2xl text-base leading-7 text-muted">
        Step volume, conversion, drop-off, median completer time, and error rate for {sliceText}. Drop-off
        is 1 minus step conversion among applications that reached the stage. Median time is among
        applications that reach the next stage.
      </p>

      <Section kicker="Volume" title="Reached counts along the funding path">
        <div className="rounded-2xl border border-line bg-card p-4">
          <VolumeChart data={volume} />
        </div>
      </Section>

      <Section kicker="Drop-off" title="Share that does not reach the next stage">
        <div className="rounded-2xl border border-line bg-card p-4">
          <DropOffChart data={drops} />
        </div>
      </Section>

      <Section kicker="Scorecard" title="One row per stage">
        <div className="overflow-x-auto rounded-2xl border border-line bg-card">
          <table className="min-w-full text-left text-sm">
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
                      {step.durationMinutes == null ? "—" : `${step.durationMinutes.toFixed(1)} min`}
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
        <div className="mt-3">
          <Note>
            error_rate is blank on stages with no failure event. A blank cell is undefined, and it is not
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
              <article key={name} className="rounded-2xl border border-line bg-card p-4">
                <p className="text-xs uppercase tracking-wide text-muted">{name}</p>
                <p className="num mt-2 font-display text-3xl">{formatMetric(rate?.metric_value, "proportion")}</p>
                <p className="num mt-1 text-sm text-muted">{formatCount(count?.metric_value ?? null)} applications</p>
                <p className="mt-2 text-xs text-muted">{rate?.population}</p>
              </article>
            );
          })}
        </div>
      </Section>

      <Section
        kicker="Portfolio cut"
        title="Bank connection by device and browser"
        lede="device_browser is device_type and browser joined with a pipe. Completion and failure incidence both use applications that start bank connection. This cut is the portfolio. It does not cross with the page filter."
      >
        <div className="rounded-2xl border border-line bg-card p-4">
          <div className="mb-2 flex gap-3 text-sm">
            <span className="text-pine">Completion</span>
            <span className="text-copper">Failure incidence</span>
          </div>
          <PairChart data={pairs} />
        </div>
      </Section>

      <Section
        kicker="Portfolio cut"
        title="Channel start volume and completion"
        lede="applications_started and application_completion_rate on acquisition_channel. Start volume and completion are separate metrics."
      >
        <div className="rounded-2xl border border-line bg-card p-4">
          <ChannelChart data={channels} active={slice === "acquisition_channel" ? value : null} />
        </div>
      </Section>
    </article>
  );
}
