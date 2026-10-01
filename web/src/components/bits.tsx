import type { MetricRow } from "@/lib/types";
import { formatCount, formatMetric } from "@/lib/format";
import { displayText } from "@/lib/metrics";

export function Section({
  kicker,
  title,
  lede,
  children,
}: {
  kicker: string;
  title: string;
  lede?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10 sm:mt-12">
      <p className="eyebrow">{kicker}</p>
      <h2 className="mt-2 font-display text-3xl leading-tight tracking-tight text-ink sm:text-[2.15rem]">{title}</h2>
      {lede ? <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{lede}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function Kpi({
  label,
  row,
  hint,
}: {
  label: string;
  row: MetricRow | null;
  hint?: string;
}) {
  const fraction =
    row && row.unit === "proportion" && row.numerator != null && row.denominator != null
      ? `${formatCount(row.numerator)} / ${formatCount(row.denominator)}`
      : null;
  return (
    <article className="kpi">
      <p className="kpi-label">{label}</p>
      <p className="num kpi-value mt-3 text-ink">
        {row ? formatMetric(row.metric_value, row.unit) : "—"}
      </p>
      <p className="mt-2 text-xs leading-5 text-muted">{displayText(hint ?? row?.population ?? "No published data for this view")}</p>
      {fraction ? <p className="num mt-1 text-xs text-ink">{fraction}</p> : null}
    </article>
  );
}

export function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="analysis-note">
      {children}
    </p>
  );
}
