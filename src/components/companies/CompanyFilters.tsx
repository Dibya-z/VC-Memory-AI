"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  companyDirectoryHref,
  type CompanyFacets,
  type CompanyFiltersValue,
  type CompanyFacet,
  type CompanySort,
} from "@/lib/company-discovery";
import { Button } from "@/components/ui/Button";

/** Draft all fields locally; one Apply submits one complete, shareable URL. */
export function CompanyFilters(props: {
  current: CompanyFiltersValue;
  facets: CompanyFacets;
}) {
  return (
    <CompanyFilterForm key={companyDirectoryHref(props.current)} {...props} />
  );
}

function CompanyFilterForm({
  current,
  facets,
}: {
  current: CompanyFiltersValue;
  facets: CompanyFacets;
}) {
  const router = useRouter();
  const id = useId();
  const [draft, setDraft] = useState(current);
  const [pending, startTransition] = useTransition();

  function navigate(next: CompanyFiltersValue) {
    startTransition(() =>
      router.push(companyDirectoryHref(next), { scroll: false }),
    );
  }
  function selectValue(value: string | undefined, options: CompanyFacet[]) {
    return (
      options.find(
        (option) =>
          option.value.toLocaleLowerCase("en") ===
          value?.toLocaleLowerCase("en"),
      )?.value ??
      value ??
      ""
    );
  }
  function facetOptions(options: CompanyFacet[], value?: string) {
    return value &&
      !options.some(
        (option) =>
          option.value.toLocaleLowerCase("en") ===
          value.toLocaleLowerCase("en"),
      )
      ? [...options, { value, label: `${value} (not currently recorded)` }]
      : options;
  }
  return (
    <form
      action="/companies"
      onSubmit={(event) => {
        event.preventDefault();
        navigate(draft);
      }}
      aria-label="Find companies"
      aria-busy={pending}
      className="w-full space-y-4"
    >
      <fieldset
        disabled={pending}
        className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <legend className="sr-only">Company search and filters</legend>
        <label htmlFor={`${id}-q`} className="min-w-0 sm:col-span-2">
          <span className="field-label">Company name</span>
          <input
            id={`${id}-q`}
            type="search"
            name="q"
            value={draft.q ?? ""}
            onChange={(event) =>
              setDraft((value) => ({ ...value, q: event.target.value }))
            }
            maxLength={100}
            placeholder="Search company names"
            className="field-control"
          />
        </label>
        <Select
          id={`${id}-sector`}
          name="sector"
          label="Sector"
          value={selectValue(draft.sector, facets.sectors)}
          options={facetOptions(facets.sectors, draft.sector)}
          onChange={(sector) =>
            setDraft((value) => ({ ...value, sector: sector || undefined }))
          }
        />
        <Select
          id={`${id}-decision`}
          name="decision"
          label="Decision"
          value={selectValue(draft.decision, facets.decisions)}
          options={facetOptions(facets.decisions, draft.decision)}
          onChange={(decision) =>
            setDraft((value) => ({ ...value, decision: decision || undefined }))
          }
        />
        <Select
          id={`${id}-stage`}
          name="stage"
          label="Stage"
          value={selectValue(draft.stage, facets.stages)}
          options={facetOptions(facets.stages, draft.stage)}
          onChange={(stage) =>
            setDraft((value) => ({ ...value, stage: stage || undefined }))
          }
        />
        <label htmlFor={`${id}-sort`} className="min-w-0">
          <span className="field-label">Sort by</span>
          <select
            id={`${id}-sort`}
            name="sort"
            value={draft.sort ?? "recent"}
            onChange={(event) =>
              setDraft((value) => ({
                ...value,
                sort: event.target.value as CompanySort,
              }))
            }
            className="field-control"
          >
            <option value="recent">Recent interaction</option>
            <option value="name-asc">Name: A–Z</option>
            <option value="name-desc">Name: Z–A</option>
          </select>
        </label>
        <div className="flex flex-wrap items-end gap-3 sm:col-span-2">
          <Button type="submit" loading={pending}>
            Apply filters
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setDraft({ sort: "recent" });
              navigate({ sort: "recent" });
            }}
          >
            Clear filters
          </Button>
        </div>
      </fieldset>
      <p
        role="status"
        aria-live="polite"
        className="text-sm text-muted-foreground"
      >
        {pending
          ? "Updating companies…"
          : "Choose your filters, then select Apply filters."}
      </p>
    </form>
  );
}

function Select({
  id,
  name,
  value,
  label,
  options,
  onChange,
}: {
  id: string;
  name: string;
  value: string;
  label: string;
  options: CompanyFacet[];
  onChange: (value: string) => void;
}) {
  return (
    <label htmlFor={id} className="min-w-0">
      <span className="field-label">{label}</span>
      <select
        id={id}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="field-control"
      >
        <option value="">All {label.toLowerCase()}s</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
