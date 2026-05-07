"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function MockActionButton({
  label,
  message,
  variant = "outline",
  size = "default",
  className,
}: {
  label: string;
  message: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={() => {
        toast.success(message);
      }}
    >
      {label}
    </Button>
  );
}
