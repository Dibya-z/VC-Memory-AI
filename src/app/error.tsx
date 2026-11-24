"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section role="alert" className="mx-auto max-w-2xl space-y-5 py-10">
      <p className="label-eyebrow">Workspace unavailable</p>
      <h1 className="font-serif text-4xl">We couldn’t load this page</h1>
      <p className="leading-relaxed text-muted-foreground">
        Company memory may be temporarily unavailable. Retry this page, or
        return to the dashboard. Your submitted documents are not deleted by
        this error.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <Button onClick={reset}>Retry page</Button>
        <Link href="/" className="text-link inline-flex min-h-11 items-center">
          Return to dashboard
        </Link>
      </div>
    </section>
  );
}
