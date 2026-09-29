"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { labelSlice, labelValue, sliceValues, snapshot, sourceLine } from "@/lib/metrics";
import { FILTER_SLICES, type FilterSlice } from "@/lib/types";

type SliceState = {
  slice: FilterSlice;
  value: string;
  setSlice: (slice: FilterSlice, value?: string) => void;
};

const SliceContext = createContext<SliceState | null>(null);

export function useSlice(): SliceState {
  const value = useContext(SliceContext);
  if (!value) {
    throw new Error("useSlice requires Shell");
  }
  return value;
}

const NAV = [
  { href: "/", label: "Overview", index: "01" },
  { href: "/funnel", label: "Application Funnel", index: "02" },
  { href: "/operations", label: "Operations", index: "03" },
  { href: "/experiment", label: "Experiment", index: "04" },
  { href: "/ask", label: "Ask LendFlow", index: "05" },
];

function isFilterSlice(value: string | null): value is FilterSlice {
  return FILTER_SLICES.some((slice) => slice.id === value);
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [slice, setSliceName] = useState<FilterSlice>("overall");
  const [value, setValue] = useState("all");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("slice");
    if (!isFilterSlice(requested) || requested === "overall") return;
    const values = sliceValues(requested);
    const requestedValue = params.get("value");
    if (requestedValue && values.includes(requestedValue)) {
      setSliceName(requested);
      setValue(requestedValue);
    }
  }, []);

  const api = useMemo<SliceState>(
    () => ({
      slice,
      value,
      setSlice: (next, nextValue) => {
        const resolved = next === "overall" ? "all" : (nextValue ?? sliceValues(next)[0] ?? "all");
        setSliceName(next);
        setValue(resolved);
        const url = new URL(window.location.href);
        if (next === "overall") {
          url.searchParams.delete("slice");
          url.searchParams.delete("value");
        } else {
          url.searchParams.set("slice", next);
          url.searchParams.set("value", resolved);
        }
        window.history.replaceState(null, "", url);
      },
    }),
    [slice, value],
  );

  const showFilter = pathname !== "/experiment" && pathname !== "/ask";
  const values = slice === "overall" ? [] : sliceValues(slice);

  return (
    <SliceContext.Provider value={api}>
      <div className="min-h-screen">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded-md focus:bg-card focus:px-4 focus:py-2">Skip to content</a>
        <header className="site-header border-b border-line">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
            <Link href="/" className="brand-mark font-sans text-[1.05rem] font-bold tracking-[-0.03em] text-ink" translate="no">
              <span className="brand-mark-icon" aria-hidden="true">L</span>
              <span>LendFlow <span className="block text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">Product intelligence</span></span>
            </Link>
            <p className="hidden text-right text-xs font-medium text-muted sm:block">Synthetic auto-loan analytics</p>
          </div>
          <div className="border-y border-line bg-[#edf6ed]">
            <p className="mx-auto max-w-7xl px-4 py-2 text-xs leading-5 text-ink sm:px-8">
              <span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#4fae67]" aria-hidden="true" />
              <span className="font-semibold">Synthetic data</span> · Unofficial portfolio case study · No real applicants or lender affiliation
            </p>
          </div>
          <nav className="site-nav mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-2 sm:px-8" aria-label="Pages">
            {NAV.map((item) => {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={pathname === item.href ? "page" : undefined}
                  className="shrink-0 px-3 py-2 text-sm font-medium text-muted"
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          {showFilter ? (
            <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 pb-3 sm:px-8">
              <span className="mr-1 text-xs font-bold uppercase tracking-wide text-muted">View by</span>
              {FILTER_SLICES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => api.setSlice(item.id)}
                  aria-pressed={slice === item.id}
                  className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                    slice === item.id
                      ? "border-pine bg-pine text-white"
                      : "border-line bg-card text-ink hover:border-pine"
                  }`}
                >
                  {item.label}
                </button>
              ))}
              {slice !== "overall" ? (
                <label className="ml-1 text-sm text-muted">
                  <span className="sr-only">{labelSlice(slice)} value</span>
                  <select
                    className="rounded-md border border-line bg-card px-3 py-1.5 text-ink"
                    value={value}
                    onChange={(event) => api.setSlice(slice, event.target.value)}
                  >
                    {values.map((item) => (
                      <option key={item} value={item}>
                        {labelValue(slice, item)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          ) : (
            <p className="mx-auto max-w-7xl px-4 pb-3 text-xs text-muted sm:px-8">
              {pathname === "/ask"
                ? "Ask reads product_metrics and fct_experiment_results. The slice control on the other pages is not applied here."
                : "Experiment rows are the assigned comparison in fct_experiment_results. Device, browser, channel, and period filters apply on the other pages."}
            </p>
          )}
        </header>
        <main id="main-content" tabIndex={-1} className="mx-auto max-w-7xl px-4 py-10 sm:px-8 sm:py-14">{children}</main>
        <footer className="border-t border-line">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-8 text-xs text-muted sm:px-8">
            <p>{sourceLine()}</p>
            <p>
              Figures are read from the governed export: product_metrics and fct_experiment_results.
              product_decision is {snapshot.product_decision ?? "null"}. SLA attainment is{" "}
              {snapshot.sla_attainment}.
            </p>
            <p>Synthetic data. Unofficial portfolio case study. Not affiliated with any real lender.</p>
          </div>
        </footer>
      </div>
    </SliceContext.Provider>
  );
}
