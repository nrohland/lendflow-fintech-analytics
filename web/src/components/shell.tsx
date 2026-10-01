"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { labelSlice, labelValue, metric, sliceValues, snapshot } from "@/lib/metrics";
import { formatCount, formatPeriod } from "@/lib/format";
import { FILTER_SLICES, type FilterSlice } from "@/lib/types";

type SliceState = { slice: FilterSlice; value: string; setSlice: (slice: FilterSlice, value?: string) => void };
const SliceContext = createContext<SliceState | null>(null);
export function useSlice(): SliceState {
  const value = useContext(SliceContext);
  if (!value) throw new Error("useSlice requires Shell");
  return value;
}
const NAV = [
  { href: "/", label: "Overview" }, { href: "/funnel", label: "Application funnel" },
  { href: "/operations", label: "Operations" }, { href: "/experiment", label: "Experiment" },
  { href: "/ask", label: "Ask LendFlow" },
];
function isFilterSlice(value: string | null): value is FilterSlice { return FILTER_SLICES.some((slice) => slice.id === value); }

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [slice, setSliceName] = useState<FilterSlice>("overall");
  const [value, setValue] = useState("all");
  useEffect(() => {
    function syncFromUrl() {
      if (window.location.pathname === "/experiment" || window.location.pathname === "/ask") return;
      const params = new URLSearchParams(window.location.search);
      const requested = params.get("slice");
      const requestedValue = params.get("value");
      if (isFilterSlice(requested) && requested !== "overall" && requestedValue && sliceValues(requested).includes(requestedValue)) {
        setSliceName(requested); setValue(requestedValue);
      } else { setSliceName("overall"); setValue("all"); }
    }
    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, [pathname]);
  const api = useMemo<SliceState>(() => ({ slice, value, setSlice: (next, nextValue) => {
    const resolved = next === "overall" ? "all" : nextValue ?? sliceValues(next)[0] ?? "all";
    setSliceName(next); setValue(resolved);
    const url = new URL(window.location.href);
    if (next === "overall") { url.searchParams.delete("slice"); url.searchParams.delete("value"); }
    else { url.searchParams.set("slice", next); url.searchParams.set("value", resolved); }
    window.history.replaceState(null, "", url);
  }}), [slice, value]);
  const showFilter = pathname !== "/experiment" && pathname !== "/ask";
  const values = slice === "overall" ? [] : sliceValues(slice);
  const source = snapshot.source;
  const end = source?.window_end_exclusive ? new Date(Date.parse(source.window_end_exclusive) - 86400000).toISOString().slice(0, 10) : null;
  const period = source?.window_start && end ? `${formatPeriod(source.window_start, "started_month")} to ${formatPeriod(end, "started_month")}` : "Published portfolio";

  return <SliceContext.Provider value={api}>
    <div className="min-h-screen">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded-md focus:bg-card focus:px-4 focus:py-2">Skip to content</a>
      <header className="site-header">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-8">
          <Link href="/" className="brand-mark text-lg font-bold tracking-tight" translate="no"><span className="brand-mark-icon" aria-hidden="true">L</span><span>LendFlow</span></Link>
          <div className="text-right text-xs leading-5 text-muted"><p>Synthetic data · Unofficial case study</p><p>{period}</p></div>
        </div>
        <nav className="site-nav mx-auto flex max-w-7xl gap-4 px-4 sm:gap-6 sm:px-8" aria-label="Pages">
          {NAV.map((item) => {
            const query = slice !== "overall" && item.href !== "/experiment" && item.href !== "/ask" ? `?${new URLSearchParams({ slice, value })}` : "";
            return <Link key={item.href} href={`${item.href}${query}`} aria-current={pathname === item.href ? "page" : undefined} className="px-1 py-3 text-sm font-medium text-muted">{item.label}</Link>;
          })}
        </nav>
        <div className="filter-bar">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-8">
            {showFilter ? <>
              <label htmlFor="view-by" className="text-xs font-semibold text-muted">View</label>
              <select id="view-by" value={slice} onChange={(event) => api.setSlice(event.target.value as FilterSlice)}>{FILTER_SLICES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
              {slice !== "overall" ? <>
                <label className="sr-only" htmlFor="view-value">{labelSlice(slice)} value</label>
                <select id="view-value" value={value} onChange={(event) => api.setSlice(slice, event.target.value)}>{values.map((item) => <option key={item} value={item}>{labelValue(slice, item)}</option>)}</select>
                <button type="button" className="text-link px-1" onClick={() => api.setSlice("overall")}>Reset view</button>
              </> : null}
              <p className="ml-auto text-xs text-muted" role="status">{formatCount(metric("applications_started", slice, value)?.metric_value)} applications started</p>
              <p className="w-full text-xs text-muted">One view at a time. Comparisons labeled Portfolio stay fixed.</p>
            </> : <p className="text-xs leading-5 text-muted">{pathname === "/ask" ? "A library of answers from the published metrics. No live model." : "Assigned control and treatment groups. Portfolio filters do not apply."}</p>}
          </div>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-10">{children}</main>
    </div>
  </SliceContext.Provider>;
}
