"use client";

import { useEffect, useId, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, ErrorBar, LabelList, Line, LineChart,
  ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from "recharts";
import { formatCount, formatPercent, formatSignedPp } from "@/lib/format";

const GREEN = "#226f54";
const SLATE = "#53627b";
const tick = { fill: "#596473", fontSize: 12 };
const tip = { background: "#fff", border: "1px solid #dce4e1", borderRadius: 6, fontSize: 13, color: "#242a34" };
const percentTick = (value: number) => `${Math.round(value * 100)}%`;

function useNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 700px)");
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return narrow;
}

function CategoryTick({ x = 0, y = 0, payload, width = 145, names }: {
  x?: number; y?: number; payload?: { value: string | number }; width?: number; names?: string[];
}) {
  const words = String(names ? names[Number(payload?.value)] ?? "" : payload?.value ?? "").split(" ");
  const lines: string[] = [];
  for (const word of words) {
    if (!lines.length || (lines[lines.length - 1].length + word.length + 1) * 6.2 > width) lines.push(word);
    else lines[lines.length - 1] += ` ${word}`;
  }
  return <text x={x - 7} y={y} textAnchor="end" fill={tick.fill} fontSize={12}>
    {lines.map((line, index) => <tspan key={index} x={x - 7} dy={index === 0 ? -(lines.length - 1) * 7 + 4 : 14}>{line}</tspan>)}
  </text>;
}

function StageTick({ x = 0, y = 0, payload, names }: {
  x?: number; y?: number; payload?: { value: string }; names: Record<string, string>;
}) {
  const name = names[payload?.value ?? ""] ?? payload?.value ?? "";
  const words = name.split(" ");
  const split = name.length > 12 && words.length > 1;
  return <text x={x} y={y + 16} textAnchor="middle" fill={tick.fill} fontSize={12}>
    <tspan x={x}>{split ? words.slice(0, -1).join(" ") : name}</tspan>
    {split ? <tspan x={x} dy={15}>{words[words.length - 1]}</tspan> : null}
  </text>;
}

function Evidence({ columns, rows }: { columns: string[]; rows: string[][] }) {
  return <details className="chart-data">
    <summary>View chart data</summary>
    <div className="table-scroll"><table className="data-table w-full text-left text-sm">
      <thead><tr>{columns.map((column) => <th key={column} className="px-3 py-2 font-medium">{column}</th>)}</tr></thead>
      <tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, i) => <td key={i} className={`px-3 py-2 ${i ? "num" : ""}`}>{cell}</td>)}</tr>)}</tbody>
    </table></div>
  </details>;
}

function EmptyChart() { return <p className="py-10 text-center text-sm text-muted">No published data for this view.</p>; }

export function ConversionFunnel({ data }: { data: { name: string; value: number }[] }) {
  const narrow = useNarrow();
  const first = data[0]?.value ?? 0;
  const rows = data.map((row) => ({ ...row, share: first > 0 ? row.value / first : null }));
  if (!rows.length || first <= 0) return <EmptyChart />;
  const labels: Record<string, string> = {
    "Application started": "Started", "Personal info completed": "Personal info",
    "Bank connection started": "Bank link started", "Bank connected": "Bank linked",
    "Identity verified": "ID verified", "Application submitted": "Submitted",
    "Vehicle selected": "Vehicle selected", "Contract signed": "Contract signed", "Loan funded": "Funded",
  };
  return <div>
    <div style={{ height: narrow ? rows.length * 53 + 38 : 330 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout={narrow ? "vertical" : "horizontal"} margin={{ top: 16, right: narrow ? 55 : 12, bottom: 8, left: 0 }} barCategoryGap={narrow ? "28%" : "18%"}>
          <CartesianGrid stroke="#e5eae7" vertical={false} horizontal={!narrow} />
          {narrow ? <>
            <XAxis type="number" domain={[0, 1]} ticks={[0, .5, 1]} tick={tick} tickFormatter={percentTick} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={112} interval={0} tick={<CategoryTick width={105} />} axisLine={false} tickLine={false} />
          </> : <>
            <XAxis type="category" dataKey="name" tick={<StageTick names={labels} />} interval={0} tickLine={false} axisLine={false} height={45} />
            <YAxis type="number" domain={[0, 1]} ticks={[0, .25, .5, .75, 1]} tick={tick} tickFormatter={percentTick} width={44} axisLine={false} tickLine={false} />
          </>}
          <Tooltip cursor={false} contentStyle={tip} formatter={(value, _name, item) => [`${formatCount(item.payload.value)} applications · ${formatPercent(Number(value))} of started`, "Reached"]} />
          <Bar dataKey="share" fill={GREEN} background={{ fill: "#edf3ef" }} radius={narrow ? [0, 3, 3, 0] : [3, 3, 0, 0]} isAnimationActive={false}>
            <LabelList dataKey="value" position={narrow ? "right" : "top"} formatter={(v) => formatCount(Number(v))} fill="#242a34" fontSize={12} fontWeight={600} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
    <Evidence columns={["Stage", "Applications", "Share of started"]} rows={rows.map((row) => [row.name, formatCount(row.value), formatPercent(row.share)])} />
  </div>;
}

export function TrendChart({ data, activeLabel }: {
  data: { label: string; approval: number | null; funding: number | null }[]; activeLabel?: string | null;
}) {
  const narrow = useNarrow();
  const id = useId();
  if (!data.length) return <EmptyChart />;
  return <div>
    <p className="chart-legend"><span><i style={{ background: SLATE }} />Approval / decided</span><span><i style={{ background: GREEN }} />Funded / started</span></p>
    <div className="h-72 w-full" aria-labelledby={id}>
      <span id={id} className="sr-only">Approval and funding rates by start period</span>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
          <CartesianGrid stroke="#e5eae7" vertical={false} />
          <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={narrow ? 36 : 24} />
          <YAxis tick={tick} tickFormatter={percentTick} domain={[0, 1]} ticks={[0, .25, .5, .75, 1]} axisLine={false} tickLine={false} width={44} />
          <Tooltip contentStyle={tip} formatter={(value, name) => [formatPercent(Number(value)), name === "approval" ? "Approval / decided" : "Funded / started"]} />
          {activeLabel ? <ReferenceLine x={activeLabel} stroke={SLATE} strokeDasharray="3 3" /> : null}
          <Line type="linear" dataKey="approval" stroke={SLATE} strokeWidth={2} strokeDasharray="5 3" dot={data.length < 10 ? { r: 3 } : false} isAnimationActive={false} />
          <Line type="linear" dataKey="funding" stroke={GREEN} strokeWidth={2.5} dot={data.length < 10 ? { r: 3 } : false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
    <Evidence columns={["Start period", "Approval / decided", "Funded / started"]} rows={data.map((row) => [row.label, formatPercent(row.approval), formatPercent(row.funding)])} />
  </div>;
}

export function DropOffChart({ data }: { data: { label: string; dropOff: number }[] }) {
  const narrow = useNarrow();
  if (!data.length) return <EmptyChart />;
  return <div>
    <div style={{ height: data.length * 47 + 34 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 50, left: 0, bottom: 8 }} barSize={18}>
          <CartesianGrid stroke="#e5eae7" horizontal={false} />
          <XAxis type="number" tick={tick} tickFormatter={percentTick} domain={[0, "auto"]} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="label" width={narrow ? 125 : 190} interval={0} tick={<CategoryTick width={narrow ? 118 : 180} />} axisLine={false} tickLine={false} />
          <Tooltip cursor={false} contentStyle={tip} formatter={(v) => [formatPercent(Number(v)), "Did not reach the next stage"]} />
          <Bar dataKey="dropOff" fill={SLATE} radius={[0, 3, 3, 0]} isAnimationActive={false}>
            <LabelList dataKey="dropOff" position="right" formatter={(v) => formatPercent(Number(v))} fill="#242a34" fontSize={12} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
    <Evidence columns={["Stage", "Drop-off"]} rows={data.map((row) => [row.label, formatPercent(row.dropOff)])} />
  </div>;
}

export function ChannelChart({ data, active }: {
  data: { label: string; value: string; started: number | null; completion: number | null }[]; active?: string | null;
}) {
  const narrow = useNarrow();
  if (!data.length) return <EmptyChart />;
  return <div>
    <div className="grid gap-8 lg:grid-cols-2">
      {(["started", "completion"] as const).map((key) => <div key={key}>
        <h3 className="mb-3 text-sm font-semibold">{key === "started" ? "Applications started" : "Submission / started"}</h3>
        <div style={{ height: data.length * 49 + 36 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 55, left: 0, bottom: 8 }} barSize={18}>
              <CartesianGrid stroke="#e5eae7" horizontal={false} />
              <XAxis type="number" tick={tick} tickFormatter={key === "started" ? (v) => `${Math.round(v / 1000)}k` : percentTick} domain={key === "started" ? [0, "auto"] : [0, 1]} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" width={narrow ? 113 : 125} interval={0} tick={<CategoryTick width={narrow ? 105 : 118} />} axisLine={false} tickLine={false} />
              <Tooltip cursor={false} contentStyle={tip} formatter={(v) => [key === "started" ? formatCount(Number(v)) : formatPercent(Number(v)), key === "started" ? "Started" : "Submission / started"]} />
              <Bar dataKey={key} fill={key === "started" ? SLATE : GREEN} radius={[0, 3, 3, 0]} isAnimationActive={false}>
                {data.map((row) => <Cell key={row.value} opacity={active && row.value !== active ? .45 : 1} />)}
                <LabelList dataKey={key} position="right" formatter={(v) => key === "started" ? formatCount(v == null ? null : Number(v)) : formatPercent(v == null ? null : Number(v))} fill="#242a34" fontSize={12} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>)}
    </div>
    <Evidence columns={["Channel", "Applications started", "Submission / started"]} rows={data.map((row) => [row.label, formatCount(row.started), formatPercent(row.completion)])} />
  </div>;
}

export function RateComparisonChart({ data, firstLabel, secondLabel }: {
  data: { label: string; first: number | null; second: number | null; population?: number | null }[]; firstLabel: string; secondLabel: string;
}) {
  const narrow = useNarrow();
  if (!data.length) return <EmptyChart />;
  return <div>
    <p className="chart-legend"><span><i style={{ background: GREEN }} />{firstLabel}</span><span><i style={{ background: SLATE }} />{secondLabel}</span></p>
    <div style={{ height: data.length * 68 + 32 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 6, right: 50, left: 0, bottom: 8 }} barGap={4} barSize={14}>
          <CartesianGrid stroke="#e5eae7" horizontal={false} />
          <XAxis type="number" domain={[0, 1]} ticks={[0, .25, .5, .75, 1]} tick={tick} tickFormatter={percentTick} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="label" width={narrow ? 117 : 180} interval={0} tick={<CategoryTick width={narrow ? 108 : 168} />} axisLine={false} tickLine={false} />
          <Tooltip cursor={false} contentStyle={tip} formatter={(v, name) => [formatPercent(Number(v)), name === "first" ? firstLabel : secondLabel]} />
          <Bar dataKey="first" fill={GREEN} radius={[0, 2, 2, 0]} isAnimationActive={false}><LabelList dataKey="first" position="right" formatter={(v) => formatPercent(v == null ? null : Number(v))} fill="#242a34" fontSize={12} /></Bar>
          <Bar dataKey="second" fill={SLATE} radius={[0, 2, 2, 0]} isAnimationActive={false}><LabelList dataKey="second" position="right" formatter={(v) => formatPercent(v == null ? null : Number(v))} fill="#242a34" fontSize={12} /></Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
    <Evidence columns={["Group", firstLabel, secondLabel, ...(data.some((row) => row.population != null) ? ["Applications in population"] : [])]} rows={data.map((row) => [row.label, formatPercent(row.first), formatPercent(row.second), ...(data.some((item) => item.population != null) ? [formatCount(row.population)] : [])])} />
  </div>;
}

export function PairChart({ data }: { data: { label: string; completion: number | null; failure: number | null; denominator?: number | null }[] }) {
  return <RateComparisonChart data={data.map((row) => ({ label: row.label, first: row.completion, second: row.failure, population: row.denominator }))} firstLabel="Completed bank connection" secondLabel="Recorded a failure event" />;
}

export function DurationChart({ data }: { data: { label: string; medianDecision: number | null }[] }) {
  const narrow = useNarrow();
  const rows = data.map((row) => ({ ...row, hours: row.medianDecision == null ? null : row.medianDecision / 60 }));
  return <div>
    <div style={{ height: data.length * 65 + 35 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 12, right: 65, left: 0, bottom: 6 }} barSize={20}>
          <CartesianGrid stroke="#e5eae7" horizontal={false} />
          <XAxis type="number" tick={tick} tickFormatter={(v) => `${Math.round(v)} h`} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="label" width={narrow ? 80 : 125} tick={tick} tickLine={false} axisLine={false} />
          <Tooltip cursor={false} contentStyle={tip} formatter={(v) => [`${Number(v).toFixed(2)} h`, "Median submission to decision"]} />
          <Bar dataKey="hours" fill={SLATE} radius={[0, 3, 3, 0]} isAnimationActive={false}>
            <LabelList dataKey="hours" position="right" formatter={(v) => v == null ? "Not available" : `${Number(v).toFixed(2)} h`} fill="#242a34" fontSize={13} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
    <Evidence columns={["Path", "Median decision time"]} rows={data.map((row) => [row.label, row.medianDecision == null ? "Not available" : `${row.medianDecision.toFixed(1)} min`])} />
  </div>;
}

export function VariantChart({ data }: { data: { label: string; rate: number | null }[] }) {
  return <div>
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 14, left: 0, bottom: 8 }} barCategoryGap="30%">
          <CartesianGrid stroke="#e5eae7" vertical={false} />
          <XAxis dataKey="label" tick={{ ...tick, fontSize: 13 }} axisLine={false} tickLine={false} />
          <YAxis tick={tick} domain={[0, 1]} ticks={[0, .25, .5, .75, 1]} tickFormatter={percentTick} axisLine={false} tickLine={false} width={44} />
          <Tooltip cursor={false} contentStyle={tip} formatter={(v) => [formatPercent(Number(v)), "Completed / started bank connection"]} />
          <Bar dataKey="rate" radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {data.map((row) => <Cell key={row.label} fill={row.label === "Treatment" ? GREEN : SLATE} />)}
            <LabelList dataKey="rate" position="top" formatter={(v) => formatPercent(v == null ? null : Number(v))} fill="#242a34" fontSize={15} fontWeight={600} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
    <Evidence columns={["Group", "Bank connection completion"]} rows={data.map((row) => [row.label, formatPercent(row.rate)])} />
  </div>;
}

export function DifferenceChart({ data }: { data: { label: string; diff: number; error: [number, number] }[] }) {
  const narrow = useNarrow();
  const rows = data.map((row, index) => ({ ...row, position: index }));
  if (!rows.length) return <EmptyChart />;
  const low = Math.min(0, ...rows.map((row) => row.diff - row.error[0]));
  const high = Math.max(0, ...rows.map((row) => row.diff + row.error[1]));
  const padding = Math.max((high - low) * .1, .3);
  const step = high - low < 3 ? .5 : high - low < 8 ? 2 : 5;
  const start = Math.floor((low - padding) / step) * step;
  const end = Math.ceil((high + padding) / step) * step;
  const ticks = Array.from({ length: Math.round((end - start) / step) + 1 }, (_, index) => start + index * step);
  return <div>
    <div style={{ height: rows.length * 58 + 48 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 12, right: 20, left: 0, bottom: 8 }}>
          <CartesianGrid stroke="#e5eae7" horizontal={false} />
          <XAxis type="number" dataKey="diff" domain={[start, end]} ticks={ticks} tick={tick} tickFormatter={(v) => `${v} pp`} axisLine={false} tickLine={false} />
          <YAxis type="number" dataKey="position" reversed domain={[-.5, rows.length - .5]} ticks={rows.map((row) => row.position)} width={narrow ? 128 : 220} tick={<CategoryTick width={narrow ? 120 : 208} names={rows.map((row) => row.label)} />} axisLine={false} tickLine={false} />
          <ReferenceLine x={0} stroke="#596473" strokeDasharray="4 3" />
          <Tooltip cursor={false} content={({ active, payload }) => {
            const row = payload?.[0]?.payload;
            return active && row ? <div className="chart-tooltip"><strong>{row.label}</strong><p>{formatSignedPp(row.diff)}</p><p className="text-muted">95% CI: {formatSignedPp(row.diff - row.error[0])} to {formatSignedPp(row.diff + row.error[1])}</p></div> : null;
          }} />
          <Scatter data={rows} fill={GREEN} isAnimationActive={false}>
            <ErrorBar dataKey="error" direction="x" width={6} stroke={GREEN} strokeWidth={2} />
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
    <Evidence columns={["Metric", "Difference", "95% confidence interval"]} rows={rows.map((row) => [row.label, formatSignedPp(row.diff), `${formatSignedPp(row.diff - row.error[0])} to ${formatSignedPp(row.diff + row.error[1])}`])} />
  </div>;
}
