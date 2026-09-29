import assert from "node:assert/strict";
import test from "node:test";
import { answerQuestion } from "../src/lib/ask";

test("answers a governed experiment question with its published SQL", () => {
  const answer = answerQuestion("Did the bank-connection experiment improve completion?");
  assert.equal(answer.status, "answered");
  assert.ok(answer.sql?.includes("fct_experiment_results"));
  assert.ok(answer.compiledSql?.length);
  assert.match(answer.paragraphs.join(" "), /guardrail/i);
});

test("refuses questions outside the published catalog", () => {
  assert.equal(answerQuestion("What is the weather today?").status, "refused");
  assert.equal(answerQuestion("Forecast funding next month").status, "refused");
});

test("does not invent a device by channel intersection", () => {
  const answer = answerQuestion("Show the funnel for mobile applicants from paid search.");
  assert.equal(answer.status, "answered");
  assert.match(answer.paragraphs.join(" "), /separate slices/i);
  assert.match(answer.paragraphs.join(" "), /Neither figure is the intersection/i);
});

test("leaves SLA attainment unshipped without defined limits", () => {
  const answer = answerQuestion("What is the decision SLA attainment?");
  assert.equal(answer.status, "answered");
  assert.match(answer.paragraphs.join(" "), /unshipped/i);
});
