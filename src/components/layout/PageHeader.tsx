/**
 * Shared editorial page header — eyebrow label, thin serif title, muted
 * subhead. Used across sub-pages for a consistent "confident restraint" look.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <header className="max-w-[760px]">
      <p className="label-eyebrow">{eyebrow}</p>
      <h1 className="mt-5 font-serif text-3xl font-normal leading-[1.05] tracking-tight sm:text-4xl lg:text-5xl">
        {title}
      </h1>
      {description && (
        <p className="mt-6 max-w-[560px] text-[17px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
    </header>
  );
}
