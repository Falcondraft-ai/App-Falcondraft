"use client";

import * as React from "react";

export function LoadingDots() {
  const [dotCount, setDotCount] = React.useState(1);

  React.useEffect(() => {
    const interval = window.setInterval(() => {
      setDotCount((current) => (current === 3 ? 1 : current + 1));
    }, 420);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <span
      className="inline-flex w-5 items-center justify-start font-mono"
      aria-hidden="true"
    >
      {".".repeat(dotCount)}
    </span>
  );
}
