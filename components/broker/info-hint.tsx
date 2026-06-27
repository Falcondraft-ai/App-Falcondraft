"use client";

import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * A discreet "?" that explains, on hover/focus, how a figure is computed.
 * Keeps methodology transparent without cluttering the interface.
 */
export function InfoHint({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Comment ce chiffre est calculé"
          className={cn(
            "inline-flex size-4 shrink-0 items-center justify-center rounded-full text-[var(--fg-4)] outline-none transition-colors hover:text-[var(--fg-2)] focus-visible:text-[var(--fg-2)]",
            className,
          )}
        >
          <HelpCircle className="size-3.5" strokeWidth={1.75} />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-[268px] text-left font-normal leading-5">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
