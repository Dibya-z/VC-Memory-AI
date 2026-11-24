/** URL and source-location contracts shared by company discovery and readers. */
export const UNRECORDED_FILTER = "__unrecorded__";
export const COMPANY_PAGE_SIZE = 24;
export const COMPANY_SORTS = ["recent", "name-asc", "name-desc"] as const;
export type CompanySort = (typeof COMPANY_SORTS)[number];
export interface CompanyFiltersValue {
  q?: string;
  sector?: string;
  decision?: string;
  stage?: string;
  sort?: CompanySort;
}
export interface CompanyDirectoryOptions extends CompanyFiltersValue {
  page?: number;
}
export interface CompanyFacet {
  value: string;
  label: string;
}
export interface CompanyFacets {
  sectors: CompanyFacet[];
  decisions: CompanyFacet[];
  stages: CompanyFacet[];
}

type SearchValues = Record<string, string | string[] | undefined>;
function single(
  value: string | string[] | undefined,
  limit: number,
): string | undefined {
  return typeof value === "string"
    ? value.trim().slice(0, limit) || undefined
    : undefined;
}
export function parseCompanyDirectoryParams(
  values: SearchValues,
): CompanyDirectoryOptions {
  const sort = COMPANY_SORTS.includes(values.sort as CompanySort)
    ? (values.sort as CompanySort)
    : "recent";
  const rawPage =
    typeof values.page === "string" && /^\d+$/.test(values.page)
      ? Number(values.page)
      : 1;
  return {
    q: single(values.q, 100),
    sector: single(values.sector, 200),
    decision: single(values.decision, 100),
    stage: single(values.stage, 200),
    sort,
    page:
      Number.isSafeInteger(rawPage) && rawPage > 0
        ? Math.min(rawPage, 100000)
        : 1,
  };
}
export function companyDirectoryHref(filters: CompanyDirectoryOptions): string {
  const params = new URLSearchParams();
  for (const key of ["q", "sector", "decision", "stage"] as const) {
    if (filters[key]) params.set(key, filters[key]!);
  }
  if (filters.sort && filters.sort !== "recent")
    params.set("sort", filters.sort);
  if (filters.page && filters.page > 1)
    params.set("page", String(filters.page));
  const query = params.toString();
  return query ? `/companies?${query}` : "/companies";
}
/** Source offsets use the retained raw text, zero-based and end-exclusive. */
export function parseSourceLocation(
  start: string | string[] | undefined,
  end: string | string[] | undefined,
  textLength: number,
): { start: number; end: number } | null {
  if (
    typeof start !== "string" ||
    typeof end !== "string" ||
    !/^\d+$/.test(start) ||
    !/^\d+$/.test(end)
  )
    return null;
  const from = Number(start),
    to = Number(end);
  return Number.isSafeInteger(from) &&
    Number.isSafeInteger(to) &&
    from >= 0 &&
    to > from &&
    to <= textLength
    ? { start: from, end: to }
    : null;
}

/** Bound reader HTML while retaining exact offsets into potentially large text. */
export function sourceTextWindow(
  textLength: number,
  location: { start: number; end: number } | null,
  at?: string | string[],
) {
  const size = 24000;
  const requested =
    typeof at === "string" && /^\d+$/.test(at) ? Number(at) : NaN;
  const preferredStart = Number.isSafeInteger(requested)
    ? requested
    : Math.max(0, (location?.start ?? 0) - 3000);
  const start = Math.max(
    0,
    Math.min(preferredStart, Math.max(0, textLength - 1)),
  );
  const end = Math.min(textLength, start + size);
  const from = location ? Math.max(location.start, start) : 0;
  const to = location ? Math.min(location.end, end) : 0;
  return {
    start,
    end,
    highlight: location && to > from ? { start: from, end: to } : null,
  };
}

/** Keep incomplete records in totals and combine equivalent casing without writes. */
export function mergeCompanyGroups(
  groups: { value: string | null; count: number }[],
) {
  const result = new Map<string, { value: string; count: number }>();
  for (const group of groups) {
    const value = group.value || "Not recorded";
    const key = value.toLocaleLowerCase("en");
    const existing = result.get(key);
    if (existing) existing.count += group.count;
    else result.set(key, { value, count: group.count });
  }
  return [...result.values()].sort((a, b) => b.count - a.count);
}
