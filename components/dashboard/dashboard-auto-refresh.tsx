"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

/**
 * Forces a server data refetch when the user lands on the dashboard or
 * comes back to the tab. Avoids stale numbers after a workflow has run.
 * Returns null — it's purely an effect carrier.
 */
export function DashboardAutoRefresh() {
  const router = useRouter();
  const initialMount = React.useRef(true);

  React.useEffect(() => {
    // Skip the very first render — server already produced fresh data.
    if (initialMount.current) {
      initialMount.current = false;
    } else {
      router.refresh();
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [router]);

  return null;
}
