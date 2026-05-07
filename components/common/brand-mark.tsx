import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandMarkProps = {
  href?: string;
  size?: "sm" | "md" | "lg";
  showDescriptor?: boolean;
  className?: string;
};

const sizeStyles = {
  sm: {
    mark: "size-8",
    wordmark: "text-sm",
    descriptor: "text-[11px]",
  },
  md: {
    mark: "size-9",
    wordmark: "text-base",
    descriptor: "text-xs",
  },
  lg: {
    mark: "size-11",
    wordmark: "text-xl",
    descriptor: "text-xs",
  },
} as const;

function BrandSymbol({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-lg border bg-card",
        className,
      )}
    >
      <Image
        src="/falcondraft-logo.png"
        alt=""
        width={44}
        height={36}
        className="h-[78%] w-[78%] object-contain"
        priority
      />
    </span>
  );
}

function BrandContent({
  size = "md",
  showDescriptor = true,
}: Pick<BrandMarkProps, "size" | "showDescriptor">) {
  const styles = sizeStyles[size];

  return (
    <>
      <BrandSymbol className={styles.mark} />
      <span className="min-w-0 leading-tight">
        <span
          className={cn(
            "block font-semibold tracking-[-0.035em]",
            styles.wordmark,
          )}
        >
          FalconDraft
        </span>
        {showDescriptor ? (
          <span
            className={cn(
              "text-muted-foreground block font-medium",
              styles.descriptor,
            )}
            data-slot="brand-descriptor"
          >
            Espace de propositions
          </span>
        ) : null}
      </span>
    </>
  );
}

export function BrandMark({
  href,
  size = "md",
  showDescriptor = true,
  className,
}: BrandMarkProps) {
  const content = (
    <span className={cn("flex items-center gap-3", className)}>
      <BrandContent size={size} showDescriptor={showDescriptor} />
    </span>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} className={cn("group flex items-center gap-3", className)}>
      <BrandContent size={size} showDescriptor={showDescriptor} />
    </Link>
  );
}
