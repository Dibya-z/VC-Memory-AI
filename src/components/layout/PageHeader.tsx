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
      <h1 className="mt-5 font-serif text-5xl font-normal leading-[1.05] tracking-tight">
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
