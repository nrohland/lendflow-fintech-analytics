import assert from "node:assert/strict";
import test from "node:test";
import { ASK_EXAMPLES, answerQuestion } from "../src/lib/ask";
import { displayText, snapshot } from "../src/lib/metrics";

test("published metric and population names read as human-facing labels", () => {
  const examples = [
    "The highest step_drop_off_rate is 20.1%.",
    "applications with bank_connection_started",
    "product_metrics keeps device_browser separate from acquisition_channel",
    "product_decision is null; null_rejected_at_alpha is true",
  ];
  for (const example of examples) {
    assert.doesNotMatch(displayText(example), /\b[a-z]+(?:_[a-z0-9]+)+\b/);
  }
  assert.match(displayText(examples[0]), /step drop-off/);
  assert.equal(displayText(examples[1]), "applications that started bank connection");
});

test("published populations and suggested answers contain no raw identifiers in presentation", () => {
  const visible = [
    ...snapshot.product_metrics.map((row) => row.population),
    ...snapshot.experiment_results.map((row) => row.population),
    ...ASK_EXAMPLES.flatMap(({ question }) => {
      const answer = answerQuestion(question);
      return [answer.heading, ...answer.paragraphs, answer.table?.caption ?? "", ...answer.table?.rows.flat() ?? []];
    }),
  ];
  for (const line of visible) {
    assert.doesNotMatch(displayText(line), /\b[a-z]+(?:_[a-z0-9]+)+\b/, line);
  }
});
