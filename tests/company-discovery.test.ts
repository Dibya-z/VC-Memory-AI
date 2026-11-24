import assert from "node:assert/strict";
import test from "node:test";
import {
  companyDirectoryHref,
  parseCompanyDirectoryParams,
  parseSourceLocation,
  sourceTextWindow,
  mergeCompanyGroups,
  UNRECORDED_FILTER,
} from "../src/lib/company-discovery";

test("company filter URLs preserve every applied field, including recorded taxonomy", () => {
  const url = companyDirectoryHref({
    q: "Flow AI",
    sector: "SaaS (AI workflow automation)",
    decision: "Tracking",
    stage: "Seed",
    sort: "name-asc",
    page: 2,
  });
  const params = new URL(url, "https://example.test").searchParams;
  assert.deepEqual(parseCompanyDirectoryParams(Object.fromEntries(params)), {
    q: "Flow AI",
    sector: "SaaS (AI workflow automation)",
    decision: "Tracking",
    stage: "Seed",
    sort: "name-asc",
    page: 2,
  });
});

test("directory params reject duplicate, invalid, oversized and unsafe URL inputs", () => {
  assert.deepEqual(
    parseCompanyDirectoryParams({
      q: ["a", "b"],
      sector: "   ",
      sort: "drop-table",
      page: "-3",
    }),
    {
      q: undefined,
      sector: undefined,
      decision: undefined,
      stage: undefined,
      sort: "recent",
      page: 1,
    },
  );
  assert.equal(
    parseCompanyDirectoryParams({ q: "x".repeat(200) }).q?.length,
    100,
  );
  assert.equal(
    parseCompanyDirectoryParams({ page: "999999999999999999999" }).page,
    1,
  );
  assert.equal(parseCompanyDirectoryParams({ page: "999999" }).page, 100000);
  assert.equal(companyDirectoryHref({ sort: "recent", page: 1 }), "/companies");
  assert.equal(
    new URL(
      companyDirectoryHref({ decision: UNRECORDED_FILTER }),
      "https://example.test",
    ).searchParams.get("decision"),
    UNRECORDED_FILTER,
  );
});

test("reader preserves zero-based, end-exclusive citation offsets into the retained source", () => {
  const source =
    "Intro\nFounders: Ada and Ben.\nRevenue: approximately $9k MRR.";
  const start = source.indexOf("Revenue:"),
    end = source.length;
  const location = parseSourceLocation(
    String(start),
    String(end),
    source.length,
  );
  assert.deepEqual(location, { start, end });
  assert.equal(
    source.slice(location!.start, location!.end),
    "Revenue: approximately $9k MRR.",
  );
  assert.deepEqual(parseSourceLocation("0", "1", source.length), {
    start: 0,
    end: 1,
  });
});

test("reader does not invent or clamp invalid passage spans", () => {
  for (const [start, end] of [
    ["-1", "4"],
    ["4", "4"],
    ["5", "4"],
    ["0.5", "4"],
    ["0", "11"],
    ["1e0", "4"],
    ["999999999999999999", "9999999999999999999"],
  ]) {
    assert.equal(parseSourceLocation(start, end, 10), null);
  }
  assert.equal(parseSourceLocation(undefined, "4", 10), null);
  assert.equal(parseSourceLocation(["0", "1"], "4", 10), null);
});

test("reader windows bound large-document HTML and preserve exact highlight offsets", () => {
  const location = { start: 28000, end: 30000 };
  assert.deepEqual(sourceTextWindow(80000, location), {
    start: 25000,
    end: 49000,
    highlight: location,
  });
  assert.deepEqual(sourceTextWindow(80000, location, "0"), {
    start: 0,
    end: 24000,
    highlight: null,
  });
  assert.deepEqual(sourceTextWindow(80000, { start: 23000, end: 26000 }, "0"), {
    start: 0,
    end: 24000,
    highlight: { start: 23000, end: 24000 },
  });
  assert.deepEqual(sourceTextWindow(50000, null, "48000"), {
    start: 48000,
    end: 50000,
    highlight: null,
  });
  const end = sourceTextWindow(80000, null, "9999999999999999999999");
  assert.equal(end.end - end.start, 24000);
  assert.deepEqual(sourceTextWindow(0, null), {
    start: 0,
    end: 0,
    highlight: null,
  });
});

test("dashboard groups reconcile totals, including incomplete and case-variant records", () => {
  const groups = mergeCompanyGroups([
    { value: "Tracking", count: 1 },
    { value: null, count: 2 },
    { value: "", count: 1 },
    { value: "tracking", count: 3 },
  ]);
  assert.deepEqual(groups, [
    { value: "Tracking", count: 4 },
    { value: "Not recorded", count: 3 },
  ]);
  assert.equal(
    groups.reduce((total, group) => total + group.count, 0),
    7,
  );
});
