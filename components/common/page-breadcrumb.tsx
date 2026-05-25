import Link from "next/link";
import { cn } from "@/lib/utils";

export function PageBreadcrumb({
  parent,
  parentHref,
  current,
  className,
}: {
  parent: string;
  parentHref: string;
  current: string;
  className?: string;
}) {
  return (
    <nav aria-label="Breadcrumb" className={cn("mb-1", className)}>
      <p className="truncate text-xs text-[var(--muted-foreground)]">
        <Link
          href={parentHref}
          className="transition-colors hover:text-[var(--foreground)]"
        >
          {parent}
        </Link>
        <span className="mx-1.5 select-none">/</span>
        <span className="text-[var(--foreground)]">{current}</span>
      </p>
    </nav>
  );
}
