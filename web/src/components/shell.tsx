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

  const showFilter = pathname !== "/experiment";
  const values = slice === "overall" ? [] : sliceValues(slice);

  return (
    <SliceContext.Provider value={api}>
      <div className="min-h-screen">
        <header className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <Link href="/" className="font-display text-xl tracking-tight text-ink">
              LendFlow
            </Link>
            <p className="text-right text-xs text-muted">Synthetic auto-loan case study</p>
          </div>
          <div className="border-y border-copper/30 bg-copper-soft">
            <p className="mx-auto max-w-6xl px-4 py-2 text-sm text-ink sm:px-6">
              <span className="font-semibold">Synthetic data.</span> Unofficial portfolio case study.
              Not a lender product. Not affiliated with any real lender.
            </p>
          </div>
          <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-2 sm:px-6" aria-label="Pages">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${
                    active ? "bg-ink text-paper" : "text-muted hover:bg-card hover:text-ink"
                  }`}
                >
                  <span className="mr-1 text-[11px] tracking-wide">{item.index}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
          {showFilter ? (
            <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 pb-3 sm:px-6">
              <span className="text-xs uppercase tracking-wide text-muted">Slice</span>
              {FILTER_SLICES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => api.setSlice(item.id)}
                  className={`rounded-full border px-3 py-1 text-sm ${
                    slice === item.id
                      ? "border-ink bg-ink text-paper"
                      : "border-line bg-card text-ink hover:border-muted"
                  }`}
                >
                  {item.label}
                </button>
              ))}
              {slice !== "overall" ? (
                <label className="ml-1 text-sm text-muted">
                  <span className="sr-only">{labelSlice(slice)} value</span>
                  <select
                    className="rounded-full border border-line bg-card px-3 py-1 text-ink"
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
            <p className="mx-auto max-w-6xl px-4 pb-3 text-sm text-muted sm:px-6">
              Experiment rows are the assigned comparison in fct_experiment_results. Device, browser,
              channel, and period filters apply on the other pages.
            </p>
          )}
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
        <footer className="border-t border-line">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted sm:px-6">
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
