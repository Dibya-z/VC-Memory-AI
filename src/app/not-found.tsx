import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Record not found" };
export default function NotFound() {
  return (
    <section className="mx-auto max-w-2xl space-y-5 py-10">
      <p className="label-eyebrow">Record not found</p>
      <h1 className="font-serif text-4xl">This record isn’t available</h1>
      <p className="text-muted-foreground">
        The company or document may have been removed, or the link may be
        incorrect. Search the current company records to continue.
      </p>
      <Link
        href="/companies"
        className="text-link inline-flex min-h-11 items-center"
      >
        Find a company
      </Link>
    </section>
  );
}
