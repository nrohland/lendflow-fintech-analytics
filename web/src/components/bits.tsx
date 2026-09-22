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
    <section className="mt-10">
      <p className="text-xs uppercase tracking-[0.16em] text-copper">{kicker}</p>
      <h2 className="mt-1 font-display text-2xl tracking-tight text-ink">{title}</h2>
      {lede ? <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{lede}</p> : null}
      <div className="mt-4">{children}</div>
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
    <article className="rounded-2xl border border-line bg-card px-4 py-4">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="num mt-2 font-display text-3xl tracking-tight text-ink">
        {row ? formatMetric(row.metric_value, row.unit) : "—"}
      </p>
      <p className="mt-2 text-xs leading-5 text-muted">{hint ?? row?.population ?? "No row for this slice"}</p>
      {fraction ? <p className="num mt-1 text-xs text-ink">{fraction}</p> : null}
    </article>
  );
}

export function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-gold/30 bg-gold-soft px-3 py-2 text-sm leading-6 text-ink">
      {children}
    </p>
  );
}
