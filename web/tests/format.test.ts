import assert from "node:assert/strict";
import test from "node:test";
import { formatPeriod } from "../src/lib/format";

test("source timestamps and date-only cohorts share readable period labels", () => {
  assert.equal(formatPeriod("2025-01-06T00:00:00Z", "started_month"), "Jan 2025");
  assert.equal(formatPeriod("2025-01-06", "started_month"), "Jan 2025");
  assert.equal(formatPeriod("2025-01-06T00:00:00Z", "started_week"), "Jan 6");
});
