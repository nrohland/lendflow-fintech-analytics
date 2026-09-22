import type { ExperimentRow, Unit } from "./types";

export function formatCount(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

export function formatMetric(value: number | null | undefined, unit: Unit | string): string {
  if (value == null || Number.isNaN(value)) return "—";
  if (unit === "proportion") return formatPercent(value);
  if (unit === "count") return formatCount(value);
  if (unit === "minutes") return `${formatNumber(value, 1)} min`;
  if (unit === "hours") return `${formatNumber(value, 1)} h`;
  return formatNumber(value, 2);
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatSignedPercent(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(digits)}%`;
}

export function formatSignedPp(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)} pp`;
}

export function formatNumber(value: number, digits: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatMinutes(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const minutes = `${formatNumber(value, 1)} min`;
  if (value < 90) return minutes;
  return `${minutes} (${formatNumber(value / 60, 1)} h)`;
}

export function formatP(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  if (value < 0.001) return "< 0.001";
  return value.toFixed(3);
}

export function formatInterval(row: ExperimentRow): string {
  if (row.ci_low == null || row.ci_high == null) return "—";
  if (row.unit === "proportion") {
    return `${formatSignedPp(row.ci_low * 100)} to ${formatSignedPp(row.ci_high * 100)}`;
  }
  if (row.unit === "minutes") {
    return `${formatNumber(row.ci_low, 2)} to ${formatNumber(row.ci_high, 2)} min`;
  }
  return `${formatNumber(row.ci_low, 2)} to ${formatNumber(row.ci_high, 2)}`;
}

export function formatDifference(row: ExperimentRow): string {
  if (row.unit === "proportion") return formatSignedPp(row.absolute_difference_pp);
  if (row.unit === "minutes" && row.absolute_difference != null) {
    return `${formatSignedNumber(row.absolute_difference, 2)} min`;
  }
  if (row.absolute_difference == null) return "—";
  return formatSignedNumber(row.absolute_difference, 3);
}

function formatSignedNumber(value: number, digits: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value, digits)}`;
}

export function titleCase(value: string): string {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatPeriod(value: string, slice: string): string {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (slice === "started_month") {
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
