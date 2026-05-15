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
    mark: "h-8 w-9",
    wordmark: "text-sm",
    descriptor: "text-[11px]",
  },
  md: {
    mark: "h-11 w-12",
    wordmark: "text-base",
    descriptor: "text-xs",
  },
  lg: {
    mark: "h-14 w-16",
    wordmark: "text-xl",
    descriptor: "text-xs",
  },
} as const;

function BrandSymbol({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-md",
        "dark:bg-[#f7f1e8] dark:p-1 dark:ring-1 dark:ring-white/10 dark:shadow-[0_0_22px_rgba(198,154,97,0.18)]",
        className,
      )}
    >
      <Image
        src="/falcondraft-logo.png"
        alt="FalconDraft"
        width={363}
        height={384}
        className="h-full w-auto object-contain"
        data-slot="brand-symbol-light"
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
            Espace client
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
