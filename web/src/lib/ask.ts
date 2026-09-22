import {
  formatCount,
  formatDifference,
  formatInterval,
  formatMetric,
  formatMinutes,
  formatP,
  formatPercent,
  formatSignedPercent,
  formatSignedPp,
} from "./format";
import {
  experimentRows,
  labelMetric,
  labelSlice,
  labelStage,
  labelValue,
  metric,
  primaryExperiment,
  snapshot,
} from "./metrics";
import type { ExperimentRow, MetricRow, StageRow } from "./types";

export type AskStatus = "answered" | "refused";

export type AskTable = {
  caption: string;
  columns: string[];
  rows: string[][];
};

export type AskAnswer = {
  status: AskStatus;
  intent: string;
  heading: string;
  paragraphs: string[];
  table: AskTable | null;
  sql: string | null;
  compiledSql: string | null;
  compiledSqlLabel: string | null;
};

export const ASK_EXAMPLES: { question: string }[] = [
  { question: "Where do applicants drop off most?" },
  { question: "Which segment has the longest underwriting time?" },
  { question: "Why did funding conversion decline?" },
  { question: "How does manual review affect decision time?" },
  { question: "Did the bank-connection experiment improve completion?" },
  { question: "What did the guardrails do?" },
  { question: "Show the funnel for mobile applicants from paid search." },
  { question: "What is the bank connection completion denominator?" },
];

const STOP = new Set(
  "what is the a an of for on in by among to did do does how why where which who when show me tell about from and or with without our their this that these those please can you we should would could into vs versus between after before during its it be been being have has had was were are am if than then so not no yes any all overall portfolio total same also just there here over under per across within using used use get got give given applicants applicant applications application users user loans loan app apps most".split(
    " ",
  ),
);

const KNOWN = new Set(
  `segment segments has longest slowest underwriting decision decisions time times
  manual review reviews reviewed path paths auto automatic affect effect impact
  funding funded fund funds conversion conversions decline declined fell decrease decreased falling
  drop off dropoff dropped abandonment abandoned abandon funnel step steps stage stages
  bank connection connections completion complete completed completing improve improved primary
  experiment experiments treatment variant variants control uplift relative absolute difference
  guardrail guardrails denominator numerator population grain assigned assignment clarity
  approval approved approvals contracted contract submit submitted submitting submission
  median average identity verification failure failures failed fail error errors start starts started starting
  rate rates sla attainment ship iterate iteration shipping hypothesis result results
  significant significance interval confidence value values pvalue null alpha rejected
  translate translation become becomes mobile desktop tablet safari chrome firefox edge samsung internet
  paid search organic social prospecting partner referral direct returning new
  device devices browser browsers channel channels slice slices metric metrics export mart marts
  catalog question questions answer answers defined definition explain describe happened happen
  friction bottleneck wait waiting compare comparison group groups breakdown volume share ratio
  kpi figure figures number numbers count counts percent percentage point points
  highest lowest best worst larger smaller bigger
  month months week weeks trend series window cause causes causal
  portfolio overall started personal info connected verified vehicle selected
  risk band bands high low moderate elevated state
  row rows table published separate intersection combined crossed cross
  demo synthetic unofficial read only readonly sql`.split(/\s+/),
);

type SliceHit = { slice: string; value: string };

type Detection =
  | { kind: "none" }
  | { kind: "one"; hit: SliceHit }
  | { kind: "device_channel"; device: SliceHit; channel: SliceHit }
  | { kind: "missing_pair"; value: string }
  | { kind: "unsupported_cross"; hits: SliceHit[] };

const CHANNELS: [string, string][] = [
  ["paid search", "paid_search"],
  ["organic search", "organic_search"],
  ["social prospecting", "social_prospecting"],
  ["partner referral", "partner_referral"],
  ["direct", "direct"],
];

const METRIC_ALIASES: [string, string][] = [
  ["bank connection completion", "bank_connection_completion_rate"],
  ["bank connection failure", "bank_connection_failure_incidence"],
  ["bank connection start", "bank_connection_start_rate"],
  ["approved to funded", "approved_to_funded_rate"],
  ["approval to funding", "approved_to_funded_rate"],
  ["approved to contracted", "approved_to_contracted_rate"],
  ["contracted to funded", "contracted_to_funded_rate"],
  ["identity verification failure", "identity_verification_failure_rate"],
  ["identity failure", "identity_verification_failure_rate"],
  ["median time to decision", "median_time_to_decision"],
  ["median decision time", "median_time_to_decision"],
  ["median time to submit", "median_time_to_submit"],
  ["median time to funding", "median_time_to_funding"],
  ["median funding duration", "median_funding_duration_hours"],
  ["application completion", "application_completion_rate"],
  ["completion rate", "application_completion_rate"],
  ["manual review rate", "manual_review_rate"],
  ["funding rate", "funding_rate"],
  ["approval rate", "approval_rate"],
  ["decline rate", "decline_rate"],
  ["referral rate", "referral_rate"],
  ["applications started", "applications_started"],
  ["application submission", "application_completion_rate"],
];

const EXPERIMENT_SQL = `select
    metric_name,
    metric_role,
    population,
    unit,
    n_assigned_control,
    n_assigned_treatment,
    n_control,
    n_treatment,
    n_assigned_outside_population_control,
    n_assigned_outside_population_treatment,
    conversions_control,
    conversions_treatment,
    control_value,
    treatment_value,
    absolute_difference,
    absolute_difference_pp,
    relative_uplift,
    ci_low,
    ci_high,
    p_value,
    null_rejected_at_alpha,
    alpha,
    test_method,
    interval_method
from marts.fct_experiment_results
order by metric_role, metric_name`;

const EXPERIMENT_GUARDRAIL_SQL = `select
    metric_name,
    metric_role,
    population,
    unit,
    control_value,
    treatment_value,
    absolute_difference,
    absolute_difference_pp,
    relative_uplift,
    ci_low,
    ci_high,
    p_value,
    null_rejected_at_alpha,
    alpha
from marts.fct_experiment_results
where metric_role = 'guardrail'
order by metric_name`;

const EXPERIMENT_COLUMNS = [
  "Metric",
  "Role",
  "Control",
  "Treatment",
  "Difference",
  "95% interval",
  "p-value",
  "Null rejected",
];

export function answerQuestion(raw: string): AskAnswer {
  const q = normalize(raw);
  if (!q) {
    return refuse("empty", "Enter a question. The suggestions are the catalog.");
  }
  if (isBlocked(q)) {
    return refuse(
      "blocked",
      "This catalog reads the committed export only. It does not forecast, and it does not call a model provider.",
    );
  }
  if (leftoverTokens(q).length > 0) {
    return refuse(
      "unrecognized",
      "This question is outside the Ask LendFlow catalog. Answers come from product_metrics and fct_experiment_results only.",
    );
  }
  if (has(q, "guardrail") || has(q, "guardrails")) return answerGuardrails();
  if (has(q, "sla") || has(q, "attainment")) return answerSla();
  if (wantsExperimentResult(q)) {
    const detected = detect(q);
    if (detected.kind !== "none") {
      return refuse(
        "experiment_recut",
        "The experiment result is the assigned comparison. It is not published by device, browser, or channel, so this reply does not recut it.",
      );
    }
    return answerExperiment();
  }
  if (isShip(q)) return answerShip();

  const detected = detect(q);
  if (detected.kind === "missing_pair") return refuseMissingPair(detected.value);
  if (detected.kind === "device_channel") return answerDeviceChannel(q, detected.device, detected.channel);
  if (detected.kind === "unsupported_cross") {
    return refuse(
      "cross",
      "Those cuts are separate slices. The export has no combined row, so the intersection stays blank.",
    );
  }
  if (isManual(q)) return answerManual();
  if (isFundingDecline(q)) {
    if (detected.kind === "one") {
      return refuse(
        "decline_slice",
        "The month series for funding conversion is the portfolio started_month slice. It is not crossed with another cut, so this reply stops.",
      );
    }
    return answerFundingDecline();
  }
  if (isLongest(q)) return answerLongest();
  if (isGrain(q)) return answerGrain();
  if (mentionsDropoff(q)) {
    if (detected.kind === "one") return answerDropoff(detected.hit);
    if (specifiesUnknownCut(q)) return refuseUnknownCut();
    return answerDropoff(null);
  }
  if (isComparative(q)) {
    return refuse(
      "unranked",
      "This catalog does not rank an unpublished cut. No figure is filled in.",
    );
  }

  const alias = matchMetricAlias(q);
  if (alias) {
    if (detected.kind === "one") return answerMetric(alias, detected.hit);
    if (specifiesUnknownCut(q)) return refuseUnknownCut();
    return answerMetric(alias, null);
  }
  if (isFundingTopic(q)) {
    if (detected.kind === "one") return answerFunding(detected.hit);
    if (specifiesUnknownCut(q)) return refuseUnknownCut();
    return answerFunding(null);
  }
  if (has(q, "funnel")) {
    if (detected.kind === "one") return answerDropoff(detected.hit);
    if (specifiesUnknownCut(q)) return refuseUnknownCut();
    return answerDropoff(null);
  }
  if (has(q, "bank")) {
    if (detected.kind === "one") return answerBank(detected.hit);
    if (specifiesUnknownCut(q)) return refuseUnknownCut();
    return answerBank(null);
  }
  return refuse(
    "unknown",
    "This question is outside the Ask LendFlow catalog. Answers come from product_metrics and fct_experiment_results only.",
  );
}

export function leftoverTokens(raw: string): string[] {
  const q = normalize(raw);
  return q.split(" ").filter((token) => {
    if (token.length <= 1) return false;
    if (/^\d/.test(token)) return true;
    return !STOP.has(token) && !KNOWN.has(token);
  });
}

function normalize(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function has(q: string, phrase: string): boolean {
  return ` ${q} `.includes(` ${phrase} `);
}

function isBlocked(q: string): boolean {
  return /\b(predict|forecast|chatgpt|openai|llm|next month|next quarter)\b/.test(q);
}

function isComparative(q: string): boolean {
  return /\b(which|highest|lowest|longest|slowest|best|worst|most|compare|comparison)\b/.test(q);
}

function wantsExperimentResult(q: string): boolean {
  const aboutTest = has(q, "experiment") || has(q, "treatment") || has(q, "variant");
  if (!aboutTest) return false;
  return (
    has(q, "completion") ||
    has(q, "complete") ||
    has(q, "completed") ||
    has(q, "improve") ||
    has(q, "improved") ||
    has(q, "uplift") ||
    has(q, "result") ||
    has(q, "results") ||
    has(q, "difference") ||
    has(q, "significant") ||
    has(q, "significance")
  );
}

function isShip(q: string): boolean {
  return has(q, "do not ship") || has(q, "iterate") || has(q, "ship");
}

function isManual(q: string): boolean {
  return has(q, "manual") && (has(q, "review") || has(q, "decision") || has(q, "time") || has(q, "underwriting") || has(q, "path"));
}

function isFundingDecline(q: string): boolean {
  const funding = has(q, "funding") || has(q, "funded");
  if (!funding) return false;
  if (has(q, "decline") || has(q, "declined") || has(q, "fell") || has(q, "decrease") || has(q, "decreased") || has(q, "falling")) {
    return true;
  }
  return (has(q, "drop") || has(q, "dropped")) && !mentionsDropoff(q);
}

function isLongest(q: string): boolean {
  return (has(q, "longest") || has(q, "slowest")) && (has(q, "underwriting") || has(q, "decision") || has(q, "review"));
}

function isGrain(q: string): boolean {
  const asks = has(q, "denominator") || has(q, "population") || has(q, "grain") || has(q, "among");
  const topic = has(q, "bank") || has(q, "experiment") || has(q, "primary") || has(q, "completion");
  return asks && topic;
}

function mentionsDropoff(q: string): boolean {
  return (
    has(q, "drop off") ||
    has(q, "dropoff") ||
    has(q, "dropped off") ||
    has(q, "abandon") ||
    has(q, "abandoned") ||
    has(q, "abandonment")
  );
}

function isFundingTopic(q: string): boolean {
  return has(q, "funding") || has(q, "funded") || (has(q, "approval") && has(q, "approved"));
}

function specifiesUnknownCut(q: string): boolean {
  if (!has(q, "for") && !has(q, "among")) return false;
  if (has(q, "all") || has(q, "overall") || has(q, "portfolio") || has(q, "total")) return false;
  if (has(q, "applicants") || has(q, "applications") || has(q, "users")) {
    const without = q
      .replace(/\bapplicants\b/g, " ")
      .replace(/\bapplications\b/g, " ")
      .replace(/\busers\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return has(without, "for") || has(without, "among");
  }
  return true;
}

function matchMetricAlias(q: string): string | null {
  for (const [phrase, name] of METRIC_ALIASES) {
    if (has(q, phrase)) return name;
  }
  return null;
}

function detect(q: string): Detection {
  const devices = ["mobile", "desktop", "tablet"].filter((word) => has(q, word));
  const browsers = ["samsung internet", "safari", "chrome", "firefox", "edge"].filter((word) => has(q, word));
  let channel: [string, string] | null = null;
  for (const entry of CHANNELS) {
    if (has(q, entry[0])) {
      channel = entry;
      break;
    }
  }
  if (!channel && has(q, "paid")) channel = ["paid", "paid_search"];
  const returning = has(q, "returning") ? "true" : has(q, "new user") || has(q, "new users") ? "false" : null;

  if (devices.length > 1 || browsers.length > 1) {
    return { kind: "unsupported_cross", hits: [] };
  }

  const hits: SliceHit[] = [];
  if (devices.length === 1 && browsers.length === 1) {
    const browser = browsers[0] === "samsung internet" ? "samsung_internet" : browsers[0];
    const value = `${devices[0]}|${browser}`;
    if (!sliceExists("device_browser", value)) return { kind: "missing_pair", value };
    hits.push({ slice: "device_browser", value });
  } else {
    if (devices.length === 1) hits.push({ slice: "device_type", value: devices[0] });
    if (browsers.length === 1) {
      const browser = browsers[0] === "samsung internet" ? "samsung_internet" : browsers[0];
      hits.push({ slice: "browser", value: browser });
    }
  }
  if (channel) hits.push({ slice: "acquisition_channel", value: channel[1] });
  if (returning) hits.push({ slice: "returning_user", value: returning });

  if (hits.length === 0) return { kind: "none" };
  if (hits.length === 1) return { kind: "one", hit: hits[0] };
  if (
    hits.length === 2 &&
    hits.some((hit) => hit.slice === "device_type") &&
    hits.some((hit) => hit.slice === "acquisition_channel")
  ) {
    return {
      kind: "device_channel",
      device: hits.find((hit) => hit.slice === "device_type") as SliceHit,
      channel: hits.find((hit) => hit.slice === "acquisition_channel") as SliceHit,
    };
  }
  return { kind: "unsupported_cross", hits };
}

function sliceExists(slice: string, value: string): boolean {
  return snapshot.product_metrics.some((row) => row.slice_name === slice && row.slice_value === value);
}

function refuse(intent: string, paragraph: string): AskAnswer {
  return {
    status: "refused",
    intent,
    heading: "Outside the catalog",
    paragraphs: [paragraph],
    table: null,
    sql: null,
    compiledSql: null,
    compiledSqlLabel: null,
  };
}

function refuseUnknownCut(): AskAnswer {
  return refuse(
    "unknown_cut",
    "The question names a cut this catalog does not recognize. Published cuts include device, browser, channel, and returning or new users.",
  );
}

function refuseMissingPair(value: string): AskAnswer {
  const label = value.replace("|", " and ");
  return refuse(
    "missing_pair",
    `device_browser has no published value for ${label}. The pair stays blank.`,
  );
}

function answerDropoff(hit: SliceHit | null): AskAnswer {
  const slice = hit?.slice ?? "overall";
  const value = hit?.value ?? "all";
  const scope = scopeLabel(hit);
  const ranked = snapshot.stages
    .map((stage) => ({ stage, row: metric("step_drop_off_rate", slice, value, stage.stage_name) }))
    .filter((item): item is { stage: StageRow; row: MetricRow } => item.row != null && item.row.metric_value != null)
    .sort(
      (left, right) =>
        (right.row.metric_value ?? 0) - (left.row.metric_value ?? 0) || left.stage.stage_order - right.stage.stage_order,
    );
  if (ranked.length === 0) {
    return refuse("missing_dropoff", "step_drop_off_rate is not published for that slice. No figure is filled in.");
  }

  const byCount = [...ranked].sort(
    (left, right) =>
      (right.row.numerator ?? 0) - (left.row.numerator ?? 0) || left.stage.stage_order - right.stage.stage_order,
  );
  const top = ranked[0];
  const largest = byCount[0];
  const bankIndex = ranked.findIndex((item) => item.stage.stage_name === "bank_connection_started");
  const paragraphs = [
    `On ${scope}, the highest step_drop_off_rate is ${formatPercent(top.row.metric_value)} at ${labelStage(top.stage.stage_name)}. ${formatCount(top.row.numerator)} of ${formatCount(top.row.denominator)} applications that reached that stage did not reach ${nextStageLabel(top.stage)}.`,
  ];
  if (largest.stage.stage_name !== top.stage.stage_name) {
    paragraphs.push(
      `The largest count that does not continue is ${labelStage(largest.stage.stage_name)}: ${formatCount(largest.row.numerator)} of ${formatCount(largest.row.denominator)} (${formatPercent(largest.row.metric_value)}) did not reach ${nextStageLabel(largest.stage)}.`,
    );
  }
  paragraphs.push(
    ranked
      .slice(0, 3)
      .map((item, index) => {
        const rank = ["Highest", "Second", "Third"][index];
        return `${rank}: ${labelStage(item.stage.stage_name)} ${formatPercent(item.row.metric_value)} (${formatCount(item.row.numerator)} of ${formatCount(item.row.denominator)}).`;
      })
      .join(" "),
  );
  if (bankIndex > 2) {
    const bank = ranked[bankIndex];
    paragraphs.push(
      `${labelStage(bank.stage.stage_name)} ranks ${rankWord(bankIndex)} by drop-off rate at ${formatPercent(bank.row.metric_value)} (${formatCount(bank.row.numerator)} of ${formatCount(bank.row.denominator)} did not reach ${nextStageLabel(bank.stage)}).`,
    );
  } else if (bankIndex >= 0) {
    paragraphs.push(
      "Bank connection started is inside that ranking. Its denominator is applications that reached bank connection start.",
    );
  }
  paragraphs.push(
    "Drop-off is one minus step conversion among applications that reached the stage. The export does not label a stage as the cause.",
  );

  return {
    status: "answered",
    intent: "dropoff",
    heading: "Where applicants drop off",
    paragraphs,
    table: {
      caption: `step_drop_off_rate on ${scope}. Reached is the denominator. Did not continue is the numerator.`,
      columns: ["Stage", "Reached", "Did not continue", "Drop-off"],
      rows: snapshot.stages.flatMap((stage) => {
        const row = metric("step_drop_off_rate", slice, value, stage.stage_name);
        if (!row || row.metric_value == null) return [];
        return [[labelStage(stage.stage_name), formatCount(row.denominator), formatCount(row.numerator), formatPercent(row.metric_value)]];
      }),
    },
    sql: metricSelect({ metrics: ["step_drop_off_rate"], slices: [slice], values: [value] }),
    compiledSql: null,
    compiledSqlLabel: null,
  };
}

function answerLongest(): AskAnswer {
  const rows = snapshot.product_metrics
    .filter((row) => row.metric_name === "median_time_to_decision" && row.stage_name == null && row.metric_value != null)
    .sort(
      (left, right) =>
        (right.metric_value ?? 0) - (left.metric_value ?? 0) ||
        left.slice_name.localeCompare(right.slice_name) ||
        left.slice_value.localeCompare(right.slice_value),
    );
  if (rows.length === 0) {
    return refuse("missing_decision_time", "median_time_to_decision is not published. No figure is filled in.");
  }
  const top = rows[0];
  const sameSliceOther = rows.find((row) => row.slice_name === top.slice_name && row.slice_value !== top.slice_value);
  const nextOtherSlice = rows.find((row) => row.slice_name !== top.slice_name);
  const paragraphs = [
    `The longest median_time_to_decision in product_metrics is ${formatMinutes(top.metric_value)} on ${labelSlice(top.slice_name)} · ${labelValue(top.slice_name, top.slice_value)}. Denominator ${formatCount(top.denominator)}. Population: ${top.population}.`,
  ];
  if (sameSliceOther) {
    paragraphs.push(
      `On that same slice, ${labelValue(sameSliceOther.slice_name, sameSliceOther.slice_value)} is ${formatMinutes(sameSliceOther.metric_value)} (denominator ${formatCount(sameSliceOther.denominator)}).`,
    );
  }
  if (nextOtherSlice) {
    paragraphs.push(
      `The longest value on any other slice is ${formatMinutes(nextOtherSlice.metric_value)} on ${labelSlice(nextOtherSlice.slice_name)} · ${labelValue(nextOtherSlice.slice_name, nextOtherSlice.slice_value)} (denominator ${formatCount(nextOtherSlice.denominator)}).`,
    );
  }
  paragraphs.push("The ranking is the published medians. The export does not store a cause.");
  return {
    status: "answered",
    intent: "longest_underwriting",
    heading: "Longest decision time",
    paragraphs,
    table: {
      caption: "Five longest median_time_to_decision values. The select returns every published value, highest first.",
      columns: ["Slice", "Value", "Median", "Denominator"],
      rows: rows.slice(0, 5).map((row) => [
        labelSlice(row.slice_name),
        labelValue(row.slice_name, row.slice_value),
        formatMinutes(row.metric_value),
        formatCount(row.denominator),
      ]),
    },
    sql: `select
    slice_name,
    slice_value,
    metric_value,
    denominator,
    population
from marts.product_metrics
where metric_name = 'median_time_to_decision'
  and stage_name is null
order by metric_value desc`,
    compiledSql: null,
    compiledSqlLabel: null,
  };
}

function answerFundingDecline(): AskAnswer {
  const series = monthSeries();
  if (series.length < 2) {
    return refuse(
      "missing_months",
      "The started_month slice does not have two months of funding conversion. No decline is filled in.",
    );
  }
  let worst = { from: series[0], to: series[1], delta: valueOf(series[1].approvedToFunded) - valueOf(series[0].approvedToFunded) };
  for (let index = 1; index < series.length; index += 1) {
    const delta = valueOf(series[index].approvedToFunded) - valueOf(series[index - 1].approvedToFunded);
    if (delta < worst.delta) worst = { from: series[index - 1], to: series[index], delta };
  }
  const first = series[0];
  const last = series[series.length - 1];
  const paragraphs = [
    "The export can show how funding conversion moved. It does not store a cause, so this answer does not add one.",
    `Approved-to-funded conversion is approved_to_funded_rate, funded divided by approved. From ${first.label} to ${last.label} it moves from ${formatPercent(first.approvedToFunded.metric_value)} to ${formatPercent(last.approvedToFunded.metric_value)}.`,
  ];
  if (worst.delta < 0) {
    paragraphs.push(
      `The largest month-to-month drop is ${worst.from.label} to ${worst.to.label}: ${formatPercent(worst.from.approvedToFunded.metric_value)} to ${formatPercent(worst.to.approvedToFunded.metric_value)} (${formatSignedPp(worst.delta * 100)}).`,
    );
    paragraphs.push(
      `On that same step, approved_to_contracted_rate moves from ${formatPercent(worst.from.approvedToContracted.metric_value)} to ${formatPercent(worst.to.approvedToContracted.metric_value)}, and contracted_to_funded_rate moves from ${formatPercent(worst.from.contractedToFunded.metric_value)} to ${formatPercent(worst.to.contractedToFunded.metric_value)}. Those are the published component rates, not a reason code.`,
    );
  } else {
    paragraphs.push("approved_to_funded_rate does not fall between consecutive months in this window.");
  }
  paragraphs.push(
    `Approval rate moves from ${formatPercent(first.approval.metric_value)} in ${first.label} to ${formatPercent(last.approval.metric_value)} in ${last.label}. Funding rate, funded divided by started, moves from ${formatPercent(first.funding.metric_value)} to ${formatPercent(last.funding.metric_value)}.`,
  );
  const cited = series.flatMap((point) => [point.approval, point.funding, point.approvedToFunded, point.approvedToContracted, point.contractedToFunded]);
  return {
    status: "answered",
    intent: "funding_decline",
    heading: "Funding conversion by start month",
    paragraphs,
    table: {
      caption: "started_month rows used above. Funding rate is funded / started. Approved to funded is funded / approved.",
      columns: ["Month", "Metric", "Value", "Numerator", "Denominator"],
      rows: cited.map((row) => [
        labelValue(row.slice_name, row.slice_value),
        labelMetric(row.metric_name),
        formatMetric(row.metric_value, row.unit),
        formatCount(row.numerator),
        formatCount(row.denominator),
      ]),
    },
    sql: metricSelect({
      metrics: [
        "approval_rate",
        "funding_rate",
        "approved_to_funded_rate",
        "approved_to_contracted_rate",
        "contracted_to_funded_rate",
      ],
      slices: ["started_month"],
    }),
    compiledSql: null,
    compiledSqlLabel: null,
  };
}

function answerManual(): AskAnswer {
  const manual = metric("median_time_to_decision", "underwriting_path", "manual");
  const auto = metric("median_time_to_decision", "underwriting_path", "auto");
  const manualCount = metric("decided_applications", "underwriting_path", "manual");
  const autoCount = metric("decided_applications", "underwriting_path", "auto");
  const share = metric("manual_review_rate", "overall", "all");
  if (!manual || !auto || manual.metric_value == null || auto.metric_value == null || !share || share.metric_value == null) {
    return refuse("missing_manual", "The underwriting_path comparison is not published. No figure is filled in.");
  }
  return {
    status: "answered",
    intent: "manual_review",
    heading: "Manual review and decision time",
    paragraphs: [
      `median_time_to_decision on the manual path is ${formatMinutes(manual.metric_value)}, denominator ${formatCount(manual.denominator ?? manualCount?.metric_value ?? null)}. On the auto path it is ${formatMinutes(auto.metric_value)}, denominator ${formatCount(auto.denominator ?? autoCount?.metric_value ?? null)}.`,
      `On the portfolio, manual_review_rate is ${formatPercent(share.metric_value)} (${formatCount(share.numerator)} of ${formatCount(share.denominator)}). Population: ${share.population}.`,
      "This is the published comparison of medians. The export does not store a cause. Decision SLA attainment is unshipped, so this answer does not compute an attainment percent.",
    ],
    table: {
      caption: "underwriting_path medians, plus the portfolio manual review share.",
      columns: ["Slice", "Value", "Metric", "Value published", "Denominator"],
      rows: [manual, auto, share].map((row) => [
        labelSlice(row.slice_name),
        labelValue(row.slice_name, row.slice_value),
        labelMetric(row.metric_name),
        formatMetric(row.metric_value, row.unit),
        formatCount(row.denominator),
      ]),
    },
    sql: `select
    metric_name,
    slice_name,
    slice_value,
    metric_value,
    numerator,
    denominator,
    unit,
    population
from marts.product_metrics
where (
    metric_name = 'median_time_to_decision'
    and slice_name = 'underwriting_path'
    and slice_value in ('manual', 'auto')
  )
  or (
    metric_name = 'manual_review_rate'
    and slice_name = 'overall'
    and slice_value = 'all'
  )`,
    compiledSql: null,
    compiledSqlLabel: null,
  };
}

function answerExperiment(): AskAnswer {
  const primary = primaryExperiment();
  const rows = experimentRows();
  const guardrails = rows.filter((row) => row.metric_role === "guardrail");
  const paragraphs = [
    `${snapshot.source?.experiment_name ?? "bank_connection_clarity"} compares treatment with control. The primary metric is ${primary.metric_name}. The population is ${primary.population}. Applications that never start bank connection are outside this metric.`,
    `Control is ${formatMetric(primary.control_value, primary.unit)} (${formatCount(primary.conversions_control)} / ${formatCount(primary.n_control)}). Treatment is ${formatMetric(primary.treatment_value, primary.unit)} (${formatCount(primary.conversions_treatment)} / ${formatCount(primary.n_treatment)}). Absolute difference is ${formatDifference(primary)}. Relative uplift is ${formatSignedPercent(primary.relative_uplift)}. The 95% interval is ${formatInterval(primary)}. p-value is ${formatP(primary.p_value)}. null_rejected_at_alpha is ${yesNo(primary.null_rejected_at_alpha)} at alpha ${primary.alpha}. The test is ${primary.test_method.replaceAll("_", " ")}. The interval method is ${primary.interval_method.replaceAll("_", " ")}.`,
    `Assigned control ${formatCount(primary.n_assigned_control)}, assigned treatment ${formatCount(primary.n_assigned_treatment)}. Assigned and outside the primary population: control ${formatCount(primary.n_assigned_outside_population_control)}, treatment ${formatCount(primary.n_assigned_outside_population_treatment)}.`,
  ];
  if (guardrails.length > 0) {
    paragraphs.push(
      `Guardrails on the assigned comparison: ${guardrails
        .map((row) => `${labelMetric(row.metric_name)} ${formatDifference(row)} (null rejected: ${yesNo(row.null_rejected_at_alpha)})`)
        .join("; ")}. There is no pass or fail flag. The margin is unset.`,
    );
  }
  paragraphs.push(
    `product_decision is ${snapshot.product_decision ?? "null"}. This answer does not select Ship, Iterate, or Do not ship.`,
  );
  return {
    status: "answered",
    intent: "experiment",
    heading: "Bank-connection experiment",
    paragraphs,
    table: {
      caption: "fct_experiment_results. The primary population is applications that start bank connection.",
      columns: EXPERIMENT_COLUMNS,
      rows: rows.map(experimentCells),
    },
    sql: EXPERIMENT_SQL,
    compiledSql: snapshot.experiment_sql,
    compiledSqlLabel: "Compiled SQL for fct_experiment_results",
  };
}

function answerGuardrails(): AskAnswer {
  const rows = experimentRows().filter((row) => row.metric_role === "guardrail");
  if (rows.length === 0) {
    return refuse("missing_guardrail", "fct_experiment_results has no guardrail rows. No figure is filled in.");
  }
  const paragraphs = [
    "Guardrails use the same estimate and interval as the primary metric. They are not a success criterion. The export has no pass or fail flag and no numeric margin for approximately unchanged.",
  ];
  for (const row of rows) {
    paragraphs.push(
      `${labelMetric(row.metric_name)} (${row.population}): control ${formatMetric(row.control_value, row.unit)}, treatment ${formatMetric(row.treatment_value, row.unit)}, difference ${formatDifference(row)}, 95% interval ${formatInterval(row)}, p-value ${formatP(row.p_value)}, null_rejected_at_alpha ${yesNo(row.null_rejected_at_alpha)}.`,
    );
  }
  if (rows.some((row) => row.metric_name === "median_time_to_submit")) {
    paragraphs.push("median_time_to_submit is conditional on submitting. A rejected null is the alpha test. It is not a ship label.");
  }
  return {
    status: "answered",
    intent: "guardrails",
    heading: "Experiment guardrails",
    paragraphs,
    table: {
      caption: "Guardrail rows from fct_experiment_results.",
      columns: EXPERIMENT_COLUMNS,
      rows: rows.map(experimentCells),
    },
    sql: EXPERIMENT_GUARDRAIL_SQL,
    compiledSql: snapshot.experiment_sql,
    compiledSqlLabel: "Compiled SQL for fct_experiment_results",
  };
}

function answerGrain(): AskAnswer {
  const completion = metric("bank_connection_completion_rate", "overall", "all");
  const start = metric("bank_connection_start_rate", "overall", "all");
  const primary = primaryExperiment();
  if (!completion || completion.metric_value == null || !start || start.metric_value == null) {
    return refuse("missing_grain", "The bank-connection rates are not on the portfolio slice. No figure is filled in.");
  }
  return {
    status: "answered",
    intent: "grain",
    heading: "Bank-connection denominator",
    paragraphs: [
      `The primary metric is ${snapshot.primary_metric}. The population on the export is ${snapshot.primary_population}.`,
      `On the portfolio, bank_connection_completion_rate is ${formatPercent(completion.metric_value)} (${formatCount(completion.numerator)} / ${formatCount(completion.denominator)}). Population: ${completion.population}.`,
      `bank_connection_start_rate is a different metric: ${formatPercent(start.metric_value)} (${formatCount(start.numerator)} / ${formatCount(start.denominator)}). Population: ${start.population}.`,
      `The experiment primary row uses the completion population. Control denominator ${formatCount(primary.n_control)}, treatment denominator ${formatCount(primary.n_treatment)}. Assigned and outside that population: control ${formatCount(primary.n_assigned_outside_population_control)}, treatment ${formatCount(primary.n_assigned_outside_population_treatment)}.`,
    ],
    table: {
      caption: "Portfolio rates, then the experiment primary denominators.",
      columns: ["Source", "Metric", "Group", "Numerator", "Denominator", "Value"],
      rows: [
        [
          "product_metrics",
          labelMetric(completion.metric_name),
          "Portfolio",
          formatCount(completion.numerator),
          formatCount(completion.denominator),
          formatPercent(completion.metric_value),
        ],
        [
          "product_metrics",
          labelMetric(start.metric_name),
          "Portfolio",
          formatCount(start.numerator),
          formatCount(start.denominator),
          formatPercent(start.metric_value),
        ],
        [
          "fct_experiment_results",
          labelMetric(primary.metric_name),
          "Control",
          formatCount(primary.conversions_control),
          formatCount(primary.n_control),
          formatMetric(primary.control_value, primary.unit),
        ],
        [
          "fct_experiment_results",
          labelMetric(primary.metric_name),
          "Treatment",
          formatCount(primary.conversions_treatment),
          formatCount(primary.n_treatment),
          formatMetric(primary.treatment_value, primary.unit),
        ],
      ],
    },
    sql: `${metricSelect({
      metrics: ["bank_connection_completion_rate", "bank_connection_start_rate"],
      slices: ["overall"],
      values: ["all"],
    })}

select
    metric_name,
    population,
    n_control,
    n_treatment,
    conversions_control,
    conversions_treatment,
    n_assigned_outside_population_control,
    n_assigned_outside_population_treatment,
    control_value,
    treatment_value
from marts.fct_experiment_results
where metric_name = 'bank_connection_completion_rate'`,
    compiledSql: null,
    compiledSqlLabel: null,
  };
}

function answerDeviceChannel(q: string, device: SliceHit, channel: SliceHit): AskAnswer {
  const alias = matchMetricAlias(q);
  const wantsFunnel = !alias || has(q, "funnel") || has(q, "drop") || has(q, "stage");
  const deviceLabel = `${labelSlice(device.slice)} · ${labelValue(device.slice, device.value)}`;
  const channelLabel = `${labelSlice(channel.slice)} · ${labelValue(channel.slice, channel.value)}`;
  const paragraphs = [
    `product_metrics keeps ${labelSlice(device.slice)} and ${labelSlice(channel.slice)} as separate slices. There is no combined row. The figures below are ${deviceLabel} and ${channelLabel} on their own. Neither figure is the intersection.`,
  ];
  if (channel.value === "paid_search") {
    paragraphs.push("Paid search is present as acquisition_channel = paid_search.");
  }
  const tableRows: string[][] = [];
  if (alias) {
    const deviceRow = metric(alias, device.slice, device.value);
    const channelRow = metric(alias, channel.slice, channel.value);
    if (deviceRow?.metric_value == null || channelRow?.metric_value == null) {
      return refuse("missing_cross_metric", "That metric is not published on both slices. The intersection stays blank.");
    }
    paragraphs.push(
      `${labelMetric(alias)} on ${deviceLabel} is ${formatMetric(deviceRow.metric_value, deviceRow.unit)} (${formatCount(deviceRow.numerator)} / ${formatCount(deviceRow.denominator)}). On ${channelLabel} it is ${formatMetric(channelRow.metric_value, channelRow.unit)} (${formatCount(channelRow.numerator)} / ${formatCount(channelRow.denominator)}).`,
    );
    tableRows.push(
      [deviceLabel, labelMetric(alias), formatCount(deviceRow.denominator), formatCount(deviceRow.numerator), formatMetric(deviceRow.metric_value, deviceRow.unit)],
      [channelLabel, labelMetric(alias), formatCount(channelRow.denominator), formatCount(channelRow.numerator), formatMetric(channelRow.metric_value, channelRow.unit)],
    );
  }
  if (wantsFunnel) {
    for (const hit of [device, channel]) {
      const ranked = dropoffRanked(hit.slice, hit.value);
      const started = metric("applications_started", hit.slice, hit.value);
      const label = `${labelSlice(hit.slice)} · ${labelValue(hit.slice, hit.value)}`;
      if (ranked.length === 0 || started?.metric_value == null) {
        paragraphs.push(`${label} does not have a published step_drop_off_rate series.`);
        continue;
      }
      const top = ranked[0];
      paragraphs.push(
        `${label} starts at ${formatCount(started.metric_value)}. The highest step_drop_off_rate is ${formatPercent(top.row.metric_value)} at ${labelStage(top.stage.stage_name)} (${formatCount(top.row.numerator)} of ${formatCount(top.row.denominator)}).`,
      );
      for (const item of ranked) {
        tableRows.push([
          label,
          labelStage(item.stage.stage_name),
          formatCount(item.row.denominator),
          formatCount(item.row.numerator),
          formatPercent(item.row.metric_value),
        ]);
      }
    }
  }
  if (tableRows.length === 0) {
    return refuse("missing_cross", "Those slices do not publish the requested rows. The intersection stays blank.");
  }
  return {
    status: "answered",
    intent: "device_channel",
    heading: "Two slices, not an intersection",
    paragraphs,
    table: {
      caption: "Each row is one published slice. Do not multiply or overlap these rates.",
      columns: ["Slice", "Stage or metric", "Reached or denominator", "Numerator", "Rate"],
      rows: tableRows,
    },
    sql: metricSelect({
      metrics: wantsFunnel ? ["step_drop_off_rate", "applications_started", ...(alias ? [alias] : [])] : [alias as string],
      slices: [device.slice, channel.slice],
      values: [device.value, channel.value],
    }),
    compiledSql: null,
    compiledSqlLabel: null,
  };
}

function answerMetric(name: string, hit: SliceHit | null): AskAnswer {
  const slice = hit?.slice ?? "overall";
  const value = hit?.value ?? "all";
  const row = metric(name, slice, value);
  if (!row || row.metric_value == null) {
    return refuse("missing_metric", "That metric is not published for the requested slice. No figure is filled in.");
  }
  const fraction =
    row.numerator != null && row.denominator != null
      ? ` ${formatCount(row.numerator)} / ${formatCount(row.denominator)}.`
      : row.denominator != null
        ? ` Denominator ${formatCount(row.denominator)}.`
        : "";
  return {
    status: "answered",
    intent: "metric",
    heading: labelMetric(name),
    paragraphs: [
      `${labelMetric(name)} on ${scopeLabel(hit)} is ${formatMetric(row.metric_value, row.unit)}.${fraction} Population: ${row.population}.`,
    ],
    table: {
      caption: "The product_metrics row for this answer.",
      columns: ["Metric", "Slice", "Value", "Published", "Numerator", "Denominator"],
      rows: [[
        labelMetric(row.metric_name),
        labelSlice(row.slice_name),
        labelValue(row.slice_name, row.slice_value),
        formatMetric(row.metric_value, row.unit),
        formatCount(row.numerator),
        formatCount(row.denominator),
      ]],
    },
    sql: metricSelect({ metrics: [name], slices: [slice], values: [value] }),
    compiledSql: null,
    compiledSqlLabel: null,
  };
}

function answerFunding(hit: SliceHit | null): AskAnswer {
  const slice = hit?.slice ?? "overall";
  const value = hit?.value ?? "all";
  const names = [
    "applications_started",
    "approval_rate",
    "funding_rate",
    "approved_to_funded_rate",
    "approved_to_contracted_rate",
    "contracted_to_funded_rate",
    "median_time_to_funding",
    "median_funding_duration_hours",
  ];
  const rows = names
    .map((name) => metric(name, slice, value))
    .filter((row): row is MetricRow => row != null && row.metric_value != null);
  if (rows.length === 0) {
    return refuse("missing_funding", "Funding metrics are not published for that slice. No figure is filled in.");
  }
  const funding = rows.find((row) => row.metric_name === "funding_rate");
  const approval = rows.find((row) => row.metric_name === "approval_rate");
  const approvedToFunded = rows.find((row) => row.metric_name === "approved_to_funded_rate");
  const paragraphs: string[] = [];
  if (funding && approval && approvedToFunded) {
    paragraphs.push(
      `On ${scopeLabel(hit)}, approval rate is ${formatPercent(approval.metric_value)} (${formatCount(approval.numerator)} / ${formatCount(approval.denominator)}). Funding rate, funded divided by started, is ${formatPercent(funding.metric_value)} (${formatCount(funding.numerator)} / ${formatCount(funding.denominator)}). Approved to funded is ${formatPercent(approvedToFunded.metric_value)} (${formatCount(approvedToFunded.numerator)} / ${formatCount(approvedToFunded.denominator)}).`,
    );
  }
  if (!hit) {
    const series = monthSeries();
    if (series.length >= 2) {
      const first = series[0];
      const peak = series.reduce((best, point) =>
        valueOf(point.approval) > valueOf(best.approval) ? point : best,
      );
      paragraphs.push(
        peak.value === first.value
          ? `On started_month, the highest approval rate is ${formatPercent(peak.approval.metric_value)} in ${peak.label}. Funding rate that month is ${formatPercent(peak.funding.metric_value)}. Approved to funded is ${formatPercent(peak.approvedToFunded.metric_value)}.`
          : `On started_month, approval rate is ${formatPercent(first.approval.metric_value)} in ${first.label} and ${formatPercent(peak.approval.metric_value)} in ${peak.label}, the highest approval month. Funding rate in ${peak.label} is ${formatPercent(peak.funding.metric_value)}. Approved to funded in ${peak.label} is ${formatPercent(peak.approvedToFunded.metric_value)}. In ${first.label}, funding rate is ${formatPercent(first.funding.metric_value)} and approved to funded is ${formatPercent(first.approvedToFunded.metric_value)}.`,
      );
    }
  } else {
    paragraphs.push("The started_month trend is a portfolio slice. It is not crossed with this cut, so it is omitted here.");
  }
  paragraphs.push("Approval is not the funding result. The export does not store a cause for the gap.");
  return {
    status: "answered",
    intent: "funding",
    heading: "Approval and funding",
    paragraphs,
    table: {
      caption: `Funding metrics on ${scopeLabel(hit)}.`,
      columns: ["Metric", "Published", "Numerator", "Denominator", "Population"],
      rows: rows.map((row) => [
        labelMetric(row.metric_name),
        formatMetric(row.metric_value, row.unit),
        formatCount(row.numerator),
        formatCount(row.denominator),
        row.population,
      ]),
    },
    sql: metricSelect({ metrics: names, slices: [slice], values: [value] }),
    compiledSql: null,
    compiledSqlLabel: null,
  };
}

function answerBank(hit: SliceHit | null): AskAnswer {
  const slice = hit?.slice ?? "overall";
  const value = hit?.value ?? "all";
  const names = ["bank_connection_completion_rate", "bank_connection_start_rate", "bank_connection_failure_incidence"];
  const rows = names
    .map((name) => metric(name, slice, value))
    .filter((row): row is MetricRow => row != null && row.metric_value != null);
  if (rows.length === 0) {
    return refuse("missing_bank", "Bank-connection metrics are not published for that slice. No figure is filled in.");
  }
  const paragraphs = rows.map(
    (row) =>
      `${labelMetric(row.metric_name)} on ${scopeLabel(hit)} is ${formatMetric(row.metric_value, row.unit)} (${formatCount(row.numerator)} / ${formatCount(row.denominator)}). Population: ${row.population}.`,
  );
  paragraphs.push(
    "Completion counts applications that reach bank connected among applications that start bank connection. Start rate uses a different denominator. A failure event does not cancel completion.",
  );
  return {
    status: "answered",
    intent: "bank",
    heading: "Bank connection",
    paragraphs,
    table: {
      caption: `Bank-connection metrics on ${scopeLabel(hit)}.`,
      columns: ["Metric", "Published", "Numerator", "Denominator", "Population"],
      rows: rows.map((row) => [
        labelMetric(row.metric_name),
        formatMetric(row.metric_value, row.unit),
        formatCount(row.numerator),
        formatCount(row.denominator),
        row.population,
      ]),
    },
    sql: metricSelect({ metrics: names, slices: [slice], values: [value] }),
    compiledSql: null,
    compiledSqlLabel: null,
  };
}

function answerSla(): AskAnswer {
  return {
    status: "answered",
    intent: "sla",
    heading: "SLA attainment",
    paragraphs: [
      `sla_attainment on the export is ${snapshot.sla_attainment}. Decision and funding SLA limits are unset, so this catalog does not compute an attainment percent.`,
    ],
    table: null,
    sql: null,
    compiledSql: null,
    compiledSqlLabel: null,
  };
}

function answerShip(): AskAnswer {
  const primary = primaryExperiment();
  return {
    status: "answered",
    intent: "ship",
    heading: "Ship, iterate, or do not ship",
    paragraphs: [
      `product_decision is ${snapshot.product_decision ?? "null"}. This catalog leaves Ship, Iterate, and Do not ship unselected while that field is null.`,
      `The primary statistical result remains on the export. ${labelMetric(primary.metric_name)} absolute difference is ${formatDifference(primary)}. The 95% interval is ${formatInterval(primary)}. null_rejected_at_alpha is ${yesNo(primary.null_rejected_at_alpha)}. That test is not a ship label.`,
      "Guardrail rows have no pass or fail flag. The margin for approximately unchanged is unset.",
    ],
    table: {
      caption: "fct_experiment_results. No row selects a ship label.",
      columns: EXPERIMENT_COLUMNS,
      rows: experimentRows().map(experimentCells),
    },
    sql: EXPERIMENT_SQL,
    compiledSql: snapshot.experiment_sql,
    compiledSqlLabel: "Compiled SQL for fct_experiment_results",
  };
}

function monthSeries(): {
  value: string;
  label: string;
  approval: MetricRow;
  funding: MetricRow;
  approvedToFunded: MetricRow;
  approvedToContracted: MetricRow;
  contractedToFunded: MetricRow;
}[] {
  const values = [
    ...new Set(
      snapshot.product_metrics
        .filter((row) => row.slice_name === "started_month" && row.metric_name === "approval_rate")
        .map((row) => row.slice_value),
    ),
  ].sort();
  return values.flatMap((value) => {
    const approval = metric("approval_rate", "started_month", value);
    const funding = metric("funding_rate", "started_month", value);
    const approvedToFunded = metric("approved_to_funded_rate", "started_month", value);
    const approvedToContracted = metric("approved_to_contracted_rate", "started_month", value);
    const contractedToFunded = metric("contracted_to_funded_rate", "started_month", value);
    if (!approval || !funding || !approvedToFunded || !approvedToContracted || !contractedToFunded) return [];
    if ([approval, funding, approvedToFunded, approvedToContracted, contractedToFunded].some((row) => row.metric_value == null)) {
      return [];
    }
    return [{
      value,
      label: labelValue("started_month", value),
      approval,
      funding,
      approvedToFunded,
      approvedToContracted,
      contractedToFunded,
    }];
  });
}

function dropoffRanked(slice: string, value: string): { stage: StageRow; row: MetricRow }[] {
  return snapshot.stages
    .map((stage) => ({ stage, row: metric("step_drop_off_rate", slice, value, stage.stage_name) }))
    .filter((item): item is { stage: StageRow; row: MetricRow } => item.row != null && item.row.metric_value != null)
    .sort(
      (left, right) =>
        (right.row.metric_value ?? 0) - (left.row.metric_value ?? 0) || left.stage.stage_order - right.stage.stage_order,
    );
}

function experimentCells(row: ExperimentRow): string[] {
  return [
    labelMetric(row.metric_name),
    row.metric_role,
    formatMetric(row.control_value, row.unit),
    formatMetric(row.treatment_value, row.unit),
    formatDifference(row),
    formatInterval(row),
    formatP(row.p_value),
    yesNo(row.null_rejected_at_alpha),
  ];
}

function metricSelect(options: { metrics: string[]; slices: string[]; values?: string[] }): string {
  const metrics = unique(options.metrics).map(sqlString).join(", ");
  const slices = unique(options.slices).map(sqlString).join(", ");
  const lines = [
    "select",
    "    metric_name,",
    "    stage_name,",
    "    slice_name,",
    "    slice_value,",
    "    numerator,",
    "    denominator,",
    "    metric_value,",
    "    unit,",
    "    population",
    "from marts.product_metrics",
    `where metric_name in (${metrics})`,
    `  and slice_name in (${slices})`,
  ];
  if (options.values && options.values.length > 0) {
    lines.push(`  and slice_value in (${unique(options.values).map(sqlString).join(", ")})`);
  }
  lines.push("order by slice_name, slice_value, stage_name, metric_name");
  return lines.join("\n");
}

function sqlString(value: string): string {
  if (!/^[A-Za-z0-9_|.-]+$/.test(value)) {
    throw new Error("Slice value is not a published token");
  }
  return `'${value}'`;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function scopeLabel(hit: SliceHit | null): string {
  if (!hit) return "the portfolio";
  return `${labelSlice(hit.slice)} · ${labelValue(hit.slice, hit.value)}`;
}

function nextStageLabel(stage: StageRow): string {
  if (!stage.next_stage_name) return "a later stage";
  return labelStage(stage.next_stage_name);
}

function rankWord(index: number): string {
  return ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"][index] ?? "later";
}

function valueOf(row: MetricRow): number {
  return row.metric_value ?? 0;
}

function yesNo(value: boolean | null): string {
  if (value == null) return "null";
  return value ? "yes" : "no";
}
