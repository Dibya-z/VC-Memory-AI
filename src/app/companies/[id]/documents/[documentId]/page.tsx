import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DateTime } from "@/components/ui/DateTime";
import {
  getCompanyDocument,
  getCompanyDocumentIdentity,
} from "@/lib/db/queries";
import { parseSourceLocation, sourceTextWindow } from "@/lib/company-discovery";

type Params = { id: string; documentId: string };
type SearchParams = {
  start?: string | string[];
  end?: string | string[];
  at?: string | string[];
};
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { id, documentId } = await params;
  const document = await getCompanyDocumentIdentity(id, documentId);
  return {
    title: document?.company
      ? `${document.filename} · ${document.company.name}`
      : "Document not found",
  };
}

export default async function DocumentReaderPage({
  params: paramsPromise,
  searchParams: searchParamsPromise,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const [params, searchParams] = await Promise.all([
    paramsPromise,
    searchParamsPromise,
  ]);
  const document = await getCompanyDocument(params.id, params.documentId);
  if (!document) notFound();
  const location = parseSourceLocation(
    searchParams.start,
    searchParams.end,
    document.rawText.length,
  );
  const window = sourceTextWindow(
    document.rawText.length,
    location,
    searchParams.at,
  );
  const highlight = window.highlight;
  function windowHref(at: number) {
    const query = new URLSearchParams({ at: String(at) });
    if (location) {
      query.set("start", String(location.start));
      query.set("end", String(location.end));
    }
    return `/companies/${params.id}/documents/${params.documentId}?${query}#source-text`;
  }
  const requestedPassage =
    searchParams.start !== undefined || searchParams.end !== undefined;
  return (
    <article className="mx-auto min-w-0 max-w-3xl space-y-8 pb-12 [overflow-wrap:anywhere]">
      <Link
        href={`/companies/${params.id}`}
        className="text-link inline-flex min-h-11 items-center"
      >
        Back to {document.company.name}
      </Link>
      <header className="space-y-3">
        <p className="label-eyebrow">Retained document text</p>
        <h1 className="font-serif text-3xl font-normal tracking-tight sm:text-4xl">
          {document.filename}
        </h1>
        <p className="text-sm text-muted-foreground">
          {document.company.name} · Uploaded{" "}
          <DateTime value={document.createdAt} />
        </p>
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          This is the extracted text retained in memory. PDF layout and original
          file formatting are not preserved. The upload date is not the date of
          the underlying meeting or document.
        </p>
      </header>
      {location ? (
        <p className="border-l-2 border-accent pl-4 text-sm">
          {highlight
            ? "The cited passage is highlighted in this section."
            : "The cited passage is in another section of this document."}{" "}
          <Link
            href={`/companies/${params.id}/documents/${params.documentId}?start=${location.start}&end=${location.end}#source-passage`}
            prefetch={false}
            className="text-link inline-flex min-h-11 items-center"
          >
            Jump to cited passage
          </Link>
        </p>
      ) : requestedPassage ? (
        <p
          role="status"
          className="border border-border p-4 text-sm text-muted-foreground"
        >
          This passage location is unavailable or invalid. The retained document
          text is shown for manual review.
        </p>
      ) : null}
      {document.rawText.length > 24000 && (
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            Showing characters {(window.start + 1).toLocaleString("en")}–
            {window.end.toLocaleString("en")} of{" "}
            {document.rawText.length.toLocaleString("en")}. Long documents are
            divided into sections for readability; a citation may continue in
            the next section.
          </p>
          <nav
            aria-label="Document text sections"
            className="flex flex-wrap gap-6"
          >
            {window.start > 0 && (
              <Link
                href={windowHref(Math.max(0, window.start - 24000))}
                prefetch={false}
                className="text-link inline-flex min-h-11 items-center"
              >
                Previous text section
              </Link>
            )}
            {window.end < document.rawText.length && (
              <Link
                href={windowHref(window.end)}
                prefetch={false}
                className="text-link inline-flex min-h-11 items-center"
              >
                Next text section
              </Link>
            )}
          </nav>
        </div>
      )}
      <section
        id="source-text"
        aria-label="Extracted source text"
        className="min-w-0 border-t border-border pt-8"
      >
        {document.rawText.trim() ? (
          <div className="whitespace-pre-wrap [overflow-wrap:anywhere] text-base leading-relaxed">
            {highlight ? (
              <>
                {document.rawText.slice(window.start, highlight.start)}
                <mark
                  id="source-passage"
                  tabIndex={-1}
                  className="scroll-mt-8 bg-secondary text-foreground underline decoration-accent decoration-2 underline-offset-4"
                >
                  {document.rawText.slice(highlight.start, highlight.end)}
                </mark>
                {document.rawText.slice(highlight.end, window.end)}
              </>
            ) : (
              document.rawText.slice(window.start, window.end)
            )}
          </div>
        ) : (
          <p className="text-muted-foreground">
            No extracted text is retained for this document.
          </p>
        )}
      </section>
    </article>
  );
}
