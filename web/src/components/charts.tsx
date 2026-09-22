"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  ErrorBar,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCount, formatPercent } from "@/lib/format";

const tooltipStyle = {
  background: "#fbf8f2",
  border: "1px solid #e0d8cb",
  borderRadius: 10,
  fontSize: 12,
  color: "#1c1915",
};

const axisTick = { fill: "#5f584e", fontSize: 12 };

export function TrendChart({
  data,
  activeLabel,
}: {
  data: { label: string; approval: number | null; funding: number | null }[];
  activeLabel?: string | null;
}) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#e0d8cb" vertical={false} />
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis
            tick={axisTick}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
            width={42}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value, name) => [formatPercent(Number(value)), name === "approval" ? "Approval rate" : "Funding rate"]}
          />
          {activeLabel ? <ReferenceLine x={activeLabel} stroke="#8d4e2e" strokeDasharray="3 3" /> : null}
          <Line type="monotone" dataKey="approval" name="approval" stroke="#8d4e2e" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="funding" name="funding" stroke="#1e5c45" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function VolumeChart({ data }: { data: { label: string; reached: number }[] }) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid stroke="#e0d8cb" horizontal={false} />
          <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} tickFormatter={(value: number) => formatCount(value)} />
          <YAxis type="category" dataKey="label" width={168} tick={axisTick} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value) => [formatCount(Number(value)), "Reached"]} />
          <Bar dataKey="reached" fill="#1e5c45" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DropOffChart({ data }: { data: { label: string; dropOff: number }[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid stroke="#e0d8cb" horizontal={false} />
          <XAxis
            type="number"
            tick={axisTick}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
          />
          <YAxis type="category" dataKey="label" width={168} tick={axisTick} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value) => [formatPercent(Number(value)), "Drop-off"]} />
          <Bar dataKey="dropOff" fill="#8d4e2e" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ChannelChart({
  data,
  active,
}: {
  data: { label: string; value: string; started: number | null; completion: number | null }[];
  active?: string | null;
}) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#e0d8cb" vertical={false} />
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval={0} />
          <YAxis yAxisId="count" tick={axisTick} axisLine={false} tickLine={false} width={48} />
          <YAxis
            yAxisId="rate"
            orientation="right"
            tick={axisTick}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
            width={42}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value, name) =>
              name === "started"
                ? [formatCount(Number(value)), "Started"]
                : [formatPercent(Number(value)), "Application completion"]
            }
          />
          <Bar yAxisId="count" dataKey="started" radius={[4, 4, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.value} fill={entry.value === active ? "#1e5c45" : "#d7ebe2"} />
            ))}
          </Bar>
          <Line yAxisId="rate" type="monotone" dataKey="completion" stroke="#8d4e2e" strokeWidth={2} dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PairChart({
  data,
}: {
  data: { label: string; completion: number | null; failure: number | null }[];
}) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid stroke="#e0d8cb" horizontal={false} />
          <XAxis
            type="number"
            tick={axisTick}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
          />
          <YAxis type="category" dataKey="label" width={150} tick={axisTick} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value, name) => [
              formatPercent(Number(value)),
              name === "completion" ? "Completion" : "Failure incidence",
            ]}
          />
          <Bar dataKey="completion" fill="#1e5c45" radius={[0, 4, 4, 0]} />
          <Bar dataKey="failure" fill="#8d4e2e" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function VariantChart({ data }: { data: { label: string; rate: number }[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#e0d8cb" vertical={false} />
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis
            tick={axisTick}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
            width={42}
            domain={[0, 1]}
          />
          <Tooltip contentStyle={tooltipStyle} formatter={(value) => [formatPercent(Number(value)), "Completion"]} />
          <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.label} fill={entry.label === "Treatment" ? "#1e5c45" : "#c8c0b2"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DifferenceChart({
  data,
}: {
  data: { label: string; diff: number; error: [number, number] }[];
}) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
          <CartesianGrid stroke="#e0d8cb" horizontal={false} />
          <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} unit=" pp" />
          <YAxis type="category" dataKey="label" width={180} tick={axisTick} axisLine={false} tickLine={false} />
          <ReferenceLine x={0} stroke="#1c1915" />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value) => [`${Number(value).toFixed(1)} pp`, "Treatment − control"]}
          />
          <Bar dataKey="diff" fill="#1e5c45" radius={[0, 4, 4, 0]}>
            <ErrorBar dataKey="error" stroke="#1c1915" strokeWidth={1.5} width={6} direction="x" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
