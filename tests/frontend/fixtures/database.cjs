/** Isolated browser-test database. Loaded ONLY by the test launcher via NODE_OPTIONS. */
const date = new Date("2026-01-15T12:00:00Z");
const rawText =
  "FlowAI founder meeting notes.\nThe company builds AI workflow automation.\nRetention needs more evidence.\n";
const companies = Array.from({ length: 27 }, (_, index) => ({
  id: index === 0 ? "fixture-flowai" : `fixture-company-${index}`,
  name:
    index === 0
      ? "FlowAI"
      : index === 1
        ? "VeryLongUnbrokenCompanyIdentifier".repeat(9)
        : `Fixture Company ${String(index).padStart(2, "0")}`,
  sector:
    index === 0
      ? "SaaS (AI workflow automation)"
      : index === 2
        ? null
        : "Developer Tools",
  stage: index === 2 ? null : index % 2 ? "seed" : "Seed",
  decision: index === 0 ? "Tracking" : index === 2 ? null : "Passed",
  oneLiner: "Fictional company used only for repeatable frontend tests.",
  problem: index === 2 ? null : "Teams need reliable workflows.",
  solution: "Workflow automation.",
  businessModel: null,
  market: null,
  traction: null,
  competition: null,
  founders: [],
  strengths: ["A recorded strength."],
  risks: ["A recorded risk."],
  concerns: [],
  decisionReason: "More evidence is needed.",
  firstMetAt: date,
  lastMetAt: date,
  createdAt: date,
  updatedAt: date,
  _count: { documents: index === 0 ? 1 : 0 },
}));
const documents = [
  {
    id: "fixture-document",
    companyId: "fixture-flowai",
    filename: "flowai-notes.txt",
    fileType: "txt",
    docType: "notes",
    rawText,
    createdAt: date,
    intelligence: null,
    company: { id: companies[0].id, name: companies[0].name },
  },
];
function matches(row, where = {}) {
  if (where.AND && !where.AND.every((clause) => matches(row, clause)))
    return false;
  if (where.OR && !where.OR.some((clause) => matches(row, clause)))
    return false;
  return Object.entries(where)
    .filter(([key]) => !["AND", "OR"].includes(key))
    .every(([key, condition]) => {
      const value = row[key];
      if (condition && typeof condition === "object") {
        const left =
          condition.mode === "insensitive"
            ? String(value ?? "").toLowerCase()
            : value;
        if ("equals" in condition)
          return (
            left ===
            (condition.mode === "insensitive"
              ? String(condition.equals).toLowerCase()
              : condition.equals)
          );
        if ("contains" in condition)
          return String(left ?? "").includes(
            condition.mode === "insensitive"
              ? condition.contains.toLowerCase()
              : condition.contains,
          );
        if ("in" in condition) return condition.in.includes(value);
        return false;
      }
      return value === condition;
    });
}
function findMany(rows, args = {}) {
  const filtered = rows.filter((row) => matches(row, args.where));
  const orders = Array.isArray(args.orderBy)
    ? args.orderBy
    : args.orderBy
      ? [args.orderBy]
      : [];
  filtered.sort((a, b) => {
    for (const order of orders)
      for (const [key, direction] of Object.entries(order)) {
        const comparison = String(a[key] ?? "").localeCompare(
          String(b[key] ?? ""),
        );
        if (comparison)
          return (typeof direction === "object"
            ? direction.sort
            : direction) === "desc"
            ? -comparison
            : comparison;
      }
    return 0;
  });
  return filtered.slice(
    args.skip ?? 0,
    (args.skip ?? 0) + (args.take ?? filtered.length),
  );
}
const reads = {
  company: {
    count: async (args = {}) =>
      companies.filter((row) => matches(row, args.where)).length,
    findMany: async (args) => findMany(companies, args),
    findUnique: async (args) => {
      if (args.where?.id === "fixture-db-error")
        throw new Error("Fixture database read unavailable");
      const row = companies.find((row) => matches(row, args.where));
      return row
        ? {
            ...row,
            documents: documents.filter((doc) => doc.companyId === row.id),
          }
        : null;
    },
    groupBy: async ({ by }) => {
      const groups = new Map();
      for (const row of companies) {
        const key = row[by[0]];
        const item = groups.get(key) ?? { [by[0]]: key, _count: { _all: 0 } };
        item._count._all++;
        groups.set(key, item);
      }
      return [...groups.values()];
    },
  },
  document: {
    count: async () => documents.length,
    findMany: async (args) => findMany(documents, args),
    findFirst: async (args) =>
      documents.find((row) => matches(row, args.where)) ?? null,
  },
};
// Fail closed: any unintended ingestion or provider-related query must fail the test.
for (const key of Object.keys(reads))
  reads[key] = new Proxy(reads[key], {
    get(target, property) {
      if (property in target) return target[property];
      return () => {
        throw new Error(`Frontend fixture forbids ${key}.${String(property)}`);
      };
    },
  });
globalThis.prisma = reads;
