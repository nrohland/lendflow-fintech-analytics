import type { MetricRow } from "@/lib/types";
import { formatCount, formatMetric } from "@/lib/format";

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
    <section className="mt-14">
      <p className="text-xs font-bold uppercase tracking-[0.13em] text-pine">{kicker}</p>
      <h2 className="mt-2 font-display text-3xl leading-tight tracking-tight text-ink sm:text-4xl">{title}</h2>
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
    <article className="data-panel relative overflow-hidden px-5 py-5">
      <span className="absolute left-5 top-0 h-1 w-9 rounded-b bg-[#7bd568]" aria-hidden="true" />
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">{label}</p>
      <p className="num mt-3 font-sans text-3xl font-semibold tracking-[-0.045em] text-ink">
        {row ? formatMetric(row.metric_value, row.unit) : "—"}
      </p>
      <p className="mt-2 text-xs leading-5 text-muted">{hint ?? row?.population ?? "No row for this slice"}</p>
      {fraction ? <p className="num mt-1 text-xs text-ink">{fraction}</p> : null}
    </article>
  );
}

export function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border-l-[3px] border-[#60b975] bg-pine-soft px-4 py-3 text-sm leading-6 text-ink">
      {children}
    </p>
  );
}
